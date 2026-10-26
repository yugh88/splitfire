"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { ExportMenu, ShareButton } from "@/components/export-actions";
import { type FormValues, Landing } from "@/components/landing";
import { PlanScreen } from "@/components/plan-screen";
import { Button } from "@/components/ui/button";
import { usePlanStream } from "@/hooks/use-plan-stream";
import { DEFAULT_AGENTS } from "@/lib/partition/schedule";

/** Landing form until a plan starts, then the live plan screen. */
export function Planner() {
  const { state, start, reset } = usePlanStream();
  const [values, setValues] = useState<FormValues>({
    repo: "",
    request: "",
    agents: DEFAULT_AGENTS,
  });
  const [submitted, setSubmitted] = useState<FormValues | null>(null);

  const submit = (v: FormValues) => {
    setSubmitted(v);
    window.scrollTo({ top: 0 });
    void start(v.repo.trim(), v.request.trim(), v.agents);
  };
  const back = () => {
    reset();
    setSubmitted(null);
  };

  if (!submitted || state.stage === "idle" || (state.stage === "error" && !state.ingested)) {
    return (
      <Landing
        values={values}
        onChange={setValues}
        onSubmit={submit}
        error={state.stage === "error" ? state.error?.message : null}
      />
    );
  }

  return (
    <PlanScreen
      state={state}
      repo={submitted.repo}
      request={submitted.request}
      agents={submitted.agents}
      actions={
        <>
          {state.stage === "error" && (
            <span role="alert" className="text-fire-red self-center text-sm">
              {state.error?.message}
            </span>
          )}
          <Button variant="outline" onClick={back}>
            <RotateCcw /> Re-split
          </Button>
          {state.report && <ShareButton plan={state.report.plan} />}
          {state.report && <ExportMenu plan={state.report.plan} />}
        </>
      }
    />
  );
}
