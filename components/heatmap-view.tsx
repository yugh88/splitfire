"use client";

import { ArrowRight } from "lucide-react";
import { Annotation } from "@/components/annotation";
import type { Wave } from "@/lib/client/graph-model";
import type { PlanEventData } from "@/lib/plan/events";
import type { Metrics } from "@/lib/plan/events";
import { describeRepair } from "@/lib/partition/repairs";
import { formatMinutes, plural, shortPath } from "@/lib/format";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_ROWS = 12;

type Props = {
  partitioned: PlanEventData<"partitioned">;
  metrics: Metrics;
  waves: Wave[];
  labels: Map<string, string>;
};

/** The demo moment: the model's overlapping draft vs. the repaired, one-owner-per-file plan. */
export function HeatmapView({ partitioned, metrics, waves, labels }: Props) {
  const { draft, tasks, collisions } = partitioned;
  const letters = new Map(draft.map((d, i) => [d.id, String.fromCharCode(65 + (i % 26))]));
  const claimants = new Map(collisions.map((c) => [c.file, c.tasks.length]));
  const owner = new Map(tasks.flatMap((t) => t.ownedFiles.map((f) => [f, t] as const)));

  const contested = collisions.map((c) => c.file);
  const others = [...new Set(draft.flatMap((d) => d.ownedFiles))]
    .filter((f) => !claimants.has(f))
    .sort();
  const files = [...contested, ...others];
  const rows = files.slice(0, MAX_ROWS);
  const ordered = waves
    .flatMap((w) => w.ids)
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is Task => Boolean(t));
  const label = (id: string) => labels.get(id) ?? letters.get(id) ?? id;

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-fire-orange text-[10px] font-semibold tracking-[0.18em] uppercase">
            THE DEMO MOMENT
          </p>
          <h2 className="font-display mt-1 mb-2 text-[clamp(1.7rem,3vw,2.25rem)] font-extrabold tracking-[-0.03em]">
            Collision <span className="serif-accent">heatmap</span>
          </h2>
          <p className="text-muted-foreground max-w-xl text-sm">
            The model&apos;s draft plan can have agents fighting over the same files.
            Splitfire&apos;s deterministic partitioner repairs it before a single agent starts.
          </p>
        </div>
        <div className="border-border rounded-2xl border bg-white/[0.02] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="flex items-center gap-4">
            <Score label="Draft" value={partitioned.collisionScoreBefore} tone="text-fire-red" />
            <ArrowRight className="text-muted-foreground size-4" />
            <Score label="Repaired" value={partitioned.collisionScore} tone="text-ok-green" />
            <span className="text-muted-foreground max-w-28 text-[11px]">
              collision score · files with 2+ owners
            </span>
          </div>
          <Annotation arrow="left" className="mt-1 hidden md:inline-flex">
            draft → repaired
          </Annotation>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Matrix
          title="Draft plan from the model"
          tone="red"
          columns={draft.map((d) => ({ id: d.id, label: letters.get(d.id) ?? "?" }))}
          rows={rows}
          cell={(file, id) => {
            if (!draft.find((d) => d.id === id)?.ownedFiles.includes(file)) return null;
            const n = claimants.get(file) ?? 1;
            return n > 1
              ? { text: `×${n}`, className: "border-fire-red/70 bg-fire-red/15 text-fire-red" }
              : { dot: "bg-fire-amber" };
          }}
          hot={(file) => claimants.has(file)}
          footer={
            contested.length > 0
              ? `${plural(contested.length, "file")} touched by more than one agent → guaranteed merge conflicts.`
              : "The model proposed no overlapping files."
          }
          more={files.length - rows.length}
        />
        <Matrix
          title="After Splitfire's partitioner"
          tone="green"
          columns={ordered.map((t) => ({ id: t.id, label: labels.get(t.id) ?? "?" }))}
          rows={rows}
          cell={(file, id) => {
            const t = owner.get(file);
            if (t?.id !== id) return null;
            return t.kind === "contract"
              ? { dot: "bg-contract-blue", className: "border-contract-blue/70" }
              : { dot: "bg-ok-green", className: "border-ok-green/70" };
          }}
          footer={`Every file has exactly one owner.${tasks.some((t) => t.kind === "contract") ? " Contract tasks hold the shared types." : ""}`}
          more={files.length - rows.length}
        />
      </div>

      <section className="border-border bg-background/40 rounded-xl border p-4">
        <h3 className="text-muted-foreground mb-3 text-[11px] font-semibold tracking-[0.16em] uppercase">
          Repair log
        </h3>
        <ol className="space-y-1.5 text-sm">
          {partitioned.repairs.map((r, i) => (
            <li key={i} className="flex gap-3">
              <span className="text-fire-amber font-mono">{String(i + 1).padStart(2, "0")}</span>
              <span>{describeRepair(r, label)}</span>
            </li>
          ))}
          {partitioned.collisionScore === 0 && (
            <li className="flex gap-3">
              <span className="text-ok-green font-mono">OK</span>
              <span>Graph check passed: no cycles, every file owned once.</span>
            </li>
          )}
        </ol>
      </section>

      <ContractsFirst tasks={ordered} waves={waves} labels={labels} metrics={metrics} />
    </div>
  );
}

