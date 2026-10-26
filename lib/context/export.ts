import { modelTier } from "@/lib/cost/estimate";
import { speedupLine } from "@/lib/format";
import { taskLabels, waves } from "@/lib/partition/waves";
import type { Plan, Task } from "@/lib/types";

export type ExportOptions = { shareUrl?: string };

/** A self-contained, Alan-ready prompt for one task. */
export function taskPrompt(task: Task, plan: Plan, opts: ExportOptions = {}): string {
  const labels = taskLabels(plan.tasks);
  const label = labels.get(task.id) ?? task.id;
  const byId = new Map(plan.tasks.map((t) => [t.id, t]));
  const deps = task.dependsOn.map((d) => byId.get(d)).filter((t): t is Task => Boolean(t));

  const lines = [
    `# ${label} · ${task.title}`,
    "",
    `Repo: ${plan.repo} @ ${plan.sha.slice(0, 7)} · Branch: \`splitfire/${task.id}\``,
    `Overall feature: ${plan.request}`,
    ...(opts.shareUrl ? [`Plan: ${opts.shareUrl}`] : []),
    `Suggested model: ${modelTier(task.difficulty)} model (${task.model}) · Estimate: ${task.estMinutes} min`,
    "",
    "## Goal",
    task.goal,
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
  );
  return lines.join("\n") + "\n";
}

/** Every task prompt in wave order, separated for pasting into several agents. */
export function allPrompts(plan: Plan, opts: ExportOptions = {}): string {
  return orderedTasks(plan)
    .map((t) => taskPrompt(t, plan, opts))
    .join("\n---\n\n");
}

/** The `.splitfire/` folder: an overview, one prompt file per task and the plan JSON. */
export function splitfirePack(plan: Plan, opts: ExportOptions = {}): Record<string, string> {
  const labels = taskLabels(plan.tasks);
  const files: Record<string, string> = {
    ".splitfire/README.md": overview(plan, opts),
    ".splitfire/plan.json": JSON.stringify(plan, null, 2) + "\n",
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
    "Run each wave in parallel, one agent per task, each on its own `splitfire/<task-id>` branch.",
    "Start a wave when every task it waits for is merged. Every file has exactly one owner.",
    "",
    "| Task | Wave | Kind | Title | Files | Waits for | Model | Estimate |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows.filter(Boolean),
    "",
    "Prompts for each task are in `tasks/`. The full plan is in `plan.json`.",
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
