import type { Tooling } from "@/lib/analyze/tooling";
import type { DraftTask } from "@/lib/partition/ownership";

const MAX_CHECKS = 5;
export const OWNED_ONLY = "git diff --name-only touches only owned files";
const TEST_FILE =
  /(^|\/)(tests?|__tests__)\/|\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)test_[^/]*\.py$|_test\.py$/;

/**
 * Checks that prove a task is done, using the repo's real tooling: its tests, typecheck or build,
 * files that must exist, and that the diff stays inside the task's owned files.
 */
export function acceptanceChecks(
  task: Pick<DraftTask, "kind" | "ownedFiles">,
  tooling: Tooling,
  existing: Set<string>,
): string[] {
  const checks: string[] = [];
  const run = (script: string) => `${tooling.packageManager ?? "npm"} run ${script}`;
  const tests = task.ownedFiles.filter((f) => TEST_FILE.test(f));
  const code = task.ownedFiles.filter((f) => /\.[cm]?[jt]sx?$|\.py$/.test(f) && !TEST_FILE.test(f));

  if (tests.length > 0) {
    const files = tests.slice(0, 3).join(" ");
    if (tooling.testRunner === "vitest") checks.push(`npx vitest run ${files}`);
    else if (tooling.testRunner === "jest") checks.push(`npx jest ${files}`);
    else if (tooling.testRunner === "pytest") checks.push(`pytest ${files}`);
    else if (tooling.scripts.includes("test")) checks.push(run("test"));
  }

  if (code.length > 0 || task.kind === "contract") {
    if (tooling.scripts.includes("typecheck")) checks.push(run("typecheck"));
    else if (tooling.typescript && code.some((f) => /\.[cm]?tsx?$/.test(f)))
      checks.push("npx tsc --noEmit");
    const py = code.filter((f) => f.endsWith(".py")).slice(0, 3);
    if (py.length > 0) checks.push(`python -m py_compile ${py.join(" ")}`);
    if (task.kind !== "contract" && tooling.scripts.includes("build")) checks.push(run("build"));
  }

  for (const file of task.ownedFiles.filter((f) => !existing.has(f)).slice(0, 2)) {
    checks.push(`test -f ${file}`);
  }
  return [...new Set(checks)].slice(0, MAX_CHECKS - 1).concat(OWNED_ONLY);
}
