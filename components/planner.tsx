"use client";

import { Flame, GitFork, Network, RotateCcw, Split } from "lucide-react";
import { useState } from "react";
import { PlanView } from "@/components/plan-view";
import { ProgressSteps } from "@/components/progress-steps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { usePlanStream } from "@/hooks/use-plan-stream";

const EXAMPLES = [
  {
    label: "zustand · encrypted persist",
    repo: "https://github.com/pmndrs/zustand",
    request: "Add an encrypted storage option to the persist middleware, with tests and docs",
  },
  {
    label: "hono · rate limiter",
    repo: "https://github.com/honojs/hono",
    request: "Add a rate-limit middleware with pluggable stores, plus tests and docs",
  },
];

export function Planner() {
  const { state, start } = usePlanStream();
  const [repo, setRepo] = useState("");
  const [request, setRequest] = useState("");
  const busy = state.stage !== "idle" && state.stage !== "done" && state.stage !== "error";
  const canSubmit = repo.trim().length > 2 && request.trim().length > 2 && !busy;

  const submit = (r = repo, q = request) => {
    if (r.trim().length > 2 && q.trim().length > 2) void start(r.trim(), q.trim());
  };

  return (
    <div className="space-y-6">
      <form
        className="border-border bg-card/70 space-y-3 rounded-xl border p-4 backdrop-blur"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="grid gap-3 md:grid-cols-[2fr_3fr_auto]">
          <label className="space-y-1">
            <span className="text-muted-foreground text-xs">Public GitHub repo</span>
            <Input
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="https://github.com/owner/repo"
              autoComplete="off"
              spellCheck={false}
              name="repo"
            />
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground text-xs">Feature request</span>
            <Textarea
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              placeholder="Add dark mode with a settings toggle"
              rows={1}
              maxLength={500}
              className="min-h-9 resize-y"
              name="request"
            />
          </label>
          <Button
            type="submit"
            disabled={!canSubmit}
            className="font-heading self-end text-xs"
            size="lg"
          >
            <Split /> Split it
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Try:</span>
          {EXAMPLES.map((ex) => (
            <Button
              key={ex.label}
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => {
                setRepo(ex.repo);
                setRequest(ex.request);
                submit(ex.repo, ex.request);
              }}
            >
              {ex.label}
            </Button>
          ))}
        </div>
      </form>

      {state.stage === "idle" && <EmptyState />}
      {state.stage !== "idle" && state.stage !== "error" && <ProgressSteps state={state} />}
      {state.stage === "error" && state.error && (
        <div
          role="alert"
          className="border-fire-red/40 bg-fire-red/10 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-sm"
        >
          <span>{state.error.message}</span>
          <Button variant="outline" size="sm" onClick={() => submit()}>
            <RotateCcw /> Retry
          </Button>
        </div>
      )}
      {(state.proposals.length > 0 || state.partitioned) && <PlanView state={state} />}
    </div>
  );
}

function EmptyState() {
  const steps = [
    {
      icon: GitFork,
      title: "Paste a repo",
      text: "Any public GitHub repo. No clone, no login, no source stored.",
    },
    {
      icon: Network,
      title: "Describe the feature",
      text: "An open model proposes tasks; code checks every file has one owner.",
    },
    {
      icon: Flame,
      title: "Run agents in parallel",
      text: "Contracts first, then a fan-out with a speedup, cost and checks per task.",
    },
  ];
  return (
    <section className="grid gap-3 sm:grid-cols-3" aria-label="How it works">
      {steps.map(({ icon: Icon, title, text }, i) => (
        <div key={title} className="border-border bg-card/50 rounded-xl border p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="font-heading text-fire text-xs">{i + 1}</span>
            <Icon className="text-primary size-4" />
            <h2 className="text-sm font-semibold">{title}</h2>
          </div>
          <p className="text-muted-foreground text-sm">{text}</p>
        </div>
      ))}
    </section>
  );
}
