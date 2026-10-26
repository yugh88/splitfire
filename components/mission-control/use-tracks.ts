"use client";

import { useCallback, useEffect, useState } from "react";
import type { TaskTrack } from "@/lib/track/types";

/** Poll interval while tasks are still landing. */
export const POLL_MS = 10_000;

export type TrackState = {
  tracks: TaskTrack[] | null;
  /** True while the user is watching live status. */
  live: boolean;
  /** True once the first probe has settled (either way). */
  ready: boolean;
  toggle: () => void;
};

/**
 * Tracks a stored plan's task statuses. Probes once so a repo that already has
 * `splitfire/*` branches starts live, then polls every 10s until every task is merged.
 */
export function useTracks(planId: string | null): TrackState {
  const [tracks, setTracks] = useState<TaskTrack[] | null>(null);
  const [live, setLive] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setTracks(null);
    setLive(false);
    setReady(false);
    if (!planId) {
      setReady(true);
      return;
    }

    const controller = new AbortController();
    void loadTracks(planId, controller.signal).then((next) => {
      if (controller.signal.aborted) return;
      setReady(true);
      if (!next) return;
      setTracks(next);
      // Off by default when the repo has no splitfire/* branches for this plan.
      if (next.some((track) => track.headSha)) setLive(true);
    });
    return () => controller.abort();
  }, [planId]);

  const allMerged =
    tracks !== null && tracks.length > 0 && tracks.every((track) => track.status === "merged");

  useEffect(() => {
    if (!planId || !live || !ready || allMerged) return;

    const controller = new AbortController();
    const tick = async () => {
      const next = await loadTracks(planId, controller.signal);
      if (!controller.signal.aborted && next) setTracks(next);
    };
    void tick();
    const timer = setInterval(tick, POLL_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [planId, live, ready, allMerged]);

  const toggle = useCallback(() => setLive((current) => !current), []);

  return { tracks, live, ready, toggle };
}

async function loadTracks(planId: string, signal: AbortSignal): Promise<TaskTrack[] | null> {
  try {
    const res = await fetch(`/api/track/${planId}`, { signal, cache: "no-store" });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return Array.isArray(data) ? (data as TaskTrack[]) : null;
  } catch {
    return null;
  }
}
