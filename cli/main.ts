import pkg from "../package.json";
import { modelTier } from "@/lib/cost/estimate";
import { config } from "@/lib/env";
import { formatMinutes, formatTokens, formatUsd, plural, speedupLine } from "@/lib/format";
import { BUDGET_NOTICE, NO_MODEL_NOTICE, llmConfigured } from "@/lib/plan/planner";
import { taskLabels } from "@/lib/partition/waves";
import type { Plan } from "@/lib/types";
import { DEFAULT_AGENTS, DEFAULT_OUT, parseArgs, type CliOptions } from "./args";
import { CliError } from "./errors";
import { normalizeOut, packPaths, writePack } from "./pack";
import { buildPlan, loadAnalysis, MODEL_UNAVAILABLE_NOTICE } from "./plan";
import { pad, truncate, ui } from "./ui";

export type MainOptions = { cwd?: string };

/** CLI entry point: returns the process exit code. 0 ok, 1 user error, 2 internal error. */
export async function main(
  argv: readonly string[] = process.argv.slice(2),
  opts: MainOptions = {},
): Promise<number> {
  let options: CliOptions;
  try {
    options = parseArgs(argv);
  } catch (error) {
    return reportError(error);
  }

  if (options.command === "help") {
    printHelp();
    return 0;
  }
  if (options.command === "version") {
    console.log(`splitfire ${pkg.version}`);
    return 0;
  }

  try {
    return await runPlan(options, opts.cwd ?? process.cwd());
  } catch (error) {
    return reportError(error);
  }
}

async function runPlan(options: CliOptions, cwd: string): Promise<number> {
  const cfg = config();
  const mode = options.repo ? "remote" : "local";
  const useModel = !options.offline && !options.mock && llmConfigured(cfg);
  const out = normalizeOut(options.out);

  console.log("");
  console.log(`${ui.bold("splitfire")} ${ui.dim("· split the work, not the codebase")}`);
  console.log(`  ${ui.dim(pad("request", 9))}${options.request}`);
  console.log(
    `  ${ui.dim(pad("mode", 9))}${
      mode === "local"
        ? `${ui.green("local")} · private: file contents never leave this machine`
        : `${ui.yellow("remote")} · GitHub via --repo`
    }${options.offline ? ui.dim(" · offline") : ""}`,
  );
  console.log(
    `  ${ui.dim(pad("planner", 9))}${
      useModel ? `model · ${cfg.plannerModel || cfg.fastModel}` : "deterministic"
    } · ${plural(options.agents, "agent")}`,
  );

  const { analysis } = await loadAnalysis({
    repo: options.repo,
    cwd,
    out: options.out,
    cfg,
  });

  console.log(
    `  ${ui.dim(pad("repo", 9))}${analysis.repo} ${ui.dim(`@ ${analysis.sha.slice(0, 7)}`)} · ${analysis.files.length} files analyzed · ${analysis.skipped} skipped${
      analysis.truncated ? " · capped" : ""
    }`,
  );
  console.log("");

  let proposed = 0;
  const result = await buildPlan({
    analysis,
    request: options.request,
    agents: options.agents,
    offline: options.offline,
    mock: options.mock,
    cfg,
    onModelCall: (model) => {
      console.log(
        mode === "local"
          ? `${ui.cyan("Privacy:")} local mode sends only file paths, the import graph and your request to ${model}. No file contents leave this machine.`
          : `${ui.cyan("Privacy:")} the planner receives only file paths, the import graph and your request (${model}).`,
      );
      console.log("");
    },
    onProposal: (task) => {
      proposed++;
      console.log(
        `  ${ui.dim("·")} ${task.id} ${ui.dim(`(${plural(task.ownedFiles.length, "file")})`)}`,
      );
    },
    onNotice: (message) => console.log(`${ui.yellow("Note:")} ${message}`),
  });

  // The deterministic planner is silent above, so show its proposals too.
  if (proposed === 0) {
    result.plan.tasks.forEach((task) =>
      console.log(
        `  ${ui.dim("·")} ${task.id} ${ui.dim(`(${plural(task.ownedFiles.length, "file")})`)}`,
      ),
    );
  }

  const notice = describeNotice(result.notice);
  if (notice) console.log(`${ui.yellow("Note:")} ${notice}`);

  console.log("");
  printTasks(result.plan);
  console.log("");
  printMetrics(result);
  console.log("");

  const written = writePack(cwd, packPaths(result.plan, options.out));
  const packLabel = out === ".splitfire" ? ".splitfire/" : `${out}/`;
  console.log(
    `  ${ui.dim(pad("Wrote", 17))}${plural(written.length, "file")} under ${ui.bold(packLabel)}`,
  );
  for (const file of written) console.log(`  ${" ".repeat(17)}${file}`);
  console.log("");
  return 0;
}

