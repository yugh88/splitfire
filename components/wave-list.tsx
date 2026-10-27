"use client";

import { KIND } from "@/components/kind";
import { TaskCard } from "@/components/task-card";
import type { Wave } from "@/lib/client/graph-model";
import type { Plan, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  plan?: Plan;
  tasks: Task[];
  waves: Wave[];
  labels: Map<string, string>;
  agents: number;
  selected: string | null;
  onSelect: (id: string | null) => void;
};

/** Phone layout: tasks as rows grouped by wave; tapping a row opens its card inline. */
export function WaveList({ plan, tasks, waves, labels, agents, selected, onSelect }: Props) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return (
    <div className="space-y-4">
      {waves.map((wave) => {
        const members = wave.ids.map((id) => byId.get(id)).filter((t): t is Task => Boolean(t));
        const contractOnly = members.every((t) => t.kind === "contract");
        const caption = contractOnly
          ? " · contract"
          : members.length > 1
            ? ` · ${Math.min(members.length, agents)} agents in parallel`
            : "";
        return (
          <section key={wave.index}>
            <h3 className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-[0.16em] uppercase">
              Wave {wave.index + 1}
              {caption}
            </h3>
            <ul className="space-y-2">
              {members.map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(selected === task.id ? null : task.id)}
                    aria-expanded={selected === task.id}
                    className={cn(
                      "bg-card flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors",
                      selected === task.id
                        ? "border-fire-amber/60"
                        : task.kind === "feature"
                          ? "border-border"
                          : KIND[task.kind].border,
                    )}
                  >
                    <span className={cn("w-6 font-mono text-xs", KIND[task.kind].text)}>
                      {labels.get(task.id)}
                    </span>
                    <span className="flex-1 truncate text-sm font-semibold">{task.title}</span>
                    <span className="text-muted-foreground text-xs">{task.estMinutes}m</span>
                  </button>
                  {selected === task.id && (
                    <div className="mt-2">
                      <TaskCard task={task} labels={labels} plan={plan} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
