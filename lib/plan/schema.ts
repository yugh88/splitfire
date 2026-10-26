import { z } from "zod";

/** What the planner (LLM, deterministic or mock) proposes. Code verifies and repairs it. */
export const TaskProposalSchema = z.object({
  id: z.string().min(1).max(60),
  title: z.string().min(1).max(120),
  goal: z.string().min(1).max(600),
  kind: z.enum(["contract", "feature", "test", "docs"]),
  ownedFiles: z.array(z.string().min(1)).min(1).max(60),
  dependsOn: z.array(z.string()),
  difficulty: z.number().int().min(1).max(3),
});

export type TaskProposal = z.infer<typeof TaskProposalSchema>;

export const MAX_TASKS = 12;

export const ProposalListSchema = z.array(TaskProposalSchema).min(1).max(MAX_TASKS);
