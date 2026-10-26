import { z } from "zod";
import type { PlanEvent } from "@/lib/plan/events";
import { runPlan } from "@/lib/plan/pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({
  repo: z.string().trim().min(3).max(200),
  request: z.string().trim().min(3).max(500),
});

export async function POST(req: Request) {
  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return Response.json(
      { error: "Send { repo, request } (request: 3–500 chars)." },
      { status: 400 },
    );
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: PlanEvent) => {
        controller.enqueue(
          encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`),
        );
      };
      await runPlan({ ...body.data, ip }, emit);
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
