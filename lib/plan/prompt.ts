import type { RepoAnalysis } from "@/lib/analyze/load";
import { rankFiles } from "./relevance";
import { MAX_TASKS } from "./schema";

/** Hard cap on the repo map we send (~15k tokens). */
export const MAX_PROMPT_CHARS = 60_000;
export const MAX_OUTPUT_TOKENS = 4_000;

export const SYSTEM_PROMPT = `You are Splitfire's planner. Split a feature request into tasks that separate coding agents can do at the same time in one repo.

Rules:
- Each task owns the files it will edit or create. Every file is owned by exactly one task.
- Prefer independent tasks over long chains. When several tasks rely on shared types, function signatures or API shapes, put those in one small task of kind "contract" that the others depend on.
- dependsOn lists ids of tasks that must finish first. No cycles.
- Use paths from the repo map. New files are allowed; place them next to related code.
- Between 2 and ${MAX_TASKS} tasks. difficulty: 1 = boilerplate, 2 = normal, 3 = tricky logic.
- kind is one of: contract, feature, test, docs.

Reply with JSON only, in exactly this shape:
{"elements":[{"id":"short-kebab-id","title":"Short title","goal":"One or two sentences.","kind":"feature","ownedFiles":["path/to/file.ts"],"dependsOn":["other-task-id"],"difficulty":2}]}`;

/** The user message: the request plus a relevance-ordered repo map that fits the char cap. */
export function buildPrompt(analysis: RepoAnalysis, request: string): string {
  const header = [
    `Feature request: ${request.trim()}`,
    "",
    `Repo: ${analysis.repo} @ ${analysis.sha.slice(0, 7)} (${analysis.files.length} files).`,
  ];
  const bytes = new Map(analysis.files.map((f) => [f.path, f.bytes]));
  const fileBudget = Math.floor(MAX_PROMPT_CHARS * 0.6);

  const fileLines: string[] = [];
  const shown = new Set<string>();
  let used = 0;
  for (const { path } of rankFiles(analysis, request)) {
    const symbols = (analysis.symbols[path] ?? []).slice(0, 8).join(", ");
    const kb = ((bytes.get(path) ?? 0) / 1024).toFixed(1);
    const line = symbols ? `${path} · ${kb}KB · ${symbols}` : `${path} · ${kb}KB`;
    if (used + line.length > fileBudget) break;
    fileLines.push(line);
    shown.add(path);
    used += line.length + 1;
  }

  const importsByFile = new Map<string, string[]>();
  for (const e of analysis.edges) {
    if (shown.has(e.from) && shown.has(e.to)) {
      importsByFile.set(e.from, [...(importsByFile.get(e.from) ?? []), e.to]);
    }
  }
  const edgeLines: string[] = [];
  for (const [from, tos] of importsByFile) {
    const line = `${from} -> ${tos.join(", ")}`;
    if (used + line.length > MAX_PROMPT_CHARS) break;
    edgeLines.push(line);
    used += line.length + 1;
  }

  return [
    ...header,
    `Files (path · size · exports), most relevant first${shown.size < analysis.files.length ? `, ${shown.size} shown` : ""}:`,
    ...fileLines,
    "",
    "Imports (file -> files it imports):",
    ...edgeLines,
  ].join("\n");
}
