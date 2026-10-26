"use client";

import { Flame, GitBranch } from "lucide-react";
import { GithubMark } from "@/components/github-mark";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

export function Landing({ values, onChange, onSubmit, error }: Props) {
  const valid = values.repo.trim().length > 2 && values.request.trim().length > 2;
  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <header className="flex items-center justify-between py-6">
        <Logo />
        <nav className="text-muted-foreground flex items-center gap-4 text-sm sm:gap-6">
          <a href="#how" className="hover:text-foreground hidden sm:inline">
            How it works
          </a>
          <a href="#example" className="hover:text-foreground hidden sm:inline">
            Example plan
          </a>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="border-border bg-card text-foreground hover:bg-accent flex items-center gap-2 rounded-lg border px-3 py-1.5"
          >
            <GithubMark className="size-4" /> Star on GitHub
          </a>
        </nav>
      </header>

      <section className="relative pt-10 pb-14 text-center sm:pt-16">
        <PixelEmbers />
        <span className="border-fire-amber/40 bg-fire-amber/5 text-fire-amber inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wider uppercase">
          <span className="bg-fire-orange size-1.5" /> Open source · Open models · Built with Alan
        </span>
        <h1 className="font-heading mt-6 text-[clamp(1.6rem,6.5vw,4rem)] leading-tight font-bold">
          SPLIT THE WORK.
          <br />
          <span className="glow-amber text-fire-amber">NOT THE CODEBASE.</span>
        </h1>
        <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-base sm:text-lg">
          Paste a repo and a feature request. Splitfire turns it into a collision-proof graph of
          tasks your coding agents can run at the same time — each with its own contract, context
          pack and acceptance checks.
        </p>

        <form
          className="border-border bg-card/90 mx-auto mt-10 max-w-2xl space-y-4 rounded-2xl border p-5 text-left shadow-2xl backdrop-blur"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) onSubmit(values);
          }}
        >
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">GitHub repo</span>
            <div className="relative">
              <GitBranch className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={values.repo}
                onChange={(e) => onChange({ ...values, repo: e.target.value })}
                placeholder="https://github.com/owner/repo"
                autoComplete="off"
                spellCheck={false}
                name="repo"
                className="bg-background/60 h-11 pl-9 font-mono"
              />
            </div>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">What should the agents build?</span>
            <Textarea
              value={values.request}
              onChange={(e) => onChange({ ...values, request: e.target.value })}
              placeholder="Add dark mode and a user settings page with profile and notification preferences."
              rows={3}
              maxLength={500}
              name="request"
              className="bg-background/60"
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
                    "font-heading size-9 rounded-md border text-xs",
                    values.agents === n
                      ? "border-fire-orange bg-fire-orange/15 text-fire-amber"
                      : "border-border bg-background/60 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <Button
              type="submit"
              disabled={!valid}
              size="lg"
              className="glow-button font-heading h-11 px-6 text-xs tracking-widest"
            >
              <Flame /> IGNITE PLAN
            </Button>
          </div>
          {error && (
            <p
              role="alert"
              className="border-fire-red/40 bg-fire-red/10 rounded-md border px-3 py-2 text-sm"
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
                  className="border-border bg-background/60 hover:border-fire-orange/60 hover:text-foreground rounded-full border px-3 py-1"
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

const EMBERS = [
  { left: "6%", top: "18%", color: "bg-fire-orange", delay: "0s" },
  { left: "14%", top: "62%", color: "bg-fire-amber", delay: "1.2s" },
  { left: "88%", top: "10%", color: "bg-fire-amber", delay: "0.6s" },
  { left: "83%", top: "46%", color: "bg-contract-blue", delay: "2s" },
  { left: "93%", top: "68%", color: "bg-fire-red", delay: "1.6s" },
];

function PixelEmbers() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden sm:block">
      {EMBERS.map((e) => (
        <span
          key={e.left}
          className={cn("pixel-ember", e.color)}
          style={{ left: e.left, top: e.top, animationDelay: e.delay }}
        />
      ))}
    </div>
  );
}

/** Illustrative numbers from the design's example plan. */
function ExampleStats() {
  const stats = [
    {
      value: "0",
      label: "file collisions",
      note: "7 overlaps auto-repaired",
      tone: "text-ok-green",
    },
    {
      value: "2.7×",
      label: "faster than serial",
      note: "4h 05m → 1h 30m",
      tone: "text-fire-amber",
    },
    {
      value: "87%",
      label: "fewer tokens",
      note: "per-task context packs",
      tone: "text-contract-blue",
    },
    { value: "$0.03", label: "per plan", note: "open models, routed", tone: "text-foreground" },
  ];
  return (
    <section id="example" className="scroll-mt-8">
      <p className="text-muted-foreground mb-3 text-center text-xs">
        EXAMPLE PLAN · acme/storefront · 4 agents
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="border-border bg-card rounded-xl border p-4">
            <div className={cn("font-heading text-3xl", s.tone)}>{s.value}</div>
            <div className="mt-2 text-sm font-semibold">{s.label}</div>
            <div className="text-muted-foreground text-xs">{s.note}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      tag: "01 · MAP",
      tone: "text-contract-blue",
      title: "Read the real import graph",
      text: "tree-sitter parses every import, so ownership is based on how your code actually connects — not a model's guess.",
    },
    {
      tag: "02 · SPLIT",
      tone: "text-fire-amber",
      title: "Contracts first, zero overlap",
      text: "Shared types land first as a tiny contract task, so dependent work fans out in parallel. Every file has exactly one owner.",
    },
    {
      tag: "03 · SHIP",
      tone: "text-ok-green",
      title: "Hand it to your agents",
      text: "One click copies Alan-ready prompts, each with its context pack, model, cost and the checks that prove it's done.",
    },
  ];
  return (
    <section id="how" className="mt-16 scroll-mt-8">
      <h2 className="font-heading mb-6 text-center text-xl tracking-widest">HOW IT WORKS</h2>
      <div className="grid gap-3 md:grid-cols-3">
        {steps.map((s) => (
          <div key={s.tag} className="border-border bg-card rounded-xl border p-5">
            <div className={cn("font-heading text-[11px] tracking-widest", s.tone)}>{s.tag}</div>
            <h3 className="mt-2 font-semibold">{s.title}</h3>
            <p className="text-muted-foreground mt-2 text-sm">{s.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
