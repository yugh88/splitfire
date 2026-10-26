"use client";

import { Flame } from "lucide-react";
import Link from "next/link";
import { ExportMenu, ShareButton } from "@/components/export-actions";
import { PlanScreen } from "@/components/plan-screen";
import { Button } from "@/components/ui/button";
import { stateFromReport } from "@/lib/client/plan-state";
import type { PlanReport } from "@/lib/plan/events";

export function SharedPlan({ report }: { report: PlanReport }) {
  const { plan } = report;
  return (
    <PlanScreen
      state={stateFromReport(report)}
      repo={plan.repo}
      request={plan.request}
      agents={plan.agents}
      actions={
        <>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/" />}
            aria-label="Plan your own"
          >
            <Flame /> <span className="hidden sm:inline">Plan your own</span>
          </Button>
          <ShareButton plan={plan} />
          <ExportMenu plan={plan} />
        </>
      }
    />
  );
}
