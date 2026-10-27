"use client";

import { Check, Eye, GripVertical, Lock, X } from "lucide-react";
import { CopyPromptButton, downloadPack } from "@/components/export-actions";
import { KIND } from "@/components/kind";
import { dragProps, useResplit } from "@/components/resplit/resplit-context";
import { Button } from "@/components/ui/button";
import { modelTier } from "@/lib/cost/estimate";
import { formatUsd } from "@/lib/format";
import type { Plan, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = { task: Task; labels: Map<string, string>; plan?: Plan; onClose?: () => void };

export function TaskCard({ task, labels, plan, onClose }: Props) {
  const kind = KIND[task.kind];
  const resplit = useResplit();
  const canEdit = Boolean(resplit?.canEdit);
  return (
    <article
      className="border-border bg-card rounded-2xl border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      aria-label={`Task ${task.title}`}
    >
      <header className="mb-2 flex items-start justify-between gap-3">
        <span
          className={cn(
            "rounded-md border px-2 py-0.5 font-mono text-xs",
            kind.border,
            kind.bg,
            kind.text,
          )}
        >
          {labels.get(task.id)} · {task.kind.toUpperCase()}
        </span>
        {onClose && (
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close task details">
            <X />
          </Button>
        )}
      </header>
      <h3 className="font-display text-xl font-semibold tracking-[-0.02em]">{task.title}</h3>
      <p className="text-muted-foreground mt-1 mb-4 text-sm">{task.goal}</p>

      <dl className="mb-4 grid grid-cols-3 gap-2 text-sm">
        <Fact label="Model" value={`${modelTier(task.difficulty)} model`} title={task.model} />
        <Fact label="Est. time" value={`${task.estMinutes} min`} />
        <Fact label="Est. cost" value={formatUsd(task.estCostUsd)} />
      </dl>

      <Section title="Owns (exclusive)" hint={canEdit ? "Drag, or use Move to task…" : undefined}>
        {task.ownedFiles.map((f) => (
          <FileRow key={f} file={f} taskId={task.id} labels={labels} />
        ))}
        {task.ownedFiles.length === 0 && (
          <p className="text-muted-foreground rounded-lg border border-dashed px-2.5 py-2 text-xs">
            No files owned. Undo the move to restore them.
          </p>
        )}
      </Section>
      {task.readFiles.length > 0 && (
        <Section title="Context pack (read-only)">
          {task.readFiles.map((f) => (
            <FileRow key={f} file={f} taskId={task.id} labels={labels} readOnly />
          ))}
        </Section>
      )}
      {task.acceptance.length > 0 && (
        <Section title="Done when">
          <ul className="space-y-1">
            {task.acceptance.map((a) => (
              <li key={a} className="flex items-start gap-2 font-mono text-xs">
                <span className="border-ok-green/60 text-ok-green mt-px flex size-4 shrink-0 items-center justify-center rounded border">
                  <Check className="size-3" />
                </span>
                {a}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {task.dependsOn.length > 0 && (
        <p className="text-muted-foreground text-xs">
          Depends on:{" "}
          <span className="font-mono">
            {task.dependsOn.map((d) => labels.get(d) ?? d).join(", ")}
          </span>
        </p>
      )}
      {plan && (
        <div className="mt-4 flex gap-2">
          <CopyPromptButton task={task} plan={plan} />
          <Button variant="outline" className="h-11" onClick={() => downloadPack(plan)}>
            Download pack
          </Button>
        </div>
      )}
    </article>
  );
}

function Fact({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div
      className="border-border rounded-xl border bg-white/[0.02] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
      title={title}
    >
      <dt className="text-muted-foreground text-[10px] font-medium tracking-[0.14em] uppercase">
        {label}
      </dt>
      <dd className="truncate font-semibold">{value}</dd>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-4">
      <h4 className="text-muted-foreground mb-1.5 flex items-center justify-between gap-2 text-[11px] font-semibold tracking-[0.14em] uppercase">
        {title}
        {hint && (
          <span className="text-muted-foreground/80 tracking-normal normal-case">{hint}</span>
        )}
      </h4>
      <div className="max-h-48 space-y-1.5 overflow-auto">{children}</div>
    </section>
  );
}

function FileRow({
  file,
  taskId,
  labels,
  readOnly,
}: {
  file: string;
  taskId: string;
  labels: Map<string, string>;
  readOnly?: boolean;
}) {
  const resplit = useResplit();
  const canEdit = Boolean(resplit?.canEdit) && !readOnly;
  const others = (resplit?.tasks ?? []).filter((t) => t.id !== taskId);
  const drag = canEdit && resplit ? dragProps(resplit, file, taskId) : null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-2 py-1.5 font-mono text-xs",
        readOnly
          ? "border-border text-foreground bg-white/[0.02]"
          : "border-fire-amber/25 bg-fire-amber/[0.06] text-fire-amber",
      )}
      title={file}
      data-testid={readOnly ? "read-file" : "owned-file"}
      data-file={file}
    >
      {readOnly ? <Eye className="size-3.5 shrink-0" /> : <Lock className="size-3.5 shrink-0" />}
      <div
        {...(drag ?? {})}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1.5",
          canEdit && "cursor-grab active:cursor-grabbing",
        )}
        data-testid={canEdit ? "owned-file-drag" : undefined}
        data-file={file}
      >
        {canEdit && <GripVertical className="size-3.5 shrink-0 opacity-50" aria-hidden />}
        <span className="truncate">{file}</span>
      </div>
      {canEdit && (
        <select
          aria-label={`Move ${file} to another task`}
          value=""
          disabled={others.length === 0}
          onChange={(event) => {
            const to = event.target.value;
            if (to) resplit?.moveFile(file, to);
          }}
          className="border-border bg-card text-muted-foreground hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/40 h-6 max-w-[8.5rem] shrink-0 cursor-pointer rounded-md border px-1 font-mono text-[10px] focus-visible:ring-2 focus-visible:outline-none"
        >
          <option value="">Move to task…</option>
          {others.map((t) => (
            <option key={t.id} value={t.id}>
              {labels.get(t.id) ?? t.id} · {t.title}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
