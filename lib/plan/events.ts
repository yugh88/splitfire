import type { Collision } from "@/lib/partition/ownership";
import type { FileNode, ImportEdge, Plan, PlanEventType, Task } from "@/lib/types";
import type { TaskProposal } from "./schema";

export type PlannerKind = "llm" | "fallback" | "deterministic" | "mock";

export type Metrics = Pick<
  Plan,
  | "collisionScore"
  | "serialMinutes"
  | "parallelMinutes"
  | "speedup"
  | "agents"
  | "tokensFullRepo"
  | "tokensWithPacks"
  | "totalCostUsd"
> & { criticalPath: string[] };

/** What the share page and replays need beyond the core Plan. */
export type PlanReport = {
  plan: Plan;
  planner: PlannerKind;
  notice: string | null;
  collisions: Collision[];
  collisionScoreBefore: number;
  repairs: string[];
  criticalPath: string[];
};

type Payloads = {
  ingested: {
    repo: string;
    sha: string;
    files: number;
    skipped: number;
    truncated: boolean;
    cacheHit: boolean;
  };
  graph: { files: FileNode[]; edges: ImportEdge[]; parser: string };
  task: { attempt: number; task: TaskProposal };
  partitioned: {
    tasks: Task[];
    collisions: Collision[];
    collisionScoreBefore: number;
    collisionScore: number;
    repairs: string[];
  };
  metrics: Metrics;
  done: PlanReport;
  error: { code: string; message: string };
};

export type PlanEvent = { [K in PlanEventType]: { type: K; data: Payloads[K] } }[PlanEventType];

export type Emit = (event: PlanEvent) => void;
