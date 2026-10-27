/**
 * Live mission-control contract.
 *
 * A plan task is built on branch `splitfire/<task id>` (older runs used the wave label
 * `splitfire/Tn`; both are tracked):
 *   waiting (no branch) -> working (branch ahead of the plan's base sha)
 *   -> checking (check run `splitfire/<task id>` queued or in progress)
 *   -> passed / failed (check run conclusion)
 *   -> merged (head commit reachable from the default branch).
 */
export type TaskStatus = "waiting" | "working" | "checking" | "passed" | "failed" | "merged";

export type TaskTrack = {
  taskId: string;
  status: TaskStatus;
  /** `splitfire/<task id>`, or the legacy `splitfire/Tn` label branch. */
  branch: string;
  /** Head commit of the task branch, when it exists. */
  headSha?: string;
  /** GitHub check run page for the task branch on the head commit, when one exists. */
  checkUrl?: string;
  /** When this snapshot was observed (ISO 8601). */
  updatedAt: string;
};
