"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Collision } from "@/lib/partition/ownership";
import { formatMinutes, formatTokens, formatUsd } from "@/lib/format";
import type { Task } from "@/lib/types";

type Props = { task: Task; collisions: Collision[]; repairs: string[]; onClose: () => void };

export function TaskCard({ task, collisions, repairs, onClose }: Props) {
  const contested = new Set(collisions.filter((c) => c.tasks.includes(task.id)).map((c) => c.file));
  const notes = repairs.filter((r) => r.includes(task.id));
  return (
    <article
      className="border-border bg-card rounded-xl border p-4"
      aria-label={`Task ${task.title}`}
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-heading text-[9px] uppercase">
              {task.kind}
            </Badge>
            <code className="text-muted-foreground text-xs">{task.id}</code>
          </div>
          <h3 className="text-base font-semibold">{task.title}</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close task details">
          <X />
        </Button>
      </header>
      <p className="text-muted-foreground mb-4 text-sm">{task.goal}</p>

      <dl className="mb-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <Fact label="Model" value={task.model} />
        <Fact label="Time" value={formatMinutes(task.estMinutes)} />
        <Fact label="Tokens" value={formatTokens(task.estTokens)} />
        <Fact label="Cost" value={formatUsd(task.estCostUsd)} />
      </dl>

      <FileList title="Owns (exclusive)" files={task.ownedFiles} hot={contested} />
      {task.readFiles.length > 0 && (
        <FileList title="Reads (context only)" files={task.readFiles} />
      )}
      {task.dependsOn.length > 0 && (
        <Section title="Waits for">
          <div className="flex flex-wrap gap-1">
            {task.dependsOn.map((d) => (
              <code key={d} className="bg-muted rounded px-1.5 py-0.5 text-xs">
                {d}
              </code>
            ))}
          </div>
        </Section>
      )}
      {task.acceptance.length > 0 && (
        <Section title="Done when">
          <ul className="text-muted-foreground list-inside list-disc text-xs">
            {task.acceptance.map((a) => (
              <li key={a}>
                <code>{a}</code>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {notes.length > 0 && (
        <Section title="Repairs">
          <ul className="text-muted-foreground text-xs">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Section>
      )}
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/60 rounded-md px-2 py-1.5">
      <dt className="text-muted-foreground text-[10px] uppercase">{label}</dt>
      <dd className="truncate font-medium" title={value}>
        {value}
      </dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-3">
      <h4 className="font-heading text-muted-foreground mb-1 text-[10px] tracking-widest uppercase">
        {title}
      </h4>
      {children}
    </section>
  );
}

function FileList({ title, files, hot }: { title: string; files: string[]; hot?: Set<string> }) {
  return (
    <Section title={title}>
      <ul className="max-h-40 space-y-0.5 overflow-auto text-xs">
        {files.map((f) => (
          <li key={f} className="truncate font-mono" title={f}>
            {hot?.has(f) ? <span className="text-fire-red">● </span> : null}
            {f}
          </li>
        ))}
      </ul>
    </Section>
  );
}
