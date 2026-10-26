"use client";

import { Check, Eye, Lock, X } from "lucide-react";
import { KIND } from "@/components/kind";
import { Button } from "@/components/ui/button";
import { modelTier } from "@/lib/cost/estimate";
import { formatUsd } from "@/lib/format";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = { task: Task; labels: Map<string, string>; onClose?: () => void };

export function TaskCard({ task, labels, onClose }: Props) {
  const kind = KIND[task.kind];
  return (
    <article
      className="border-border bg-card rounded-xl border p-4"
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
      <h3 className="text-xl font-semibold">{task.title}</h3>
      <p className="text-muted-foreground mt-1 mb-4 text-sm">{task.goal}</p>

      <dl className="mb-4 grid grid-cols-3 gap-2 text-sm">
        <Fact label="Model" value={`${modelTier(task.difficulty)} model`} title={task.model} />
        <Fact label="Est. time" value={`${task.estMinutes} min`} />
        <Fact label="Est. cost" value={formatUsd(task.estCostUsd)} />
      </dl>

      <Section title="Owns (exclusive)">
        {task.ownedFiles.map((f) => (
          <FileRow key={f} file={f} icon={<Lock className="size-3.5 shrink-0" />} owned />
        ))}
      </Section>
      {task.readFiles.length > 0 && (
        <Section title="Context pack (read-only)">
          {task.readFiles.map((f) => (
            <FileRow key={f} file={f} icon={<Eye className="size-3.5 shrink-0" />} />
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
    </article>
  );
}

function Fact({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="border-border bg-background/40 rounded-lg border px-3 py-2" title={title}>
      <dt className="text-muted-foreground text-[10px] tracking-wider uppercase">{label}</dt>
      <dd className="truncate font-semibold">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h4 className="text-muted-foreground mb-1.5 text-xs font-semibold tracking-wider uppercase">
        {title}
      </h4>
      <div className="max-h-48 space-y-1.5 overflow-auto">{children}</div>
    </section>
  );
}

function FileRow({ file, icon, owned }: { file: string; icon: React.ReactNode; owned?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-2.5 py-1.5 font-mono text-xs",
        owned
          ? "border-fire-amber/30 bg-fire-amber/5 text-fire-amber"
          : "border-border bg-background/40 text-foreground",
      )}
      title={file}
    >
      {icon}
      <span className="truncate">{file}</span>
    </div>
  );
}
