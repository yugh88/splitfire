"use client";

import { Check, Copy, Download, Rocket, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { planWaves, taskPrompt, taskWorktree, wavePrompts } from "@/lib/context/export";
import { taskLabels } from "@/lib/partition/waves";
import type { Plan } from "@/lib/types";
import { cn } from "@/lib/utils";

const DOWNLOAD_URL = "https://tryalan.ai/download/";

const STEPS = [
  "Open your repo in Alan.",
  "Start one session per task in the wave.",
  "Paste each prompt into its session.",
  "Watch Mission control light up.",
];

/** Primary call to action: a panel of per-wave, per-task Alan prompts. */
export function LaunchInAlan({ plan }: { plan: Plan }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="font-display text-sm font-semibold"
      >
        <Rocket /> Launch in Alan
      </Button>
      {open && <LaunchPanel plan={plan} onClose={() => setOpen(false)} />}
    </>
  );
}

function LaunchPanel({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const waves = useMemo(() => planWaves(plan), [plan]);
  const labels = useMemo(() => taskLabels(plan.tasks), [plan.tasks]);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (key: string, text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied((current) => (current === key ? null : current)), 1_500);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="launch-in-alan-title"
        className="border-border bg-card flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border shadow-[0_-24px_80px_-40px_rgba(245,165,36,0.45),inset_0_1px_0_rgba(255,255,255,0.04)] sm:rounded-2xl sm:shadow-[0_40px_120px_-40px_rgba(0,0,0,0.95),0_0_80px_-40px_rgba(245,165,36,0.35),inset_0_1px_0_rgba(255,255,255,0.04)]"
      >
        <header className="border-border flex items-start gap-3 border-b px-4 py-4 sm:px-5">
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.16em] uppercase">
              Run the plan
            </p>
            <h2
              id="launch-in-alan-title"
              className="font-display mt-1 text-2xl font-extrabold tracking-[-0.03em]"
            >
              Launch in <span className="serif-accent">Alan</span>
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              One session per task. Every prompt already carries its worktree, owned files, checks
              and push rules.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close launch panel"
            autoFocus
          >
            <X />
          </Button>
        </header>

        <ol className="border-border grid grid-cols-2 gap-x-4 gap-y-2 border-b px-4 py-3 sm:grid-cols-4 sm:px-5">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-start gap-2 text-xs">
              <span className="font-display text-fire-amber/90 text-sm leading-none font-bold tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-muted-foreground leading-snug">{step}</span>
            </li>
          ))}
        </ol>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
          {waves.map((wave) => (
            <WaveSection
              key={wave.index}
              plan={plan}
              wave={wave}
              agents={plan.agents}
              labels={labels}
              copied={copied}
              onCopy={copy}
            />
          ))}

          <p className="text-muted-foreground flex flex-wrap items-center gap-1.5 px-1 text-xs">
            <Download className="size-3.5 shrink-0" />
            No Alan yet?
            <a
              href={DOWNLOAD_URL}
              target="_blank"
              rel="noreferrer"
              className="text-fire-amber decoration-fire-amber/40 hover:decoration-fire-amber underline underline-offset-4"
            >
              Download it for Mac or Windows
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

function WaveSection({
  plan,
  wave,
  agents,
  labels,
  copied,
  onCopy,
}: {
  plan: Plan;
  wave: ReturnType<typeof planWaves>[number];
  agents: number;
  labels: Map<string, string>;
  copied: string | null;
  onCopy: (key: string, text: string) => void;
}) {
  const parallel = Math.min(wave.tasks.length, Math.max(1, agents));
  const waveKey = `wave-${wave.index}`;

  return (
    <section className="border-border rounded-xl border bg-white/[0.02] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <header className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
        <div className="min-w-0">
          <h3 className="font-display text-sm font-semibold">Wave {wave.index + 1}</h3>
          <p className="text-muted-foreground text-xs">
            {wave.tasks.length === 1
              ? "1 task · 1 session"
              : `${wave.tasks.length} tasks · up to ${parallel} in parallel`}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onCopy(waveKey, wavePrompts(plan, wave.index).trimEnd())}
          aria-label={`Copy wave ${wave.index + 1} prompts`}
        >
          {copied === waveKey ? <Check /> : <Copy />}
          {copied === waveKey ? "Copied" : `Copy wave ${wave.index + 1}`}
        </Button>
      </header>

      <ul className="border-border space-y-px border-t">
        {wave.tasks.map((task) => {
          const key = `task-${task.id}`;
          const label = labels.get(task.id) ?? task.id;
          return (
            <li
              key={task.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:flex-nowrap"
            >
              <span className="text-fire-amber w-7 shrink-0 font-mono text-xs">{label}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{task.title}</p>
                <p className="text-muted-foreground truncate font-mono text-[11px]">
                  {task.ownedFiles.length} owned · splitfire/{task.id} · {taskWorktree(plan, task)}
                </p>
              </div>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => onCopy(key, taskPrompt(task, plan).trimEnd())}
                aria-label={`Copy ${label} prompt`}
                className={cn("ml-auto shrink-0", copied === key && "text-ok-green")}
              >
                {copied === key ? <Check /> : <Copy />}
                {copied === key ? "Copied" : "Copy"}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
