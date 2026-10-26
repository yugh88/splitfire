"use client";

import { Check, ChevronDown, Copy, Download, FileJson, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { downloadText, downloadZip } from "@/lib/client/download";
import { allPrompts, splitfirePack, taskPrompt } from "@/lib/context/export";
import type { Plan, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

export function shareUrl(plan: Plan): string {
  return `${window.location.origin}/p/${plan.id}`;
}

function packName(plan: Plan): string {
  return `splitfire-${plan.repo.replace("/", "-")}-${plan.id.slice(0, 6)}.zip`;
}

export function downloadPack(plan: Plan) {
  downloadZip(packName(plan), splitfirePack(plan, { shareUrl: shareUrl(plan) }));
}

/** Copies text and shows a check for a moment. */
export function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1_500);
    });
  };
  return [copied, copy];
}

export function ShareButton({ plan }: { plan: Plan }) {
  const [copied, copy] = useCopy();
  return (
    <Button variant="outline" onClick={() => copy(shareUrl(plan))} aria-label="Share">
      {copied ? <Check /> : <Share2 />}
      <span className="hidden sm:inline">{copied ? "Link copied" : "Share"}</span>
    </Button>
  );
}

/** "Export to Alan": all prompts, the `.splitfire/` pack, or the plan JSON. */
export function ExportMenu({ plan }: { plan: Plan }) {
  const [open, setOpen] = useState(false);
  const [copied, copy] = useCopy();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const items = [
    {
      icon: copied ? Check : Copy,
      label: copied ? "Copied" : "Copy all Alan prompts",
      run: () => copy(allPrompts(plan, { shareUrl: shareUrl(plan) })),
    },
    { icon: Download, label: "Download .splitfire pack (.zip)", run: () => downloadPack(plan) },
    {
      icon: FileJson,
      label: "Download plan.json",
      run: () =>
        downloadText(
          `splitfire-plan-${plan.id}.json`,
          JSON.stringify(plan, null, 2),
          "application/json",
        ),
    },
  ];

  return (
    <div className="relative hidden sm:block" ref={ref}>
      <Button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="glow-button font-heading text-xs tracking-widest"
      >
        <Download /> EXPORT TO ALAN{" "}
        <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
      </Button>
      {open && (
        <div
          role="menu"
          className="border-border bg-popover absolute left-0 z-20 mt-2 w-72 rounded-xl border p-1 shadow-2xl sm:right-0 sm:left-auto"
        >
          {items.map(({ icon: Icon, label, run }) => (
            <button
              key={label}
              role="menuitem"
              onClick={() => {
                run();
                if (!label.startsWith("Copy")) setOpen(false);
              }}
              className="hover:bg-accent flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm"
            >
              <Icon className="text-muted-foreground size-4" /> {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CopyPromptButton({ task, plan }: { task: Task; plan: Plan }) {
  const [copied, copy] = useCopy();
  return (
    <Button
      onClick={() => copy(taskPrompt(task, plan, { shareUrl: shareUrl(plan) }))}
      className="glow-button font-heading h-11 flex-1 text-xs tracking-widest"
    >
      {copied ? <Check /> : <Copy />} {copied ? "COPIED" : "COPY ALAN PROMPT"}
    </Button>
  );
}

export function CopyAllBar({ plan }: { plan: Plan }) {
  const [copied, copy] = useCopy();
  return (
    <div className="border-border bg-background/90 fixed inset-x-0 bottom-0 z-30 border-t p-4 backdrop-blur">
      <Button
        onClick={() => copy(allPrompts(plan, { shareUrl: shareUrl(plan) }))}
        className="glow-button font-heading h-12 w-full text-xs tracking-widest"
      >
        {copied ? <Check /> : <Copy />} {copied ? "COPIED" : "COPY ALL ALAN PROMPTS"}
      </Button>
    </div>
  );
}
