"use client";

import { Check, CheckCheck, Clock, Loader2, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TaskStatus } from "@/lib/track/types";
import { cn } from "@/lib/utils";

type Style = {
  label: string;
  text: string;
  border: string;
  bg: string;
  /** Border used on graph nodes when tracking is live. */
  node: string;
  /** Extra node glow, when the status deserves one. */
  glow?: string;
  icon: LucideIcon;
  spin?: boolean;
};

export const TRACK: Record<TaskStatus, Style> = {
  waiting: {
    label: "Waiting",
    text: "text-slate-300",
    border: "border-slate-400/40",
    bg: "bg-slate-400/10",
    node: "border-slate-500/50",
    icon: Clock,
  },
  working: {
    label: "Working",
    text: "text-fire-amber",
    border: "border-fire-amber/60",
    bg: "bg-fire-amber/10",
    node: "border-fire-amber",
    glow: "shadow-[0_0_20px_-8px_var(--fire-amber)]",
    icon: Loader2,
    spin: true,
  },
  checking: {
    label: "Checking",
    text: "text-contract-blue",
    border: "border-contract-blue/60",
    bg: "bg-contract-blue/10",
    node: "border-contract-blue",
    glow: "shadow-[0_0_20px_-8px_var(--contract-blue)]",
    icon: Loader2,
    spin: true,
  },
  passed: {
    label: "Passed",
    text: "text-ok-green",
    border: "border-ok-green/60",
    bg: "bg-ok-green/10",
    node: "border-ok-green",
    glow: "shadow-[0_0_22px_-8px_var(--ok-green)]",
    icon: Check,
  },
  failed: {
    label: "Failed",
    text: "text-fire-red",
    border: "border-fire-red/60",
    bg: "bg-fire-red/10",
    node: "border-fire-red",
    glow: "shadow-[0_0_20px_-8px_var(--fire-red)]",
    icon: X,
  },
  merged: {
    label: "Merged",
    text: "text-ok-green",
    border: "border-ok-green/80",
    bg: "bg-ok-green/15",
    node: "border-ok-green",
    glow: "shadow-[0_0_22px_-8px_var(--ok-green)]",
    icon: CheckCheck,
  },
};

type Props = {
  status: TaskStatus;
  /** Task label such as "T0"; rendered before the status text. */
  label?: string;
  compact?: boolean;
  className?: string;
};

/** A small status pill for one task. */
export function StatusBadge({ status, label, compact = false, className }: Props) {
  const style = TRACK[status];
  const Icon = style.icon;
  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-mono whitespace-nowrap",
        compact ? "px-1.5 py-px text-[10px]" : "px-2 py-0.5 text-xs",
        style.border,
        style.bg,
        style.text,
        className,
      )}
    >
      <Icon
        aria-hidden
        className={cn(
          compact ? "size-2.5" : "size-3",
          style.spin && "animate-spin motion-reduce:animate-none",
        )}
      />
      {label && <span className="text-foreground/80">{label}</span>}
      <span>{style.label}</span>
    </span>
  );
}