function Score({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <div className="text-muted-foreground text-[10px] tracking-wider uppercase">{label}</div>
      <div className={cn("font-display text-3xl font-extrabold tracking-[-0.03em]", tone)}>
        {value}
      </div>
    </div>
  );
}

type Cell = { text?: string; dot?: string; className?: string } | null;

function Matrix(props: {
  title: string;
  tone: "red" | "green";
  columns: { id: string; label: string }[];
  rows: string[];
  cell: (file: string, id: string) => Cell;
  hot?: (file: string) => boolean;
  footer: string;
  more: number;
}) {
  const accent = props.tone === "red" ? "border-fire-red/30" : "border-ok-green/30";
  return (
    <section
      className={cn(
        "min-w-0 rounded-2xl border bg-white/[0.015] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
        accent,
      )}
    >
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <span
          className={cn(
            "size-2.5 rounded-sm",
            props.tone === "red" ? "bg-fire-red" : "bg-ok-green",
          )}
        />
        {props.title}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1 text-xs">
          <thead>
            <tr>
              <th className="text-muted-foreground text-left font-normal">File</th>
              {props.columns.map((c) => (
                <th key={c.id} className="text-muted-foreground w-9 text-[10px] font-medium">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.rows.map((file) => (
              <tr key={file}>
                <td
                  className={cn(
                    "max-w-52 truncate pr-2 font-mono",
                    props.hot?.(file) ? "text-fire-red" : "text-muted-foreground",
                  )}
                  title={file}
                >
                  {shortPath(file)}
                </td>
                {props.columns.map((c) => {
                  const cell = props.cell(file, c.id);
                  return (
                    <td key={c.id} className="p-0">
                      <div
                        className={cn(
                          "border-border/60 bg-card flex h-7 w-9 items-center justify-center rounded-md border font-mono text-[10px]",
                          cell?.className,
                        )}
                      >
                        {cell?.text}
                        {cell?.dot && <span className={cn("size-1.5 rounded-full", cell.dot)} />}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={cn("mt-3 text-xs", props.tone === "red" ? "text-fire-red" : "text-ok-green")}>
        {props.footer}
      </p>
      {props.more > 0 && (
        <p className="text-muted-foreground mt-1 text-xs">+{plural(props.more, "more file")}</p>
      )}
    </section>
  );
}

function ContractsFirst(props: {
  tasks: Task[];
  waves: Wave[];
  labels: Map<string, string>;
  metrics: Metrics;
}) {
  const { tasks, waves, labels, metrics } = props;
  const second = waves[1]?.ids ?? [];
  const first = (waves[0]?.ids ?? []).filter(
    (id) => tasks.find((t) => t.id === id)?.kind === "contract",
  );
  const contract = first.length > 0 && second.length > 0;
  const fan = contract ? second : (waves[0]?.ids ?? []);
  const title = (id: string) => tasks.find((t) => t.id === id)?.title ?? id;
  return (
    <section className="border-border rounded-2xl border bg-white/[0.015] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-semibold tracking-[-0.02em]">
          Contracts <span className="serif-accent">first</span>
        </h3>
        <span className="text-muted-foreground text-xs">
          A chain of waiting tasks becomes one fan-out
        </span>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <p className="text-fire-red mb-2 text-xs">
            WITHOUT · each task waits for the one before it
          </p>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {tasks.slice(0, 4).map((t, i) => (
              <span key={t.id} className="flex items-center gap-1.5">
                {i > 0 && <ArrowRight className="text-muted-foreground size-3" />}
                <span className="border-border bg-card rounded-md border px-2 py-1">{t.title}</span>
              </span>
            ))}
            {tasks.length > 4 && <span className="text-muted-foreground">+{tasks.length - 4}</span>}
          </div>
          <p className="font-display text-fire-red mt-3 text-3xl font-extrabold tracking-[-0.03em]">
            {formatMinutes(metrics.serialMinutes)}
          </p>
        </div>
        <div>
          <p className="text-ok-green mb-2 text-xs">
            WITH ·{" "}
            {contract
              ? `${first.map((id) => labels.get(id)).join(", ")} lands the contract, then ${plural(Math.min(fan.length, metrics.agents), "agent")} start together`
              : `${plural(Math.min(fan.length, metrics.agents), "agent")} start together`}
          </p>
          <div className="flex items-center gap-2 text-xs">
            {contract && (
              <>
                <span className="border-contract-blue/60 text-contract-blue rounded-md border px-2 py-1">
                  {first.map((id) => labels.get(id)).join(", ")} · contract
                </span>
                <span className="text-muted-foreground">⇒</span>
              </>
            )}
            <div className="grid flex-1 grid-cols-2 gap-1.5">
              {fan.slice(0, 4).map((id) => (
                <span
                  key={id}
                  className="border-fire-amber/30 bg-fire-amber/5 truncate rounded-md border px-2 py-1"
                >
                  {labels.get(id)} {title(id)}
                </span>
              ))}
            </div>
          </div>
          <p className="font-display text-ok-green mt-3 text-3xl font-extrabold tracking-[-0.03em]">
            {formatMinutes(metrics.parallelMinutes)} · {metrics.speedup}× faster
          </p>
        </div>
      </div>
    </section>
  );
}