function printTasks(plan: Plan): void {
  const labels = taskLabels(plan.tasks);
  console.log(ui.bold("Tasks"));
  for (const task of plan.tasks) {
    const label = labels.get(task.id) ?? task.id;
    const deps = task.dependsOn.length > 0 ? `waits ${task.dependsOn.join(", ")}` : "";
    console.log(
      `  ${ui.bold(pad(label, 4))}${pad(truncate(task.title, 34), 35)}${pad(
        plural(task.ownedFiles.length, "file"),
        10,
      )}${pad(task.kind, 9)}${pad(`${modelTier(task.difficulty)} model`, 13)}${pad(
        formatMinutes(task.estMinutes),
        7,
      )}${ui.dim(deps)}`.trimEnd(),
    );
  }
}

function printMetrics(result: {
  plan: Plan;
  collisionScoreBefore: number;
  repairs: unknown[];
}): void {
  const { plan } = result;
  const label = (text: string) => `  ${ui.dim(pad(text, 17))}`;
  const repaired = result.collisionScoreBefore - plan.collisionScore;
  const score = plan.collisionScore === 0 ? ui.green("0") : ui.red(String(plan.collisionScore));
  const repairNote =
    result.collisionScoreBefore > 0
      ? ui.dim(` (${repaired} repaired from ${result.collisionScoreBefore})`)
      : "";

  console.log(ui.bold("Result"));
  console.log(`${label("Collision score")}${score}${repairNote}`);
  console.log(`${label("Speedup")}${speedupLine(plan)}`);
  console.log(
    `${label("Context")}${formatTokens(plan.tokensWithPacks)} tokens with packs · ${formatTokens(
      plan.tokensFullRepo,
    )} full-repo baseline`,
  );
  console.log(`${label("Estimated cost")}${formatUsd(plan.totalCostUsd)}`);
}

function describeNotice(notice: string | null): string | null {
  if (!notice) return null;
  if (notice === NO_MODEL_NOTICE) {
    return "No model configured (OPENMODEL_BASE_URL, OPENMODEL_API_KEY, PLANNER_MODEL, FAST_MODEL); using the deterministic planner.";
  }
  if (notice === BUDGET_NOTICE) {
    return "Model budget reached; using the deterministic planner.";
  }
  if (notice === MODEL_UNAVAILABLE_NOTICE) {
    return "Model configured but no usable price is set (MODEL_PRICES_JSON); using the deterministic planner.";
  }
  return notice;
}

function reportError(error: unknown): number {
  if (error instanceof CliError) {
    console.error(`${ui.red("splitfire:")} ${error.message}`);
    return error.exitCode;
  }
  const message = error instanceof Error ? error.message : String(error);
  console.error(`${ui.red("splitfire: internal error:")} ${message}`);
  if (process.env.SPLITFIRE_DEBUG === "1" && error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  return 2;
}

function printHelp(): void {
  const lines = [
    "",
    `${ui.bold("splitfire")} ${ui.dim("· split the work, not the codebase")}`,
    "",
    ui.bold("Usage"),
    '  npx splitfire plan "<request>" [options]',
    "",
    ui.bold("Options"),
    `  --repo <url>      Plan a GitHub repo instead of the current directory`,
    `  --agents <n>      Parallel agents (default ${DEFAULT_AGENTS})`,
    `  --out <dir>       Pack directory (default ${DEFAULT_OUT})`,
    "  --mock            Skip model calls; use the deterministic planner",
    "  --offline         Never touch the network; use the deterministic planner",
    "  -h, --help        Show this help",
    "  -v, --version     Show the version",
    "",
    ui.bold("Local mode (default)"),
    "  Reads files from disk, respects .gitignore, and skips node_modules, vendored,",
    "  generated and lock files with the same size caps as the web app.",
    "",
    `  ${ui.green("Privacy:")} in local mode, file contents NEVER leave your machine.`,
    "  Only file paths, the import graph and your request may be sent to the model.",
    "  --offline sends nothing at all.",
    "",
    ui.bold("Model environment"),
    "  OPENMODEL_BASE_URL, OPENMODEL_API_KEY, PLANNER_MODEL, FAST_MODEL",
    "  Without them (or with --offline), Splitfire uses the deterministic planner.",
    "",
    ui.bold("Exit codes"),
    "  0 ok · 1 user error · 2 internal error",
    "",
  ];
  console.log(lines.join("\n"));
}
