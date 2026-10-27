import { modelTier } from "@/lib/cost/estimate";
import { plural, speedupLine } from "@/lib/format";
import { GATES_WORKFLOW_PATH, generateGatesWorkflow } from "@/lib/gates/workflow";
import { taskLabels, waves } from "@/lib/partition/waves";
import type { Plan, Task } from "@/lib/types";

export type ExportOptions = { shareUrl?: string };

/** The branch a task's agent works on: one branch per task id. */
export function taskBranch(task: Pick<Task, "id">): string {
  return `splitfire/${task.id}`;
}

/** The sibling worktree each agent uses, next to the repo checkout. */
export function taskWorktree(plan: Pick<Plan, "repo">, task: Pick<Task, "id">): string {
  return `../${repoName(plan.repo)}-${task.id}`;
}

/** A self-contained, Alan-ready prompt for one task. */
export function taskPrompt(task: Task, plan: Plan, opts: ExportOptions = {}): string {
  const labels = taskLabels(plan.tasks);
  const label = labels.get(task.id) ?? task.id;
  const byId = new Map(plan.tasks.map((t) => [t.id, t]));
  const deps = task.dependsOn.map((d) => byId.get(d)).filter((t): t is Task => Boolean(t));
  const branch = taskBranch(task);
  const worktree = taskWorktree(plan, task);

  const lines = [
    `# ${label} · ${task.title}`,
    "",
    `Repo: ${plan.repo} @ ${plan.sha.slice(0, 7)} · Branch: \`${branch}\``,
    `Overall feature: ${plan.request}`,
    ...(opts.shareUrl ? [`Plan: ${opts.shareUrl}`] : []),
    `Suggested model: ${modelTier(task.difficulty)} model (${task.model}) · Estimate: ${task.estMinutes} min`,
    "",
    "## Goal",
    task.goal,
    "",
    "## Start (run from the repo root)",
    "```sh",
    `git worktree add ${worktree} -b ${branch}`,
    `cd ${worktree}`,
    "```",
    "",
    "Work only in this worktree. Every edit, check and commit in this session belongs to this task.",
    "",
    "## Files you own (edit only these)",
    ...task.ownedFiles.map((f) => `- \`${f}\``),
  ];
  if (task.readFiles.length > 0) {
    lines.push(
      "",
      "## Context pack (read-only, do not edit)",
      ...task.readFiles.map((f) => `- \`${f}\``),
    );
  }
  if (deps.length > 0) {
    lines.push(
      "",
      "## Before you start",
      ...deps.map(
        (d) =>
          `- Wait for ${labels.get(d.id) ?? d.id} (${d.title}) to be merged${d.kind === "contract" ? `; build against the shared contracts in ${d.ownedFiles.map((f) => `\`${f}\``).join(", ")}` : ""}.`,
      ),
    );
  }
  lines.push(
    "",
    "## Done when",
    ...task.acceptance.map((a) => `- [ ] \`${a}\``),
    "",
    "## Rules",
    "- Change only the files you own. Other agents are editing the rest of the repo in parallel.",
    "- If you truly need to change a file you do not own, stop and report it instead of editing it.",
    "- Keep the change focused on the goal; no drive-by refactors.",
    '- Commit with a plain message and no AI attribution trailers: no `Co-Authored-By`, no "Generated with" line, no tool names.',
    `- Push the branch: \`git push -u origin ${branch}\`. Push \`${branch}\`, do not merge.`,
  );
  return lines.join("\n") + "\n";
}

export type PlannedWave = { index: number; tasks: Task[] };

/** Tasks grouped by dependency depth, in the order their prompts run. */
export function planWaves(plan: Plan): PlannedWave[] {
  const byId = new Map(plan.tasks.map((t) => [t.id, t]));
  return waves(plan.tasks).map((wave) => ({
    index: wave.index,
    tasks: wave.ids.map((id) => byId.get(id)).filter((t): t is Task => Boolean(t)),
  }));
}

/**
 * One paste-ready block for a whole wave. Start a session per task and paste that task's block;
 * the separators say which session each block belongs to.
 */
