"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Flame, GitBranch } from "lucide-react";
import { Annotation } from "@/components/annotation";
import { GithubMark } from "@/components/github-mark";
import { Logo } from "@/components/logo";
import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import featuredPlan from "@/data/featured-plan.json";
import { formatMinutes, formatTokens, formatUsd, percentSaved } from "@/lib/format";
import { AGENT_OPTIONS } from "@/lib/partition/schedule";
import { cn } from "@/lib/utils";

export const REPO_URL = "https://github.com/yugh88/splitfire";

/** Used by the "Try" chips when the repo box is empty: a Next.js app with auth and REST routes. */
export const DEMO_REPO = "https://github.com/shadcn-ui/taxonomy";

export const EXAMPLES = [
  {
    label: "Add OAuth login",
    request: "Add GitHub and Google OAuth login with account linking and a sign-in page",
  },
  {
    label: "Add i18n (Hindi + English)",
    request:
      "Add i18n with Hindi and English translations, a language switcher and localized routes",
  },
  {
    label: "Migrate REST → tRPC",
    request: "Migrate the REST API routes to tRPC with typed procedures and update the callers",
  },
];

export type FormValues = { repo: string; request: string; agents: number };

type Props = {
  values: FormValues;
  onChange: (values: FormValues) => void;
  onSubmit: (values: FormValues) => void;
  error?: string | null;
};

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function Landing({ values, onChange, onSubmit, error }: Props) {
  const valid = values.repo.trim().length > 2 && values.request.trim().length > 2;
  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <header className="flex items-center justify-between py-6">
        <Logo />
        <nav className="text-muted-foreground flex items-center gap-4 text-sm sm:gap-6">
          <a href="#how" className="hover:text-foreground hidden transition-colors sm:inline">
            How it works
          </a>
          <a href="#example" className="hover:text-foreground hidden transition-colors sm:inline">
            Example plan
          </a>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="border-border text-foreground flex items-center gap-2 rounded-xl border bg-white/[0.02] px-3 py-1.5 transition-colors hover:border-white/15 hover:bg-white/[0.05]"
          >
            <GithubMark className="size-4" /> Star on GitHub
          </a>
        </nav>
      </header>

      <section className="relative pt-10 pb-14 text-center sm:pt-16">
        <span className="border-fire-amber/25 bg-fire-amber/[0.06] text-fire-amber inline-flex items-center gap-2 rounded-full border px-3 py-1 text-center text-[10px] font-medium tracking-[0.12em] uppercase sm:text-[11px] sm:tracking-[0.16em]">
          <span className="bg-fire-orange size-1.5 rounded-full" /> Open source · Open models ·
          Built with Alan
        </span>

        <HeroHeadline />

        <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">
          Paste a repo and a feature request. Splitfire turns it into a{" "}
          <em className="text-foreground/90 italic">collision-proof</em> graph of tasks your coding
          agents can run at the same time — each with its own contract, context pack and acceptance
          checks.
        </p>

        <form
          className="border-border bg-card/80 mx-auto mt-10 max-w-2xl space-y-4 rounded-2xl border p-5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_30px_80px_-50px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) onSubmit(values);
          }}
        >
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">GitHub repo</span>
            <div className="relative">
              <GitBranch className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={values.repo}
                onChange={(e) => onChange({ ...values, repo: e.target.value })}
                placeholder="https://github.com/owner/repo"
                autoComplete="off"
                spellCheck={false}
                name="repo"
                className="h-11 pl-9 font-mono"
              />
            </div>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">What should the agents build?</span>
            <Textarea
              value={values.request}
              onChange={(e) => onChange({ ...values, request: e.target.value })}
              placeholder="Add dark mode and a user settings page with profile and notification preferences."
              rows={3}
              maxLength={500}
              name="request"
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2" role="radiogroup" aria-label="Agents">
              <span className="text-muted-foreground mr-1 text-sm">Agents</span>
              {AGENT_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={values.agents === n}
                  onClick={() => onChange({ ...values, agents: n })}
                  className={cn(
                    "font-display size-9 rounded-xl border text-xs font-semibold transition-[background-color,border-color,box-shadow,color] duration-200",
                    values.agents === n
                      ? "border-fire-amber/50 bg-fire-amber/10 text-fire-amber shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_6px_18px_-12px_rgba(245,165,36,0.7)]"
                      : "border-border text-muted-foreground hover:text-foreground bg-white/[0.02] hover:border-white/15",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Annotation arrow="right" className="hidden lg:inline-flex">
                takes ~20 seconds
              </Annotation>
              <Button
                type="submit"
                disabled={!valid}
                size="lg"
                className="font-display h-11 px-5 text-sm font-semibold"
              >
                <Flame /> Ignite plan
              </Button>
            </div>
          </div>
          {error && (
            <p
              role="alert"
              className="border-fire-red/30 bg-fire-red/10 rounded-xl border px-3 py-2 text-sm"
            >
              {error}
            </p>
          )}
          <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">Try:</span>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.label}
                  type="button"
                  onClick={() => {
                    const next = {
                      ...values,
                      repo: values.repo.trim() || DEMO_REPO,
                      request: ex.request,
                    };
                    onChange(next);
                    onSubmit(next);
                  }}
                  className="border-border hover:border-fire-amber/40 hover:text-foreground rounded-full border bg-white/[0.02] px-3 py-1 transition-colors"
                >
                  {ex.label}
                </button>
              ))}
            </div>
            <span className="text-muted-foreground text-xs">
              Public repos · no login · no code stored
            </span>
          </div>
        </form>
      </section>

      <ExampleStats />
      <HowItWorks />

      <footer className="border-border text-muted-foreground mt-16 border-t py-8 text-center text-xs">
        MIT licensed ·{" "}
        <a
          href={REPO_URL}
          className="text-fire-amber underline underline-offset-2"
          target="_blank"
          rel="noreferrer"
        >
          github.com/yugh88/splitfire
        </a>{" "}
        · Made for OpenFire
      </footer>
    </div>
  );
}

