import { describe, expect, it } from "vitest";
import { deriveTaskStatus, type StatusInput } from "@/lib/track/status";

const base: StatusInput = {
  branchExists: true,
  aheadOfBase: true,
  merged: false,
  checkRun: null,
};

describe("deriveTaskStatus", () => {
  it("waiting when the branch does not exist yet", () => {
    expect(deriveTaskStatus({ ...base, branchExists: false })).toBe("waiting");
  });

  it("waiting when the branch exists but is not ahead of the plan base sha", () => {
    expect(deriveTaskStatus({ ...base, aheadOfBase: false })).toBe("waiting");
  });

  it("working when the branch is ahead of the base sha and has no check run yet", () => {
    expect(deriveTaskStatus(base)).toBe("working");
  });

  it("checking when the splitfire/Tn check run is queued", () => {
    expect(deriveTaskStatus({ ...base, checkRun: { status: "queued", conclusion: null } })).toBe(
      "checking",
    );
  });

  it("checking when the splitfire/Tn check run is in progress", () => {
    expect(
      deriveTaskStatus({ ...base, checkRun: { status: "in_progress", conclusion: null } }),
    ).toBe("checking");
  });

  it("passed when the check run completed successfully", () => {
    expect(
      deriveTaskStatus({ ...base, checkRun: { status: "completed", conclusion: "success" } }),
    ).toBe("passed");
  });

  it("failed when the check run completed with a failure", () => {
    expect(
      deriveTaskStatus({ ...base, checkRun: { status: "completed", conclusion: "failure" } }),
    ).toBe("failed");
  });

  it("failed for other non-success conclusions", () => {
    for (const conclusion of ["cancelled", "timed_out", "action_required", "stale"]) {
      expect(deriveTaskStatus({ ...base, checkRun: { status: "completed", conclusion } })).toBe(
        "failed",
      );
    }
  });

  it("merged when the head commit is reachable from the default branch", () => {
    expect(deriveTaskStatus({ ...base, merged: true })).toBe("merged");
  });

  it("merged wins over check-run and ahead state", () => {
    expect(
      deriveTaskStatus({
        branchExists: true,
        aheadOfBase: false,
        merged: true,
        checkRun: { status: "completed", conclusion: "failure" },
      }),
    ).toBe("merged");
  });

  it("a completed run without a conclusion is not a pass", () => {
    expect(deriveTaskStatus({ ...base, checkRun: { status: "completed", conclusion: null } })).toBe(
      "failed",
    );
  });
});
