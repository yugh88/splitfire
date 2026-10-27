"use client";

import { useEffect, useState } from "react";
import { CostMeter } from "@/components/mission-control/cost-meter";
import { StatusBadge, TRACK } from "@/components/mission-control/status-badge";
import { Switch } from "@/components/ui/switch";
import type { Metrics, PlannerKind } from "@/lib/plan/events";
import type { TaskStatus, TaskTrack } from "@/lib/track/types";
import { cn } from "@/lib/utils";

type Props = {
  planId: string | null;
  tracks: TaskTrack[] | null;
  labels: Map<string, string>;
  live: boolean;
  ready: boolean;
  onToggle: () => void;
  metrics?: Metrics | null;
  planner?: PlannerKind | null;
};

const COUNTERS: TaskStatus[] = ["working", "checking", "passed", "failed", "merged"];

/** Live roll-up of every task branch: spend, counts, per-task badges and elapsed time. */
export function MissionControl({
  planId,
  tracks,
  labels,
  live,
  ready,
  onToggle,
  metrics,
  planner,
}: Props) {
  const counts = countStatuses(tracks ?? []);
  const startedAt = useElapsedStart(planId, tracks);
  const allMerged =
    tracks !== null && tracks.length > 0 && tracks.every((t) => t.status === "merged");
  const elapsed = useElapsed(startedAt, allMerged);

  return (
    <section
      aria-label="Mission control"
      className="border-border bg-card/60 mt-4 rounded-2xl border px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.16em] uppercase">
          Mission control
        </span>
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <Switch
            size="sm"
            checked={live}
            onCheckedChange={onToggle}
            disabled={!planId || !ready}
            aria-label="Track live"
          />
          Track live
        </label>
        {ready ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {COUNTERS.map((status) => (
              <span
                key={status}
                className={cn(
                  "inline-flex items-center gap-1.5 font-mono text-xs",
                  TRACK[status].text,
                )}
              >
                <span className="size-2 rounded-full bg-current" aria-hidden />
                {counts[status]} {TRACK[status].label.toLowerCase()}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground font-mono text-xs">checking GitHub…</span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
          {metrics && planner && (
            <CostMeter
              agents={metrics.agents}
              speedup={metrics.speedup}
              totalCostUsd={metrics.totalCostUsd}
              planner={planner}
            />
          )}
          <span className="text-muted-foreground font-mono text-xs">elapsed {elapsed}</span>
        </div>
      </div>
      {tracks && tracks.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tracks.map((track) => (
            <StatusBadge
              key={track.taskId}
              status={track.status}
              label={labels.get(track.taskId) ?? track.taskId}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function countStatuses(tracks: TaskTrack[]): Record<TaskStatus, number> {
  const counts: Record<TaskStatus, number> = {
    waiting: 0,
    working: 0,
    checking: 0,
    passed: 0,
    failed: 0,
    merged: 0,
  };
  for (const track of tracks) counts[track.status] += 1;
  return counts;
}

/** Remembers when tracking first saw a task leave `waiting`, so reloads keep the clock. */
function useElapsedStart(planId: string | null, tracks: TaskTrack[] | null): number | null {
  const [startedAt, setStartedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!planId || !tracks?.some((track) => track.status !== "waiting")) return;
    const key = `splitfire:track:start:${planId}`;
    let start = Number(window.localStorage.getItem(key));
    if (!Number.isFinite(start) || start <= 0) {
      start = Date.now();
      window.localStorage.setItem(key, String(start));
    }
    setStartedAt((current) => current ?? start);
  }, [planId, tracks]);

  return startedAt;
}

function useElapsed(startedAt: number | null, frozen: boolean): string {
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (startedAt === null) return;
    setNow(Date.now());
    if (frozen) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAt, frozen]);

  if (startedAt === null || now === 0) return "—";
  return formatElapsed(now - startedAt);
}

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${minutes}:${seconds}`;
}