/** "Split the work." over "Not the codebase.", words lifting in one after another. */
function HeroHeadline() {
  const reduce = useReducedMotion();
  const line: Variants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduce ? 0 : 0.09,
        delayChildren: reduce ? 0 : 0.12,
      },
    },
  };
  const word: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 18 },
    show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE } },
  };
  const second: Variants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduce ? 0 : 0.08,
        delayChildren: reduce ? 0 : 0.42,
      },
    },
  };
  const firstWords: { text: string; accent?: boolean; tight?: boolean }[] = [
    { text: "Split" },
    { text: "the" },
    { text: "work", accent: true },
    { text: ".", tight: true },
  ];
  const secondWords = ["Not", "the", "codebase."];
  return (
    <h1 className="font-display mt-6 text-[clamp(2rem,8.2vw,4.75rem)] leading-[0.98] font-extrabold tracking-[-0.03em]">
      <motion.span
        variants={line}
        initial={reduce ? false : "hidden"}
        animate="show"
        className="block"
      >
        {firstWords.map((w, i) => (
          <span key={w.text}>
            {i > 0 && !w.tight && " "}
            <motion.span variants={word} className="inline-block">
              {w.accent ? <span className="serif-accent">{w.text}</span> : w.text}
            </motion.span>
          </span>
        ))}
      </motion.span>
      <motion.span
        variants={second}
        initial={reduce ? false : "hidden"}
        animate="show"
        className="text-foreground/95 block"
      >
        {secondWords.map((text, i) => (
          <span key={text}>
            {i > 0 && " "}
            <motion.span variants={word} className="inline-block">
              {text}
            </motion.span>
          </span>
        ))}
      </motion.span>
    </h1>
  );
}

/**
 * Every number here is computed from data/featured-plan.json: a real plan the app's planner
 * produced for shadcn-ui/taxonomy. Regenerate the fixture instead of hand-editing the stats.
 */
