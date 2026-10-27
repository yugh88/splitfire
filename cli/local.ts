import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import type { Dirent } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RepoAnalysis } from "@/lib/analyze/load";
import { buildImportGraph } from "@/lib/analyze/graph";
import { detectTooling } from "@/lib/analyze/tooling";
import { parseRepoUrl } from "@/lib/ingest/repo-url";
import { selectFiles, type TreeEntry } from "@/lib/ingest/filter";
import type { FileNode } from "@/lib/types";
import { CliError } from "./errors";
import { isPathIgnored, parseIgnoreFile, type IgnoreRule } from "./gitignore";

/**
 * Local mode ingest: walks the working tree instead of calling GitHub, so private repos work
 * without a token. File contents stay in this process; only the resulting paths/graph can ever
 * reach a model.
 */

const HARD_SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "vendor",
  "vendors",
  "third_party",
  "dist",
  "build",
  "out",
  "target",
  "coverage",
  ".next",
  ".nuxt",
  ".turbo",
  ".cache",
  ".venv",
  "venv",
  "env",
  "__pycache__",
  "site-packages",
  "generated",
  "__generated__",
  "__snapshots__",
]);

export type WalkOptions = {
  /** Repo-relative directories to leave out entirely (for example the output pack). */
  skipDirs?: readonly string[];
  /** Repo-relative files to leave out entirely (for example the generated gates workflow). */
  skipFiles?: readonly string[];
};

/** Every non-ignored file under `root`, sorted by path, with its byte size. */
export function walkRepo(root: string, opts: WalkOptions = {}): TreeEntry[] {
  const absolute = path.resolve(root);
  const skipDirs = new Set(
    (opts.skipDirs ?? [])
      .map((dir) => dir.replace(/\\/g, "/").replace(/^\.\/+|\/+$/g, ""))
      .filter(Boolean),
  );
  const skipFiles = new Set(
    (opts.skipFiles ?? [])
      .map((file) => file.replace(/\\/g, "/").replace(/^\.\/+/, ""))
      .filter(Boolean),
  );
  const excludeRules = parseIgnoreFile(
    readIfPresent(path.join(absolute, ".git", "info", "exclude")),
  );
  const entries: TreeEntry[] = [];

  const walk = (dir: string, relDir: string, inherited: IgnoreRule[]) => {
    const local = parseIgnoreFile(readIfPresent(path.join(dir, ".gitignore")), relDir);
    const active = local.length > 0 ? [...inherited, ...local] : inherited;
    const dirents = safeReaddir(dir).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    );

    for (const dirent of dirents) {
      const rel = relDir ? `${relDir}/${dirent.name}` : dirent.name;
      if (dirent.isSymbolicLink()) continue;

      if (dirent.isDirectory()) {
        if (HARD_SKIP_DIRS.has(dirent.name) || skipDirs.has(rel)) continue;
        if (isPathIgnored(rel, true, active)) continue;
        walk(path.join(dir, dirent.name), rel, active);
        continue;
      }
      if (!dirent.isFile()) continue;
      if (skipFiles.has(rel)) continue;
      if (isPathIgnored(rel, false, active)) continue;
      try {
        entries.push({ path: rel, bytes: statSync(path.join(dir, dirent.name)).size });
      } catch {
        // A file that disappeared mid-walk is simply not part of the snapshot.
      }
    }
  };

  walk(absolute, "", excludeRules);
  entries.sort((a, b) => a.path.localeCompare(b.path));
  return entries;
}

export type LocalLoad = {
  analysis: RepoAnalysis;
  contents: Record<string, string>;
  entries: TreeEntry[];
};

/** Reads, filters and parses a local repo with the same modules the web app uses. */
export async function loadLocalAnalysis(root: string, opts: WalkOptions = {}): Promise<LocalLoad> {
  const absolute = path.resolve(root);
  if (!existsSync(absolute) || !statSync(absolute).isDirectory()) {
    throw new CliError(`Not a directory: ${root}`);
  }

  const entries = walkRepo(absolute, opts);
  const selection = selectFiles(entries);
  const contents: Record<string, string> = {};
  const files: FileNode[] = [];
  let unreadable = 0;
  for (const file of selection.files) {
    try {
      contents[file.path] = readFileSync(path.join(absolute, file.path), "utf8");
      files.push(file);
    } catch {
      unreadable++;
    }
  }

  const graph = await withGrammarRuntime(() => buildImportGraph(files, contents));
  const git = readGitInfo(absolute);
  const analysis: RepoAnalysis = {
    repo: git.repo ?? `local/${path.basename(absolute) || "repo"}`,
    sha: git.sha ?? syntheticSha(entries),
    files,
    edges: graph.edges,
    symbols: graph.symbols,
    parser: graph.parser,
    tooling: detectTooling(
      entries.map((entry) => entry.path),
      contents,
    ),
    skipped: selection.skipped + unreadable,
    truncated: selection.truncated,
  };
  return { analysis, contents, entries };
}

export type GitInfo = { sha: string | null; repo: string | null };

