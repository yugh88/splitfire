/**
 * A small, dependency-free `.gitignore` matcher for the local file walker.
 *
 * It supports the parts that matter for picking source files: comments, blank lines,
 * negation (`!`), anchored patterns (`/x`), directory-only patterns (`x/`), wildcards
 * (`*`, `?`, `**`) and simple character classes. Git itself resolves a few edge cases
 * (notably re-including a file inside an ignored directory) that we do not need.
 */

export type IgnoreRule = {
  /** Repo-relative directory the rule was declared in ("" for the root). */
  base: string;
  negate: boolean;
  dirOnly: boolean;
  regex: RegExp;
  source: string;
};

/** Parses one `.gitignore` file; `base` is its directory relative to the repo root. */
export function parseIgnoreFile(text: string, base = ""): IgnoreRule[] {
  const rules: IgnoreRule[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const rule = parseLine(rawLine, base);
    if (rule) rules.push(rule);
  }
  return rules;
}

function parseLine(rawLine: string, base: string): IgnoreRule | null {
  let line = stripTrailingSpace(rawLine);
  if (!line) return null;
  if (line.startsWith("#")) return null;

  let negate = false;
  if (line.startsWith("\\#") || line.startsWith("\\!")) {
    line = line.slice(1);
  } else if (line.startsWith("!")) {
    negate = true;
    line = line.slice(1);
  }
  if (!line) return null;

  let dirOnly = false;
  if (line.endsWith("/")) {
    dirOnly = true;
    line = line.slice(0, -1);
  }
  if (!line) return null;

  let anchored = false;
  if (line.startsWith("/")) {
    anchored = true;
    line = line.slice(1);
  }
  if (!line) return null;

  const hasSlash = line.includes("/");
  const body = globToRegExp(line);
  const source = anchored || hasSlash ? `^${body}$` : `^(?:.*/)?${body}$`;

  try {
    return {
      base,
      negate,
      dirOnly,
      regex: new RegExp(source),
      source: rawLine.trim(),
    };
  } catch {
    return null;
  }
}

/** Last matching rule wins; negations re-include a path. */
export function isPathIgnored(
  relPath: string,
  isDir: boolean,
  rules: readonly IgnoreRule[],
): boolean {
  let ignored = false;
  for (const rule of rules) {
    if (rule.dirOnly && !isDir) continue;
    const scoped = scope(relPath, rule.base);
    if (scoped === null || scoped === "") continue;
    if (rule.regex.test(scoped)) ignored = !rule.negate;
  }
  return ignored;
}

/** The path relative to a rule's directory, or null when the rule does not cover it. */
function scope(relPath: string, base: string): string | null {
  if (!base) return relPath;
  if (relPath === base) return "";
  if (!relPath.startsWith(`${base}/`)) return null;
  return relPath.slice(base.length + 1);
}

function globToRegExp(pattern: string): string {
  let out = "";
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i] as string;
    if (char === "*") {
      if (pattern[i + 1] === "*") {
        while (pattern[i + 1] === "*") i++;
        if (pattern[i + 1] === "/") {
          i++;
          out += "(?:.*/)?";
        } else {
          out += ".*";
        }
      } else {
        out += "[^/]*";
      }
    } else if (char === "?") {
      out += "[^/]";
    } else if (char === "[") {
      const close = pattern.indexOf("]", i + 1);
      if (close === -1) {
        out += "\\[";
      } else {
        const body = pattern.slice(i + 1, close);
        const negated = body.startsWith("!") ? `^${body.slice(1)}` : body;
        out += `[${negated.replace(/\\/g, "\\\\")}]`;
        i = close;
      }
    } else if (char === "\\") {
      i++;
      if (i < pattern.length) out += escapeRegExp(pattern[i] as string);
    } else {
      out += escapeRegExp(char);
    }
  }
  return out;
}

function escapeRegExp(char: string): string {
  return char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Unescaped trailing spaces are ignored by git; escaped ones are part of the pattern. */
function stripTrailingSpace(line: string): string {
  let end = line.length;
  while (end > 0 && line[end - 1] === " " && line[end - 2] !== "\\") end--;
  return line.slice(0, end);
}
