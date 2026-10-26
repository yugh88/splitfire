import type { FileNode, ImportEdge } from "@/lib/types";
import {
  extractSymbols,
  extractWithRegex,
  extractWithTreeSitter,
  grammarFor,
  treeSitter,
  type RawImport,
} from "./extract";
import { buildResolveContext, resolveImport } from "./resolve";

export type ImportGraph = {
  edges: ImportEdge[];
  symbols: Record<string, string[]>;
  parser: "tree-sitter" | "regex" | "mixed";
};

/** Parses every source file and returns the deterministic, deduplicated import graph. */
export async function buildImportGraph(
  files: FileNode[],
  contents: Record<string, string>,
): Promise<ImportGraph> {
  const grammars = await treeSitter();
  const ctx = buildResolveContext(files, contents);
  const seen = new Set<string>();
  const edges: ImportEdge[] = [];
  const symbols: Record<string, string[]> = {};
  let regexFiles = 0;
  let parsedFiles = 0;

  for (const file of files) {
    const grammar = grammarFor(file);
    const source = contents[file.path];
    if (!grammar || source === undefined) continue;
    parsedFiles++;

    const loaded = grammars?.get(grammar);
    let imports: RawImport[] | null = null;
    try {
      imports = loaded ? extractWithTreeSitter(loaded, source) : null;
    } catch {
      imports = null;
    }
    if (!imports) {
      regexFiles++;
      imports = extractWithRegex(file.lang, source);
    }

    const exported = extractSymbols(file.lang, source);
    if (exported.length > 0) symbols[file.path] = exported;

    for (const imp of imports) {
      for (const to of resolveImport(file, imp, ctx)) {
        const key = `${file.path}\u0000${to}`;
        if (to === file.path || seen.has(key)) continue;
        seen.add(key);
        edges.push({ from: file.path, to });
      }
    }
  }

  edges.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  const parser = regexFiles === 0 ? "tree-sitter" : regexFiles === parsedFiles ? "regex" : "mixed";
  return { edges, symbols, parser };
}