function ExampleStats() {
  const { meta, report } = featuredPlan;
  const plan = report.plan;
  const saved = percentSaved(plan.tokensFullRepo, plan.tokensWithPacks);
  const agents = `${plan.agents} agent${plan.agents === 1 ? "" : "s"}`;
  const stats = [
    {
      value: String(plan.collisionScore),
      label: "file collisions",
      note: `${plan.tasks.length} tasks · one owner per file`,
      tone: "text-ok-green",
    },
    {
      value: `${plan.speedup}×`,
      label: "faster than serial",
      note: `${formatMinutes(plan.serialMinutes)} → ${formatMinutes(plan.parallelMinutes)} · ${agents}`,
      tone: "text-fire-amber",
    },
    {
      value: `${saved}%`,
      label: "fewer tokens",
      note: `${formatTokens(plan.tokensWithPacks)} vs ${formatTokens(plan.tokensFullRepo)} tokens`,
      tone: "text-contract-blue",
    },
    {
      value: formatUsd(plan.totalCostUsd),
      label: "per plan",
      note: "open models · $0 endpoint pricing",
      tone: "text-foreground",
    },
  ];
  return (
    <section id="example" className="scroll-mt-8">
      <Reveal>
        <div className="mb-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <p className="text-muted-foreground text-[11px] font-medium tracking-[0.16em] uppercase">
            Real plan · {meta.repo} · “{meta.request}” · {meta.generatedAt}
          </p>
          <Annotation arrow="left" className="hidden sm:inline-flex">
            zero file collisions
          </Annotation>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="panel p-4 transition-colors duration-300 hover:border-white/15 sm:p-5"
            >
              <div
                className={cn("font-display text-3xl font-extrabold tracking-[-0.03em]", s.tone)}
              >
                {s.value}
              </div>
              <div className="mt-2 text-sm font-medium">{s.label}</div>
              <div className="text-muted-foreground text-xs">{s.note}</div>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground mt-4 text-center text-xs">
          Planned by {meta.plannerModel} for {meta.repo}@{plan.sha.slice(0, 7)} ·{" "}
          <a
            href={meta.shareUrl}
            target="_blank"
            rel="noreferrer"
            className="text-fire-amber underline underline-offset-2"
          >
            Open this plan →
          </a>{" "}
          · numbers computed from the committed fixture in{" "}
          <span className="font-mono">data/featured-plan.json</span>
        </p>
      </Reveal>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      tag: "01 · Map",
      tone: "text-contract-blue",
      title: "Read the real import graph",
      text: "tree-sitter parses every import, so ownership is based on how your code actually connects — not a model's guess.",
    },
    {
      tag: "02 · Split",
      tone: "text-fire-amber",
      title: "Contracts first, zero overlap",
      text: "Shared types land first as a tiny contract task, so dependent work fans out in parallel. Every file has exactly one owner.",
    },
    {
      tag: "03 · Ship",
      tone: "text-ok-green",
      title: "Hand it to your agents",
      text: "One click copies Alan-ready prompts, each with its context pack, model, cost and the checks that prove it's done.",
    },
  ];
  return (
    <section id="how" className="mt-16 scroll-mt-8">
      <Reveal>
        <div className="mb-7 text-center">
          <h2 className="font-display text-[clamp(1.9rem,4vw,2.75rem)] leading-tight font-extrabold tracking-[-0.03em]">
            How it <span className="serif-accent">works</span>
          </h2>
          <Annotation arrow="left" className="mt-1 hidden justify-center sm:inline-flex">
            one owner per file
          </Annotation>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {steps.map((s) => (
            <div
              key={s.tag}
              className="panel p-5 transition-colors duration-300 hover:border-white/15 sm:p-6"
            >
              <div className={cn("text-[11px] font-semibold tracking-[0.16em] uppercase", s.tone)}>
                {s.tag}
              </div>
              <h3 className="font-display mt-2 text-lg font-semibold tracking-[-0.01em]">
                {s.title}
              </h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
