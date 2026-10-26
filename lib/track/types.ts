/**
 * Live mission-control contract.
 *
 * A plan task Tn is built on branch `splitfire/Tn`:
 *   waiting (no branch) -> working (branch ahead of the plan's base sha)
 *   -> checking (check run `splitfire/Tn` queued or in progress)
 *   -> passed / failed (check run conclusion)
 *   -> merged (head commit reachable from the default branch).
 */
export type TaskStatus = "waiting" | "working" | "checking" | "passed" | "failed" | "merged";

export type TaskTrack = {
  taskId: string;
  status: TaskStatus;
  /** `splitfire/Tn`, where Tn is the task's label in wave order. */
  branch: string;
  /** Head commit of the task branch, when it exists. */
  headSha?: string;
  /** GitHub check run page for `splitfire/Tn` on the head commit, when one exists. */
  checkUrl?: string;
  /** When this snapshot was observed (ISO 8601). */
  updatedAt: string;
};