export function wavePrompts(plan: Plan, waveIndex: number, opts: ExportOptions = {}): string {
  const wave = planWaves(plan).find((w) => w.index === waveIndex);
  if (!wave) return "";
  const labels = taskLabels(plan.tasks);
  const sessions = wave.tasks.map((task, i) =>
    [
      `=== SESSION ${i + 1} of ${wave.tasks.length} · ${labels.get(task.id) ?? task.id} · paste into its own Alan session ===`,
      "",
      taskPrompt(task, plan, opts).trimEnd(),
    ].join("\n"),
  );
  return [
    `# Wave ${wave.index + 1} · ${plural(wave.tasks.length, "task")} in parallel`,
    "",
    "Open your repo in Alan, start one session per task, and paste each block below into its own session.",
    "",
    ...sessions,
  ].join("\n\n");
}

function repoName(repo: string): string {
  return repo.split("/").filter(Boolean).at(-1) ?? "repo";
}

/** Every task prompt in wave order, separated for pasting into several agents. */
export function allPrompts(plan: Plan, opts: ExportOptions = {}): string {
  return orderedTasks(plan)
    .map((t) => taskPrompt(t, plan, opts))
    .join("\n---\n\n");
}

/** The `.splitfire/` folder plus the gate workflow: an overview, one prompt per task, the plan
 * JSON, and the GitHub Actions file that runs each task's acceptance checks on push. */
export function splitfirePack(plan: Plan, opts: ExportOptions = {}): Record<string, string> {
  const labels = taskLabels(plan.tasks);
  const files: Record<string, string> = {
    ".splitfire/README.md": overview(plan, opts),
    ".splitfire/plan.json": JSON.stringify(plan, null, 2) + "\n",
    [GATES_WORKFLOW_PATH]: generateGatesWorkflow(plan),
  };
  for (const task of orderedTasks(plan)) {
    files[`.splitfire/tasks/${labels.get(task.id)}-${task.id}.md`] = taskPrompt(task, plan, opts);
  }
  return files;
}

function overview(plan: Plan, opts: ExportOptions): string {
  const labels = taskLabels(plan.tasks);
  const byId = new Map(plan.tasks.map((t) => [t.id, t]));
  const rows = waves(plan.tasks).flatMap((w) =>
    w.ids.map((id) => {
      const t = byId.get(id);
      if (!t) return "";
      const after = t.dependsOn.map((d) => labels.get(d) ?? d).join(", ") || "—";
      return `| ${labels.get(id)} | ${w.index + 1} | ${t.kind} | ${t.title} | ${t.ownedFiles.length} | ${after} | ${modelTier(t.difficulty)} | ${t.estMinutes} min |`;
    }),
  );
  return [
    `# Splitfire plan: ${plan.request}`,
    "",
    `Repo: ${plan.repo} @ ${plan.sha.slice(0, 7)}${opts.shareUrl ? ` · ${opts.shareUrl}` : ""}`,
    "",
    `${speedupLine(plan)} · collision score ${plan.collisionScore} · est. cost $${plan.totalCostUsd.toFixed(3)}`,
    "",
    "Run each wave in parallel, one agent per task, each on its own `splitfire/T<n>` branch.",
    "Start a wave when every task it waits for is merged. Every file has exactly one owner.",
    "",
    "| Task | Wave | Kind | Title | Files | Waits for | Model | Estimate |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows.filter(Boolean),
    "",
    "Prompts for each task are in `tasks/`. The full plan is in `plan.json`.",
    "",
    "## How done-checks work",
    "",
    "This pack includes `.github/workflows/splitfire-gates.yml`. Commit it next to `.splitfire/`.",
    "Push a task branch named `splitfire/Tn` (T0 is the first task above) and the workflow:",
    "",
    "- validates the branch name against `^T[0-9]+$` and finds that task in `plan.json`;",
    "- turns the task's acceptance list into commands, accepting known tools (npm, pnpm, yarn,",
    "  npx, vitest, playwright, pytest, tsc, go, cargo) and file-exists checks only;",
    "- runs those commands and reports a check run named `splitfire/Tn` on the pushed commit,",
    "  with `success` or `failure` and a short summary.",
    "",
    "Checks the parser cannot run (for example `git diff touches only owned files`) are listed as",
    "manual in the summary and never executed. Commands only ever come from `plan.json`; commit",
    "messages and branch names are never executed.",
    "",
  ].join("\n");
}

function orderedTasks(plan: Plan): Task[] {
  const byId = new Map(plan.tasks.map((t) => [t.id, t]));
  return waves(plan.tasks)
    .flatMap((w) => w.ids)
    .map((id) => byId.get(id))
    .filter((t): t is Task => Boolean(t));
}
