"use client";

import { Check, Link2, Loader2, RotateCcw, Scissors, Undo2 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { shareUrl } from "@/components/export-actions";
import type { ResplitController } from "@/components/resplit/use-resplit";
import { Button } from "@/components/ui/button";
import type { ResplitView } from "@/lib/client/resplit";
import { formatMinutes, plural, shortPath } from "@/lib/format";
import type { PlanReport } from "@/lib/plan/events";
import type { Plan } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = { controller: ResplitController; report: PlanReport | null };

/**
 * The edit strip above the graph: live scores, undo/reset, and saving the edited plan through the
 * same `/p/[id]` share page the planner already uses.
 */
export function ResplitToolbar({ controller, report }: Props) {
  const { view } = controller;
  const [saving, setSaving] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!view) return null;

  const labels = controller.context.labels;
  const preview = controller.preview;
  const collisionScore = preview ? controller.claimScore : view.collisionScore;

  const save = async () => {
    if (!report || saving) return;
    setSaving(true);
    setError(null);
    setLink(null);
    setCopied(false);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ report: editedReport(report, view) }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !data.id) throw new Error(data.error ?? "Could not save this plan.");
      const url = shareUrl({ ...editedPlan(report.plan, view), id: data.id });
      setLink(url);
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      } catch {
        // The link is on screen; the clipboard may be unavailable outside a secure context.
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this plan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      role="region"
      aria-label="Re-split controls"
      data-testid="resplit-toolbar"
      className="border-border bg-card/60 mt-4 rounded-2xl border px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="border-fire-amber/30 bg-fire-amber/[0.08] text-fire-amber flex size-8 shrink-0 items-center justify-center rounded-xl border">
            <Scissors className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="font-display text-sm font-semibold tracking-[-0.01em]">
              Re-<span className="serif-accent">split</span> plan
            </div>
            <p className="text-muted-foreground truncate text-[11px]">
              Drag a file onto another task, or use “Move to task…” on each file.
            </p>
          </div>
        </div>

        <dl className="flex items-center gap-4 sm:gap-6">
          <Stat
            label="Collisions"
            testId="resplit-collisions"
            value={collisionScore}
            tone={collisionScore > 0 ? "red" : "green"}
            pulse={Boolean(preview)}
          />
          <Stat
            label="Critical path"
            testId="resplit-critical"
            value={formatMinutes(view.criticalPathMinutes)}
          />
          <Stat label="Speedup" testId="resplit-speedup" value={`${view.metrics.speedup}×`} />
          <Stat label="Moves" testId="resplit-moves" value={plural(controller.moves, "move")} />
        </dl>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={controller.undo}
            disabled={!controller.canUndo}
            aria-label="Undo last move"
            className="h-8"
          >
            <Undo2 /> Undo
            <kbd className="text-muted-foreground ml-0.5 hidden font-mono text-[10px] lg:inline">
              ⌘Z
            </kbd>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={controller.reset}
            disabled={!controller.edited}
            className="h-8"
          >
            <RotateCcw /> Reset to original plan
          </Button>
          <Button size="sm" onClick={save} disabled={!report || saving} className="h-8">
            {saving ? <Loader2 className="animate-spin" /> : link ? <Check /> : <Link2 />}
            {saving
              ? "Saving…"
              : copied
                ? "Link copied"
                : link
                  ? "Link ready"
                  : "Save as share link"}
          </Button>
        </div>
      </div>

      {(controller.lastMove || preview || link || error) && (
        <div
          className="border-border/70 text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-2 text-xs"
          aria-live="polite"
        >
          {preview && (
            <span className="text-fire-red animate-pulse" data-testid="resplit-preview">
              Overlap preview: <span className="font-mono">{shortPath(preview.file, 40)}</span>{" "}
              would have 2 owners · drop to resolve
            </span>
          )}
          {controller.lastMove && !preview && (
            <span data-testid="resplit-last-move">
              Moved{" "}
              <span className="text-foreground font-mono">
                {shortPath(controller.lastMove.file, 40)}
              </span>{" "}
              {controller.lastMove.from.length > 0
                ? `from ${controller.lastMove.from.map((id) => labels.get(id) ?? id).join(", ")} `
                : ""}
              to{" "}
              <span className="text-foreground">
                {labels.get(controller.lastMove.to) ?? controller.lastMove.to}
              </span>
            </span>
          )}
          {link && (
            <a
              className="text-fire-amber hover:underline"
              href={link}
              target="_blank"
              rel="noreferrer"
              data-testid="resplit-link"
            >
              {copied ? "New share link copied" : "Open new share link"}
            </a>
          )}
          {error && (
            <span role="alert" className="text-fire-red">
              {error}
            </span>
          )}
        </div>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  tone = "plain",
  pulse,
  testId,
}: {
  label: string;
  value: string | number;
  tone?: "plain" | "red" | "green";
  pulse?: boolean;
  testId?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-[10px] font-medium tracking-[0.14em] uppercase">
        {label}
      </dt>
      <dd
        data-testid={testId}
        className={cn(
          "font-display text-base font-extrabold tracking-[-0.02em] tabular-nums",
          tone === "red" && "text-fire-red animate-pulse",
          tone === "green" && "text-ok-green",
          pulse && "animate-pulse",
        )}
      >
        <motion.span
          key={String(value)}
          initial={reduce ? false : { opacity: 0.35, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {value}
        </motion.span>
      </dd>
    </div>
  );
}

/** The plan with edited ownership, effort and schedule, before it is assigned a share id. */
export function editedPlan(plan: Plan, view: ResplitView): Plan {
  return {
    ...plan,
    tasks: view.tasks,
    collisionScore: view.collisionScore,
    serialMinutes: view.metrics.serialMinutes,
    parallelMinutes: view.metrics.parallelMinutes,
    speedup: view.metrics.speedup,
    agents: view.metrics.agents,
  };
}

/** A stored plan report that reflects the edits, ready for the share page. */
export function editedReport(report: PlanReport, view: ResplitView): PlanReport {
  return { ...report, plan: editedPlan(report.plan, view), criticalPath: view.criticalPath };
}
