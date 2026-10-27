import { CliError } from "./errors";

export type Command = "plan" | "help" | "version";

export type CliOptions = {
  command: Command;
  request: string;
  repo?: string;
  agents: number;
  out: string;
  mock: boolean;
  offline: boolean;
};

export const DEFAULT_AGENTS = 2;
export const DEFAULT_OUT = ".splitfire";
const MAX_AGENTS = 64;

const VALUE_OPTIONS = new Set(["--repo", "--agents", "--out"]);

/**
 * Parses `splitfire plan "<request>" [options]`. Pure: it never touches the filesystem or
 * process state, so every branch is unit-testable.
 */
export function parseArgs(argv: readonly string[]): CliOptions {
  const args = [...argv];
  let command: Command = "help";
  let request = "";
  let repo: string | undefined;
  let agents = DEFAULT_AGENTS;
  let out = DEFAULT_OUT;
  let mock = false;
  let offline = false;
  let sawCommand = false;
  const positionals: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string;

    if (arg === "-h" || arg === "--help") return base({ command: "help" });
    if (arg === "-v" || arg === "--version") return base({ command: "version" });

    if (arg === "--mock") {
      mock = true;
      continue;
    }
    if (arg === "--offline") {
      offline = true;
      continue;
    }

    const [name, inline] = splitOption(arg);
    if (name !== null) {
      if (!VALUE_OPTIONS.has(name)) {
        throw new CliError(`Unknown option ${name}. Run npx splitfire --help.`);
      }
      let value = inline;
      if (value === undefined) {
        const next = args[i + 1];
        if (next === undefined || (next.startsWith("-") && next !== "-")) {
          throw new CliError(`Option ${name} needs a value.`);
        }
        value = next;
        i++;
      }
      if (name === "--repo") repo = nonEmpty(name, value);
      else if (name === "--out") out = nonEmpty(name, value);
      else agents = parseAgents(value);
      continue;
    }

    if (!sawCommand) {
      if (arg === "help") return base({ command: "help" });
      if (arg === "version") return base({ command: "version" });
      if (arg !== "plan") {
        throw new CliError(`Unknown command "${arg}". Run npx splitfire --help.`);
      }
      command = "plan";
      sawCommand = true;
      continue;
    }
    positionals.push(arg);
  }

  if (command !== "plan") return base({ command: "help" });
  request = positionals.join(" ").trim();
  if (!request) {
    throw new CliError('Missing request. Usage: npx splitfire plan "<request>"');
  }
  if (out === "/" || out === ".") {
    throw new CliError("--out must name a pack directory, not the repo root.");
  }

  return { command, request, repo, agents, out, mock, offline };

  function base(values: Partial<CliOptions>): CliOptions {
    return {
      command: values.command ?? "help",
      request: "",
      agents: DEFAULT_AGENTS,
      out: DEFAULT_OUT,
      mock: false,
      offline: false,
    };
  }
}

/** `--repo=x` -> ["--repo", "x"]; anything not starting with `--` -> [null, undefined]. */
function splitOption(arg: string): [string | null, string | undefined] {
  if (!arg.startsWith("--")) return [null, undefined];
  const eq = arg.indexOf("=");
  if (eq === -1) return [arg, undefined];
  return [arg.slice(0, eq), arg.slice(eq + 1)];
}

function nonEmpty(name: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new CliError(`Option ${name} needs a value.`);
  return trimmed;
}

function parseAgents(raw: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > MAX_AGENTS) {
    throw new CliError(`--agents must be a whole number between 1 and ${MAX_AGENTS}.`);
  }
  return value;
}
