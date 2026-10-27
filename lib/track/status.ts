import type { TaskStatus } from "./types";

/** The check-run fields that decide the status. */
export type CheckRunState = {
  status: string;
  conclusion: string | null;
};

export type StatusInput = {
  /** Does the task branch exist? */
  branchExists: boolean;
  /** Is the branch head ahead of the plan's base sha? */
  aheadOfBase: boolean;
  /** Latest check run named after the task branch on the branch head. */
  checkRun?: CheckRunState | null;
  /** Is the head commit reachable from the default branch? */
  merged: boolean;
};

const CHECKING = new Set(["queued", "in_progress", "requested", "waiting", "pending"]);
const PASSING = new Set(["success", "neutral", "skipped"]);

/**
 * Pure status derivation. Precedence follows the shared contract:
 * merged > checking > passed/failed > working > waiting.
 *
 * A check run only counts for the head commit it was fetched for; the caller
 * is responsible for passing the run for the current head sha.
 */
export function deriveTaskStatus(input: StatusInput): TaskStatus {
  if (!input.branchExists) return "waiting";
  if (input.merged) return "merged";

  const check = input.checkRun;
  if (check) {
    if (CHECKING.has(check.status)) return "checking";
    if (check.status === "completed") {
      return PASSING.has(check.conclusion ?? "") ? "passed" : "failed";
    }
  }

  if (input.aheadOfBase) return "working";
  return "waiting";
}
