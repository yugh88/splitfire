"use client";

import { useCallback, useReducer, useRef } from "react";
import { initialPlanState, planReducer } from "@/lib/client/plan-state";
import { createSseParser } from "@/lib/client/sse";
import type { PlanEvent } from "@/lib/plan/events";

/** POSTs to /api/plan and folds the SSE stream into PlanState. */
export function usePlanStream() {
  const [state, dispatch] = useReducer(planReducer, initialPlanState);
  const abort = useRef<AbortController | null>(null);

  const start = useCallback(async (repo: string, request: string) => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    dispatch({ type: "start" });

    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo, request }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        dispatch({ type: "fail", message: body?.error ?? `Request failed (${res.status}).` });
        return;
      }
      const push = createSseParser(({ event, data }) => {
        dispatch({ type: "event", event: { type: event, data: JSON.parse(data) } as PlanEvent });
      });
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        push(value);
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      dispatch({
        type: "fail",
        message: error instanceof Error ? error.message : "Connection lost.",
      });
    }
  }, []);

  return { state, start };
}
