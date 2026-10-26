import { topoOrder } from "./dag";

type Job = { id: string; dependsOn: string[]; estMinutes: number };

export const MAX_AGENTS = 4;

export type Schedule = {
  serialMinutes: number;
  criticalPathMinutes: number;
  criticalPath: string[];
  parallelMinutes: number;
  agents: number;
  speedup: number;
};

/** Longest chain of dependent work, in minutes. Requires an acyclic plan. */
export function criticalPath(jobs: Job[]): { minutes: number; path: string[] } {
  const byId = new Map(jobs.map((j) => [j.id, j]));
  const finish = new Map<string, { minutes: number; prev: string | null }>();
  for (const id of topoOrder(jobs)) {
    const job = byId.get(id);
    if (!job) continue;
    let best: { minutes: number; prev: string | null } = { minutes: 0, prev: null };
    for (const dep of job.dependsOn) {
      const f = finish.get(dep);
      if (f && f.minutes > best.minutes) best = { minutes: f.minutes, prev: dep };
    }
    finish.set(id, { minutes: best.minutes + job.estMinutes, prev: best.prev });
  }

  let end: string | null = null;
  let minutes = 0;
  for (const [id, f] of finish) {
    if (f.minutes > minutes) [end, minutes] = [id, f.minutes];
  }
  const path: string[] = [];
  for (let at = end; at; at = finish.get(at)?.prev ?? null) path.unshift(at);
  return { minutes, path };
}

/**
 * Greedy list scheduling: whenever an agent is free, it takes the ready job with the longest
 * remaining chain. Returns the makespan and the peak number of jobs running at once.
 */
export function simulate(jobs: Job[], agents: number): { makespan: number; peak: number } {
  const byId = new Map(jobs.map((j) => [j.id, j]));
  const dependents = new Map<string, string[]>();
  for (const j of jobs)
    for (const d of j.dependsOn) dependents.set(d, [...(dependents.get(d) ?? []), j.id]);

  const tail = new Map<string, number>();
  for (const id of topoOrder(jobs).reverse()) {
    const next = (dependents.get(id) ?? []).map((d) => tail.get(d) ?? 0);
    tail.set(id, (byId.get(id)?.estMinutes ?? 0) + Math.max(0, ...next));
  }

  const waiting = new Map(jobs.map((j) => [j.id, new Set(j.dependsOn.filter((d) => byId.has(d)))]));
  const running: { id: string; end: number }[] = [];
  const ready = jobs.filter((j) => waiting.get(j.id)?.size === 0).map((j) => j.id);
  let now = 0;
  let peak = 0;

  while (ready.length > 0 || running.length > 0) {
    ready.sort((a, b) => (tail.get(b) ?? 0) - (tail.get(a) ?? 0) || a.localeCompare(b));
    while (running.length < agents && ready.length > 0) {
      const id = ready.shift() as string;
      running.push({ id, end: now + (byId.get(id)?.estMinutes ?? 0) });
    }
    peak = Math.max(peak, running.length);
    running.sort((a, b) => a.end - b.end);
    const done = running.shift();
    if (!done) break;
    now = done.end;
    for (const dep of dependents.get(done.id) ?? []) {
      const pending = waiting.get(dep);
      pending?.delete(done.id);
      if (pending?.size === 0) ready.push(dep);
    }
  }
  return { makespan: now, peak };
}

/** Serial effort vs. parallel makespan with up to MAX_AGENTS agents. */
export function schedule(jobs: Job[]): Schedule {
  const serialMinutes = jobs.reduce((sum, j) => sum + j.estMinutes, 0);
  const cp = criticalPath(jobs);
  const agents = Math.max(1, Math.min(MAX_AGENTS, simulate(jobs, jobs.length).peak));
  const parallelMinutes = simulate(jobs, agents).makespan;
  return {
    serialMinutes,
    criticalPathMinutes: cp.minutes,
    criticalPath: cp.path,
    parallelMinutes,
    agents,
    speedup: parallelMinutes > 0 ? Math.round((serialMinutes / parallelMinutes) * 10) / 10 : 1,
  };
}
