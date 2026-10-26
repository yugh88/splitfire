// Core types: the contract between modules (SPEC §4). Do not change without sign-off.

export type FileNode = { path: string; lang: "ts" | "js" | "py" | "other"; bytes: number };

export type ImportEdge = { from: string; to: string };

export type Task = {
  id: string;
  title: string;
  goal: string;
  kind: "contract" | "feature" | "test" | "docs";
  ownedFiles: string[]; // exclusive
  readFiles: string[]; // context only
  dependsOn: string[];
  difficulty: 1 | 2 | 3;
  model: string;
  estTokens: number;
  estCostUsd: number;
  estMinutes: number;
  acceptance: string[];
};

export type Plan = {
  id: string;
  repo: string;
  sha: string;
  request: string;
  tasks: Task[];
  collisionScore: number;
  serialMinutes: number;
  parallelMinutes: number;
  speedup: number;
  agents: number;
  tokensFullRepo: number;
  tokensWithPacks: number;
  totalCostUsd: number;
};

export type PlanEventType =
  "ingested" | "graph" | "task" | "partitioned" | "metrics" | "done" | "error";
