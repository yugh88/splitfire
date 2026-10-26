import type { FileNode } from "@/lib/types";

export const MAX_FILES = 500;
export const MAX_TOTAL_BYTES = 2_000_000;
export const MAX_FILE_BYTES = 200_000;

export type TreeEntry = { path: string; bytes: number };

export type Selection = { files: FileNode[]; skipped: number; truncated: boolean };

const IGNORED_DIRS = new Set([
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
  ".git",
  ".venv",
  "venv",
  "env",
  "__pycache__",
  "site-packages",
  "generated",
  "__generated__",
  "__snapshots__",
]);

const LOCK_FILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "bun.lock",
  "poetry.lock",
  "Pipfile.lock",
  "uv.lock",
  "Cargo.lock",
  "composer.lock",
  "Gemfile.lock",
  "go.sum",
]);

const TEXT_EXTENSIONS = new Set([
  "ts",
  "tsx",
  "mts",
  "cts",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "py",
  "json",
  "md",
  "mdx",
  "yml",
  "yaml",
  "toml",
  "cfg",
  "ini",
  "css",
  "scss",
  "html",
  "vue",
  "svelte",
  "sql",
  "sh",
  "txt",
]);

const GENERATED_SUFFIXES = [".min.js", ".min.css", ".map", ".snap", ".pb.go", "_pb2.py"];

const KNOWN_TEXT_FILES = new Set(["Dockerfile", "Makefile", "LICENSE", ".env.example"]);

export function langOf(path: string): FileNode["lang"] {
  const ext = extension(path);
  if (ext === "ts" || ext === "tsx" || ext === "mts" || ext === "cts") return "ts";
  if (ext === "js" || ext === "jsx" || ext === "mjs" || ext === "cjs") return "js";
  if (ext === "py") return "py";
  return "other";
}

export function isIgnored(path: string): boolean {
  const parts = path.split("/");
  const name = parts[parts.length - 1] ?? "";
  if (parts.slice(0, -1).some((dir) => IGNORED_DIRS.has(dir))) return true;
  if (LOCK_FILES.has(name)) return true;
  if (GENERATED_SUFFIXES.some((suffix) => name.endsWith(suffix))) return true;
  if (KNOWN_TEXT_FILES.has(name)) return false;
  return !TEXT_EXTENSIONS.has(extension(name));
}

/**
 * Deterministically picks which files to ingest: drops vendored/generated/lock/binary files,
 * then keeps source files first (shallowest paths first) until the file and byte caps are hit.
 */
export function selectFiles(entries: TreeEntry[]): Selection {
  const candidates = entries.filter((e) => !isIgnored(e.path) && e.bytes <= MAX_FILE_BYTES);
  const ranked = [...candidates].sort(
    (a, b) =>
      rank(a.path) - rank(b.path) || depth(a.path) - depth(b.path) || a.path.localeCompare(b.path),
  );

  const files: FileNode[] = [];
  let total = 0;
  for (const entry of ranked) {
    if (files.length >= MAX_FILES) break;
    if (total + entry.bytes > MAX_TOTAL_BYTES) continue;
    total += entry.bytes;
    files.push({ path: entry.path, lang: langOf(entry.path), bytes: entry.bytes });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));

  return {
    files,
    skipped: entries.length - files.length,
    truncated: files.length < candidates.length,
  };
}

function extension(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

const LOW_PRIORITY_DIRS = new Set([
  "docs",
  "docs_src",
  "examples",
  "example",
  "benchmarks",
  "fixtures",
]);

/** Root manifests (needed for tooling and aliases) are always kept. */
const ROOT_MANIFESTS = new Set([
  "package.json",
  "tsconfig.json",
  "jsconfig.json",
  "pyproject.toml",
  "setup.py",
  "setup.cfg",
  "requirements.txt",
]);

/** Root manifests, then core source, then docs/example source, then everything else. */
function rank(path: string): number {
  if (ROOT_MANIFESTS.has(path)) return -1;
  if (langOf(path) === "other") return 2;
  return path.split("/").some((dir) => LOW_PRIORITY_DIRS.has(dir)) ? 1 : 0;
}

function depth(path: string): number {
  return path.split("/").length;
}
