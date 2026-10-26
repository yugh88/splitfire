import type { RepoAnalysis } from "@/lib/analyze/load";
import { deterministicProposals } from "./deterministic";
import type { TaskProposal } from "./schema";

/**
 * MOCK_LLM=1 planner for free UI work. Starts from the deterministic plan, then adds what a real
 * model tends to produce — one contested file and a dependency chain — so repairs show up.
 */
export function mockProposals(analysis: RepoAnalysis, request: string): TaskProposal[] {
  const tasks = deterministicProposals(analysis, request).map((t) => ({ ...t }));
  const [first, second] = tasks;
  const shared = first?.ownedFiles[0];
  if (second && shared) second.ownedFiles = [...second.ownedFiles, shared];
  tasks.forEach((task, i) => {
    const prev = tasks[i - 1];
    if (prev && !prev.dependsOn.includes(task.id))
      task.dependsOn = [...new Set([...task.dependsOn, prev.id])];
  });
  return tasks;
}
