import path from "node:path/posix";
import type { FileNode } from "@/lib/types";
import type { RawImport } from "./extract";

type Alias = { prefix: string; suffix: string; targets: string[] };
type AliasScope = { dir: string; aliases: Alias[] };

/** Repo-wide facts needed to turn specifiers into repo paths. */
export type ResolveContext = {
  files: Set<string>;
  aliasScopes: AliasScope[]; // deepest dir first
  workspaces: Map<string, string>; // package name -> dir
  pythonRoots: string[];
};

const JS_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".d.ts", ".js", ".jsx", ".mjs", ".cjs"];
const JS_TO_TS: Record<string, string[]> = {
  ".js": [".ts", ".tsx"],
  ".jsx": [".tsx"],
  ".mjs": [".mts"],
  ".cjs": [".cts"],
};

export function buildResolveContext(
  files: FileNode[],
  contents: Record<string, string>,
): ResolveContext {
  const aliasScopes: AliasScope[] = [];
  const workspaces = new Map<string, string>();
  const pythonRoots = new Set(["", "src"]);

  for (const { path: file } of files) {
    const name = path.basename(file);
    const dir = dirOf(file);
    const text = contents[file];
    if (text === undefined) continue;
    if (/^[tj]sconfig(\..+)?\.json$/.test(name)) {
      const aliases = readAliases(text, dir);
      if (aliases.length > 0) aliasScopes.push({ dir, aliases });
    } else if (name === "package.json" && dir !== "") {
      const pkgName = parseJsonc(text)?.name;
      if (typeof pkgName === "string") workspaces.set(pkgName, dir);
    } else if (name === "pyproject.toml" || name === "setup.py" || name === "setup.cfg") {
      pythonRoots.add(dir);
      pythonRoots.add(path.join(dir, "src"));
    }
  }
  aliasScopes.sort((a, b) => b.dir.length - a.dir.length);

  return {
    files: new Set(files.map((f) => f.path)),
    aliasScopes,
    workspaces,
    pythonRoots: [...pythonRoots],
  };
}

/** Resolves one import to the repo files it refers to; external packages resolve to []. */
export function resolveImport(from: FileNode, imp: RawImport, ctx: ResolveContext): string[] {
  if (from.lang === "py") return resolvePython(from.path, imp, ctx);
  const hit = resolveJs(from.path, imp.spec, ctx);
  return hit ? [hit] : [];
}

function resolveJs(from: string, spec: string, ctx: ResolveContext): string | null {
  if (spec.startsWith(".")) return probeJs(path.join(dirOf(from), spec), ctx.files);
  if (spec.startsWith("/")) return probeJs(spec.slice(1), ctx.files);

  for (const scope of ctx.aliasScopes) {
    if (scope.dir !== "" && !from.startsWith(`${scope.dir}/`)) continue;
    for (const alias of scope.aliases) {
      if (!spec.startsWith(alias.prefix) || !spec.endsWith(alias.suffix)) continue;
      const wildcard = spec.slice(alias.prefix.length, spec.length - alias.suffix.length);
      for (const target of alias.targets) {
        const hit = probeJs(target.replace("*", wildcard), ctx.files);
        if (hit) return hit;
      }
    }
  }

  for (const [name, dir] of ctx.workspaces) {
    if (spec !== name && !spec.startsWith(`${name}/`)) continue;
    const rest = spec.slice(name.length);
    return (
      probeJs(path.join(dir, "src", rest), ctx.files) ?? probeJs(path.join(dir, rest), ctx.files)
    );
  }
  return null;
}

function probeJs(base: string, files: Set<string>): string | null {
  const normalized = path
    .normalize(base)
    .replace(/^\.\/?/, "")
    .replace(/\/$/, "");
  if (normalized.startsWith("..")) return null;
  const ext = path.extname(normalized);
  const candidates = [
    normalized,
    ...(JS_TO_TS[ext] ?? []).map((e) => normalized.slice(0, -ext.length) + e),
    ...JS_EXTENSIONS.map((e) => normalized + e),
    ...JS_EXTENSIONS.map((e) => path.join(normalized, `index${e}`)),
  ];
  return candidates.find((c) => files.has(c)) ?? null;
}

function resolvePython(from: string, imp: RawImport, ctx: ResolveContext): string[] {
  const dots = /^\.*/.exec(imp.spec)?.[0].length ?? 0;
  const modulePath = imp.spec.slice(dots).split(".").filter(Boolean).join("/");

  let bases: string[];
  if (dots > 0) {
    let dir = dirOf(from);
    for (let i = 1; i < dots; i++) dir = dirOf(dir);
    bases = [path.join(dir, modulePath)];
  } else {
    bases = [...ctx.pythonRoots, dirOf(from)].map((root) => path.join(root, modulePath));
  }

  for (const base of bases) {
    const submodules = imp.names
      .map((name) => probePython(path.join(base, name.replace(/\./g, "/")), ctx.files))
      .filter((hit): hit is string => hit !== null);
    if (submodules.length > 0) return submodules;
    const hit = probePython(base, ctx.files);
    if (hit) return [hit];
  }
  return [];
}

function probePython(base: string, files: Set<string>): string | null {
  const normalized = path.normalize(base).replace(/^\.\/?/, "");
  if (normalized.startsWith("..")) return null;
  const candidates = [`${normalized}.py`, path.join(normalized, "__init__.py")];
  return candidates.find((c) => files.has(c)) ?? null;
}

function readAliases(text: string, dir: string): Alias[] {
  const options = parseJsonc(text)?.compilerOptions;
  if (!isRecord(options)) return [];
  const baseUrl = typeof options.baseUrl === "string" ? options.baseUrl : ".";
  const paths = isRecord(options.paths) ? options.paths : {};
  return Object.entries(paths).flatMap(([pattern, targets]) => {
    if (!Array.isArray(targets)) return [];
    const [prefix = "", suffix = ""] = pattern.split("*");
    return [
      {
        prefix,
        suffix: pattern.includes("*") ? suffix : "",
        targets: targets
          .filter((t): t is string => typeof t === "string")
          .map((t) => path.join(dir, baseUrl, t)),
      },
    ];
  });
}

/** Parses JSON with comments and trailing commas (tsconfig style). */
export function parseJsonc(text: string): Record<string, unknown> | null {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      const end = endOfString(text, i);
      out += text.slice(i, end);
      i = end - 1;
    } else if (ch === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
    } else if (ch === "/" && text[i + 1] === "*") {
      i = text.indexOf("*/", i + 2);
      if (i === -1) break;
      i++;
    } else {
      out += ch;
    }
  }
  try {
    const parsed: unknown = JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function endOfString(text: string, start: number): number {
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === "\\") i++;
    else if (text[i] === '"') return i + 1;
  }
  return text.length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function dirOf(file: string): string {
  const dir = path.dirname(file);
  return dir === "." ? "" : dir;
}
