import path from "node:path";
import { Language, type Node, Parser, Query } from "web-tree-sitter";
import type { FileNode } from "@/lib/types";

/** One import statement: the module specifier plus, for Python, the imported names. */
export type RawImport = { spec: string; names: string[] };

type Grammar = "typescript" | "tsx" | "javascript" | "python";

const JS_QUERY = `
(import_statement source: (string (string_fragment) @spec))
(export_statement source: (string (string_fragment) @spec))
(call_expression
  function: [(identifier) (import)] @fn
  arguments: (arguments . (string (string_fragment) @spec)))
`;

const TS_QUERY = `${JS_QUERY}
(import_require_clause source: (string (string_fragment) @spec))
`;

const PY_QUERY = `
(import_statement) @import
(import_from_statement) @from
`;

const WASM: Record<Grammar, string> = {
  typescript: "tree-sitter-typescript/tree-sitter-typescript.wasm",
  tsx: "tree-sitter-typescript/tree-sitter-tsx.wasm",
  javascript: "tree-sitter-javascript/tree-sitter-javascript.wasm",
  python: "tree-sitter-python/tree-sitter-python.wasm",
};

type Loaded = { parser: Parser; query: Query };

let runtime: Promise<Map<Grammar, Loaded>> | null = null;

function wasmPath(file: string): string {
  return path.join(process.cwd(), "node_modules", file);
}

async function loadGrammars(): Promise<Map<Grammar, Loaded>> {
  await Parser.init({ locateFile: () => wasmPath("web-tree-sitter/web-tree-sitter.wasm") });
  const loaded = new Map<Grammar, Loaded>();
  for (const grammar of Object.keys(WASM) as Grammar[]) {
    const language = await Language.load(wasmPath(WASM[grammar]));
    const parser = new Parser();
    parser.setLanguage(language);
    const source = grammar === "python" ? PY_QUERY : grammar === "javascript" ? JS_QUERY : TS_QUERY;
    loaded.set(grammar, { parser, query: new Query(language, source) });
  }
  return loaded;
}

/** Loads the tree-sitter grammars once; resolves to null if WASM is unavailable. */
export async function treeSitter(): Promise<Map<Grammar, Loaded> | null> {
  runtime ??= loadGrammars();
  try {
    return await runtime;
  } catch {
    return null;
  }
}

export function grammarFor(file: FileNode): Grammar | null {
  if (file.lang === "py") return "python";
  if (file.lang === "js") return "javascript";
  if (file.lang === "ts") return file.path.endsWith(".tsx") ? "tsx" : "typescript";
  return null;
}

export function extractWithTreeSitter(
  { parser, query }: Loaded,
  source: string,
): RawImport[] | null {
  const tree = parser.parse(source);
  if (!tree) return null;
  try {
    const imports: RawImport[] = [];
    for (const match of query.matches(tree.rootNode)) {
      const capture = (name: string) => match.captures.find((c) => c.name === name)?.node;
      const fn = capture("fn");
      if (fn?.type === "identifier" && fn.text !== "require") continue;
      const spec = capture("spec");
      if (spec) imports.push({ spec: spec.text, names: [] });
      const statement = capture("import");
      if (statement) {
        for (const name of statement.childrenForFieldName("name")) {
          imports.push({ spec: moduleName(name), names: [] });
        }
      }
      const from = capture("from");
      const moduleNode = from?.childForFieldName("module_name");
      if (from && moduleNode) {
        const names = from.childrenForFieldName("name").map(moduleName);
        imports.push({ spec: moduleNode.text, names });
      }
    }
    return imports;
  } finally {
    tree.delete();
  }
}

/** `a.b as c` -> `a.b`; `a.b` -> `a.b`. */
function moduleName(node: Node): string {
  return (node.type === "aliased_import" ? node.childForFieldName("name") : node)?.text ?? "";
}

const JS_PATTERNS = [
  /(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]/g,
  /import\s*['"]([^'"]+)['"]/g,
  /(?:require|import)\(\s*['"]([^'"]+)['"]\s*\)/g,
];

/** Regex fallback used when tree-sitter is unavailable or fails on a file. */
export function extractWithRegex(lang: FileNode["lang"], source: string): RawImport[] {
  if (lang === "py") return extractPythonRegex(source);
  const imports: RawImport[] = [];
  for (const pattern of JS_PATTERNS) {
    for (const m of source.matchAll(pattern)) imports.push({ spec: m[1] ?? "", names: [] });
  }
  return imports.filter((i) => i.spec);
}

function extractPythonRegex(source: string): RawImport[] {
  const imports: RawImport[] = [];
  for (const m of source.matchAll(/^\s*from\s+(\.+[\w.]*|[\w.]+)\s+import\s+\(?([\w\s,*]+)\)?/gm)) {
    const names = (m[2] ?? "")
      .split(",")
      .map((n) => n.trim().split(/\s+/)[0] ?? "")
      .filter((n) => n && n !== "*");
    imports.push({ spec: m[1] ?? "", names });
  }
  for (const m of source.matchAll(
    /^\s*import\s+([\w.]+(?:\s+as\s+\w+)?(?:\s*,\s*[\w.]+(?:\s+as\s+\w+)?)*)/gm,
  )) {
    for (const part of (m[1] ?? "").split(",")) {
      const spec = part.trim().split(/\s+/)[0];
      if (spec) imports.push({ spec, names: [] });
    }
  }
  return imports;
}

/** Exported top-level symbol names: a cheap hint for the planner, not used for edges. */
export function extractSymbols(lang: FileNode["lang"], source: string): string[] {
  const pattern =
    lang === "py"
      ? /^(?:async\s+def|def|class)\s+([A-Za-z_]\w*)/gm
      : /export\s+(?:default\s+)?(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:function\*?|class|const|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;
  const names = new Set<string>();
  for (const m of source.matchAll(pattern)) if (m[1]) names.add(m[1]);
  return [...names];
}
