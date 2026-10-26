/**
 * Turns a task's acceptance list into the shell commands a gate runner may execute.
 *
 * Acceptance lines are written by the planner, but they are still untrusted text: they mix real
 * commands ("npm run typecheck") with prose ("git diff touches only owned files"). Only lines we
 * can classify as a known command or a file-exists check become runnable. Everything else is
 * reported as a manual check and is never executed.
 */

/** One acceptance check the gate runner can execute. */
export type RunnableCheck = {
  /** The acceptance line this check came from. */
  source: string;
  /** `command` runs the text as a shell command; `file` checks that a path exists. */
  kind: "command" | "file";
  /** The exact shell command the workflow runs. */
  command: string;
};

/** An acceptance line that is kept for humans but never executed. */
export type ManualCheck = {
  source: string;
  /** `unsafe` means the line looked like a command but could chain or redirect shell work. */
  reason: "not-a-command" | "unsafe";
};

export type AcceptancePlan = {
  runnable: RunnableCheck[];
  /** Non-runnable checks, in the order they appeared. Never executed. */
  manual: ManualCheck[];
};

const MAX_COMMAND_LENGTH = 300;
const MAX_PATH_LENGTH = 240;

/** Command heads we know how to run. Anything else is a manual check. */
const COMMAND_HEADS = new Set([
  "npm",
  "pnpm",
  "yarn",
  "npx",
  "vitest",
  "playwright",
  "pytest",
  "tsc",
  "go",
  "cargo",
  "python",
  "python3",
  "bun",
]);

/** Shell syntax that could chain, redirect, substitute or escape into another command. */
const SHELL_METACHARACTERS = /[;&|<>`$]/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const QUOTES = /["'`]/;
const SAFE_PATH = /^[A-Za-z0-9._@+/-]+$/;

const CHECKBOX = /^\[[ xX]\]\s+/;
const BULLET = /^(?:[-*]|\d+[.)])\s+/;
const PROMPT = /^\$\s+/;

const TEST_FILE = /^test\s+-(f|e)\s+(?:'([^']+)'|"([^"]+)"|(\S+))$/;
const BRACKET_FILE = /^\[\s+-(f|e)\s+(?:'([^']+)'|"([^"]+)"|(\S+))\s+\]$/;

/** A path-looking token: it has a directory separator or a file extension. */
const PATH_TOKEN =
  "(?:[A-Za-z0-9._@+-]+/)*[A-Za-z0-9._@+-]*\\.[A-Za-z0-9]+|[A-Za-z0-9._@+-]+(?:/[A-Za-z0-9._@+-]+)+";

const PROSE_FILE = new RegExp(`^(?:file\\s+)?(${PATH_TOKEN})\\s+(?:must\\s+)?exists?\\.?$`, "i");
const BACKTICKED_FILE = new RegExp(`^(?:file\\s+)?\`([^\`]+)\`\\s+(?:must\\s+)?exists?\\.?$`, "i");
const BACKTICKED = /`([^`]+)`/g;

type FileCheck = { path: string; flag: "f" | "e" };

type CommandCheck = { command: string } | { reason: ManualCheck["reason"] };

/** Pure: the same acceptance list always yields the same commands, in the same order. */
export function gateCommands(acceptance: readonly string[]): AcceptancePlan {
  const runnable: RunnableCheck[] = [];
  const manual: ManualCheck[] = [];
  const seen = new Set<string>();

  const add = (check: RunnableCheck) => {
    if (seen.has(check.command)) return;
    seen.add(check.command);
    runnable.push(check);
  };

  for (const raw of acceptance) {
    const source = raw.trim();
    if (!source) continue;
    const line = stripMarkers(source);
    if (!line) continue;

    const file = matchFile(line);
    if (file === "invalid") {
      manual.push({ source, reason: "unsafe" });
      continue;
    }
    if (file) {
      add({ source, kind: "file", command: `test -${file.flag} '${file.path}'` });
      continue;
    }

    const spans = [...line.matchAll(BACKTICKED)].map((m) => (m[1] ?? "").trim()).filter(Boolean);
    if (spans.length > 0) {
      const parsed = spans.map(classifyCommand);
      if (parsed.every((p): p is { command: string } => "command" in p)) {
        for (const p of parsed) add({ source, kind: "command", command: p.command });
      } else {
        const unsafe = parsed.some((p) => !("command" in p) && p.reason === "unsafe");
        manual.push({ source, reason: unsafe ? "unsafe" : "not-a-command" });
      }
      continue;
    }

    const direct = classifyCommand(line);
    if ("command" in direct) add({ source, kind: "command", command: direct.command });
    else manual.push({ source, reason: direct.reason });
  }

  return { runnable, manual };
}

function stripMarkers(line: string): string {
  let value = line;
  for (;;) {
    const next = value.replace(CHECKBOX, "").replace(BULLET, "").replace(PROMPT, "").trim();
    if (next === value) return value;
    value = next;
  }
}

function matchFile(line: string): FileCheck | "invalid" | null {
  const test = TEST_FILE.exec(line);
  const bracket = test ? null : BRACKET_FILE.exec(line);
  const prose = test || bracket ? null : PROSE_FILE.exec(line);
  const backticked = test || bracket || prose ? null : BACKTICKED_FILE.exec(line);

  let raw: string | undefined;
  let flag: "f" | "e" = "f";
  const explicit = test ?? bracket;
  if (explicit) {
    flag = explicit[1] === "e" ? "e" : "f";
    raw = explicit[2] ?? explicit[3] ?? explicit[4];
  } else if (prose) {
    raw = prose[1];
  } else if (backticked) {
    raw = backticked[1];
  } else {
    return null;
  }

  const path = safePath(raw ?? "");
  return path ? { path, flag } : "invalid";
}

/** Repo-relative, no traversal, no flag-like names: safe to wrap in single quotes. */
function safePath(raw: string): string | null {
  const path = raw.trim().replace(/^\.\//, "");
  if (!path || path.length > MAX_PATH_LENGTH) return null;
  if (!SAFE_PATH.test(path)) return null;
  if (path.startsWith("/") || path.startsWith("-") || path.startsWith("~")) return null;
  if (path.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    return null;
  }
  return path;
}

function classifyCommand(raw: string): CommandCheck {
  const command = raw.trim().replace(/\s+/g, " ");
  if (!command) return { reason: "not-a-command" };
  if (command.length > MAX_COMMAND_LENGTH) return { reason: "unsafe" };
  if (SHELL_METACHARACTERS.test(command) || CONTROL_CHARACTERS.test(command)) {
    return { reason: "unsafe" };
  }
  if (QUOTES.test(command)) return { reason: "unsafe" };

  const tokens = command.split(" ");
  const head = tokens[0] ?? "";
  if (!COMMAND_HEADS.has(head)) return { reason: "not-a-command" };

  // Python is only trusted for a syntax check; running an arbitrary script is not a gate we know.
  if (
    (head === "python" || head === "python3") &&
    (tokens[1] !== "-m" || tokens[2] !== "py_compile")
  ) {
    return { reason: "not-a-command" };
  }

  return { command };
}
