import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SharedPlan } from "@/components/shared-plan";
import type { PlanReport } from "@/lib/plan/events";
import { kv } from "@/lib/store/kv";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function load(id: string): Promise<PlanReport | null> {
  if (!/^[a-f0-9]{16}$/.test(id)) return null;
  return kv().get<PlanReport>(`plan:${id}`);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const report = await load((await params).id);
  if (!report) return { title: "Plan not found · Splitfire" };
  const { plan } = report;
  return {
    title: `${plan.repo}: ${plan.request} · Splitfire`,
    description: `${plan.tasks.length} tasks, ${plan.speedup}× faster with ${plan.agents} agents, collision score ${plan.collisionScore}.`,
  };
}

/** Read-only share page for a stored plan. */
export default async function SharedPlanPage({ params }: Params) {
  const report = await load((await params).id);
  if (!report) notFound();
  return (
    <main className="min-h-screen">
      <SharedPlan report={report} />
    </main>
  );
}
