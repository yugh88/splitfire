import type { PlanReport } from "@/lib/plan/events";
import { kv } from "@/lib/store/kv";
import { getTracks, TrackError } from "@/lib/track/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const PLAN_ID = /^[a-f0-9]{16}$/;

/** Live task statuses for a stored plan. Tokens never leave the server. */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  if (!PLAN_ID.test(id)) return notFound();

  const report = await kv().get<PlanReport>(`plan:${id}`);
  if (!report) return notFound();

  try {
    const tracks = await getTracks({
      id,
      repo: report.plan.repo,
      sha: report.plan.sha,
      tasks: report.plan.tasks,
    });
    return Response.json(tracks, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof TrackError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.code === "rate_limited" ? 429 : 502 },
      );
    }
    console.error("[splitfire] track failed", error);
    return Response.json({ error: "Could not read GitHub status." }, { status: 502 });
  }
}

function notFound() {
  return Response.json({ error: "Plan not found." }, { status: 404 });
}
