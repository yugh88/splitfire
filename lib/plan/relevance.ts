import type { RepoAnalysis } from "@/lib/analyze/load";

const STOPWORDS = new Set(
  "the and for with that this from into add adds make makes use using support new feature should can will page when then each all any via let lets user users".split(
    " ",
  ),
);

/** Lowercase search terms from a feature request. */
export function requestTerms(request: string): string[] {
  const words = splitWords(request).filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  return [...new Set(words)];
}

/** Scores files by how well their path and exported symbols match the request. */
export function rankFiles(
  analysis: RepoAnalysis,
  request: string,
): { path: string; score: number }[] {
  const terms = requestTerms(request);
  return analysis.files
    .map((file) => {
      const pathWords = splitWords(file.path);
      const symbolWords = (analysis.symbols[file.path] ?? []).flatMap(splitWords);
      const score =
        2 * terms.filter((t) => pathWords.some((w) => matches(w, t))).length +
        terms.filter((t) => symbolWords.some((w) => matches(w, t))).length;
      return { path: file.path, score };
    })
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
}

function matches(word: string, term: string): boolean {
  if (word === term) return true;
  return (
    Math.min(word.length, term.length) >= 4 && (word.startsWith(term) || term.startsWith(word))
  );
}

function splitWords(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}