/** Reads HEAD and the origin remote straight from `.git`, without spawning git. */
export function readGitInfo(root: string): GitInfo {
  const gitDir = findGitDir(root);
  if (!gitDir) return { sha: null, repo: null };
  const commonDir = readCommonDir(gitDir);
  return { sha: readHeadSha(gitDir, commonDir), repo: readRemoteRepo(gitDir, commonDir) };
}

function findGitDir(root: string): string | null {
  const dotGit = path.join(root, ".git");
  if (!existsSync(dotGit)) return null;
  try {
    if (statSync(dotGit).isDirectory()) return dotGit;
    const text = readFileSync(dotGit, "utf8").trim();
    const match = /^gitdir:\s*(.+)$/i.exec(text);
    if (!match) return null;
    return path.resolve(root, match[1] as string);
  } catch {
    return null;
  }
}

function readCommonDir(gitDir: string): string {
  const file = path.join(gitDir, "commondir");
  if (!existsSync(file)) return gitDir;
  try {
    const value = readFileSync(file, "utf8").trim();
    return value ? path.resolve(gitDir, value) : gitDir;
  } catch {
    return gitDir;
  }
}

function readHeadSha(gitDir: string, commonDir: string): string | null {
  let head: string;
  try {
    head = readFileSync(path.join(gitDir, "HEAD"), "utf8").trim();
  } catch {
    return null;
  }
  const ref = /^ref:\s*(.+)$/.exec(head)?.[1];
  if (!ref) return isSha(head) ? head : null;

  for (const base of [gitDir, commonDir]) {
    const direct = readTrimmed(path.join(base, ref));
    if (direct && isSha(direct)) return direct;
  }
  for (const base of [commonDir, gitDir]) {
    const packed = readTrimmed(path.join(base, "packed-refs"));
    if (!packed) continue;
    for (const line of packed.split(/\r?\n/)) {
      if (!line || line.startsWith("#") || line.startsWith("^")) continue;
      const [sha, name] = line.trim().split(/\s+/, 2);
      if (sha && name === ref && isSha(sha)) return sha;
    }
  }
  return null;
}

function readRemoteRepo(gitDir: string, commonDir: string): string | null {
  const config =
    readTrimmed(path.join(gitDir, "config")) ?? readTrimmed(path.join(commonDir, "config"));
  if (!config) return null;

  const urls: { name: string; url: string }[] = [];
  let currentRemote = "";
  for (const line of config.split(/\r?\n/)) {
    const section = /^\s*\[remote\s+"([^"]+)"\]\s*$/.exec(line);
    if (section) {
      currentRemote = section[1] as string;
      continue;
    }
    if (/^\s*\[/.test(line)) {
      currentRemote = "";
      continue;
    }
    if (!currentRemote) continue;
    const url = /^\s*url\s*=\s*(.+)$/.exec(line)?.[1];
    if (url) urls.push({ name: currentRemote, url: url.trim() });
  }

  const origin = urls.find((entry) => entry.name === "origin")?.url;
  for (const url of [origin, ...urls.map((entry) => entry.url)].filter((value): value is string =>
    Boolean(value),
  )) {
    const parsed = parseRemote(url);
    if (parsed) return parsed;
  }
  return null;
}

function parseRemote(url: string): string | null {
  const cleaned = url
    .trim()
    .replace(/^git@github\.com:/, "")
    .replace(/^ssh:\/\/git@github\.com\//, "")
    .replace(/^git:\/\/github\.com\//, "");
  const parsed = parseRepoUrl(cleaned);
  return parsed ? `${parsed.owner}/${parsed.repo}` : null;
}

function syntheticSha(entries: readonly TreeEntry[]): string {
  const hash = createHash("sha1");
  for (const entry of entries) hash.update(`${entry.path}\u0000${entry.bytes}\n`);
  return hash.digest("hex");
}

function readTrimmed(file: string): string | null {
  try {
    return readFileSync(file, "utf8").trim();
  } catch {
    return null;
  }
}

function safeReaddir(dir: string): Dirent[] {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function readIfPresent(file: string): string {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function isSha(value: string): boolean {
  return /^[0-9a-f]{7,64}$/i.test(value);
}

/** The tree-sitter WASM lives next to the package, which may not be the user's cwd. */
function findGrammarRoot(): string | null {
  const starts: string[] = [];
  try {
    starts.push(path.dirname(fileURLToPath(import.meta.url)));
  } catch {
    // import.meta.url is not a file URL in every bundler; the other starts still work.
  }
  if (process.argv[1]) starts.push(path.dirname(path.resolve(process.argv[1])));
  starts.push(process.cwd());

  for (const start of starts) {
    let dir = start;
    for (;;) {
      if (existsSync(path.join(dir, "node_modules", "web-tree-sitter"))) return dir;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return null;
}

async function withGrammarRuntime<T>(fn: () => Promise<T>): Promise<T> {
  const root = findGrammarRoot();
  const previous = process.cwd();
  if (root && root !== previous) {
    try {
      process.chdir(root);
    } catch {
      // Parsing falls back to the regex extractor, which needs no WASM.
    }
  }
  try {
    return await fn();
  } finally {
    if (process.cwd() !== previous) {
      try {
        process.chdir(previous);
      } catch {
        // Nothing else in the CLI depends on cwd after this point.
      }
    }
  }
}
