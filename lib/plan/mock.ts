import type { RepoAnalysis } from "@/lib/analyze/load";
import { deterministicProposals } from "./deterministic";
import type { TaskProposal } from "./schema";

/**
 * MOCK_LLM=1 planner for free UI work. Starts from the deterministic plan, then adds what a real
 * model tends to produce — a file claimed by two tasks — so the repair path shows up.
 */
export function mockProposals(analysis: RepoAnalysis, request: string): TaskProposal[] {
  const tasks = deterministicProposals(analysis, request).map((t) => ({ ...t }));
  const [first, second] = tasks;
  const shared = first?.ownedFiles[0];
  if (second && shared) second.ownedFiles = [...second.ownedFiles, shared];
  return tasks;
}
