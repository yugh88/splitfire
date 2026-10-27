import type { Metrics } from "@/lib/plan/events";
import {
  type Collision,
  normalizePath,
  reassignFile,
  rescoreOwnership,
} from "@/lib/partition/ownership";
import { schedule } from "@/lib/partition/schedule";
import type { Task } from "@/lib/types";

/** The last file a user moved, kept so the toolbar can say what changed. */
export type ResplitMove = { file: string; from: string[]; to: string };

/** Interactive ownership history for a finished plan: current tasks, undo stack and base plan. */
export type ResplitState = {
  base: Task[];
  tasks: Task[];
  past: Task[][];
  lastMove: ResplitMove | null;
};

export type ResplitAction =
  | { type: "init"; tasks: Task[] }
  | { type: "move"; file: string; toTaskId: string }
  | { type: "undo" }
  | { type: "reset" };

/** Enough history for any demo session without holding on to the whole plan forever. */
export const MAX_UNDO = 50;

export function initialResplit(tasks: Task[]): ResplitState {
  return { base: tasks, tasks, past: [], lastMove: null };
}

export function resplitReducer(state: ResplitState, action: ResplitAction): ResplitState {
  switch (action.type) {
    case "init":
      return initialResplit(action.tasks);
    case "move": {
      const file = normalizePath(action.file);
      const ownedElsewhere = state.tasks.some(
        (t) => t.id !== action.toTaskId && t.ownedFiles.includes(file),
      );
      // Only accept a file the plan already knows about; a stray text drop must not invent paths.
      if (!file || !ownedElsewhere) return state;
      const result = reassignFile(state.tasks, file, action.toTaskId);
      if (!result.changed) return state;
      const from = state.tasks
        .filter((t) => t.id !== action.toTaskId && t.ownedFiles.includes(file))
        .map((t) => t.id);
      return {
        ...state,
        tasks: result.tasks,
        past: [...state.past, state.tasks].slice(-MAX_UNDO),
        lastMove: { file, from, to: action.toTaskId },
      };
    }
    case "undo": {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return { ...state, tasks: previous, past: state.past.slice(0, -1), lastMove: null };
    }
    case "reset":
      if (state.tasks === state.base) return state;
      return { ...state, tasks: state.base, past: [], lastMove: null };
  }
}

/** A finished re-split, ready to feed the graph, metrics and heatmap. */
export type ResplitView = {
  tasks: Task[];
  collisions: Collision[];
  collisionScore: number;
  criticalPath: string[];
  criticalPathMinutes: number;
  metrics: Metrics;
  edited: boolean;
};

/**
 * Recomputes everything a file move touches. Effort moves with the files: minutes are derived
 * from the original plan's per-file rate, so a task that gives a file away gets shorter and the
 * task that receives it gets longer. Dependencies are untouched, so the critical path and
 * speedup visibly follow the new effort. Collisions are recomputed from scratch.
 */
export function resplitView(state: ResplitState, base: Metrics, agents: number): ResplitView {
  const tasks = applyEffort(state.base, state.tasks);
  const { collisions, collisionScore } = rescoreOwnership(tasks);
  const s = schedule(tasks, agents);
  return {
    tasks,
    collisions,
    collisionScore,
    criticalPath: s.criticalPath,
    criticalPathMinutes: s.criticalPathMinutes,
    metrics: {
      ...base,
      collisionScore,
      serialMinutes: s.serialMinutes,
      parallelMinutes: s.parallelMinutes,
      speedup: s.speedup,
      agents: s.agents,
      criticalPath: s.criticalPath,
    },
    edited: state.tasks !== state.base,
  };
}

/**
 * Collisions a drop *would* create, used to flash the overlap red while a file is still in
 * flight. The file is added to the target without leaving its current owner, so the heatmap can
 * show the conflict before the resolved move lands.
 */
export function previewOwnership(
  tasks: Task[],
  file: string,
  toTaskId: string,
): { collisions: Collision[]; collisionScore: number } {
  const path = normalizePath(file);
  const target = tasks.find((t) => t.id === toTaskId);
  if (!path || !target) return rescoreOwnership(tasks);
  const next = tasks.map((t) =>
    t.id === toTaskId && !t.ownedFiles.includes(path)
      ? { ...t, ownedFiles: [...t.ownedFiles, path] }
      : t,
  );
  return rescoreOwnership(next);
}

/** Keeps the plan's per-file effort rate, so ownership changes move minutes between tasks. */
function applyEffort(base: Task[], tasks: Task[]): Task[] {
  const byId = new Map(base.map((t) => [t.id, t]));
  return tasks.map((task) => {
    const original = byId.get(task.id);
    if (!original || original.ownedFiles.length === 0) return task;
    const rate = original.estMinutes / original.ownedFiles.length;
    const estMinutes = Math.max(0, Math.round(rate * task.ownedFiles.length));
    return estMinutes === task.estMinutes ? task : { ...task, estMinutes };
  });
}

/** Files claimed by more than one task in a hypothetical state, for previews. */
export function previewCollisions(tasks: Task[], file: string, toTaskId: string): Collision[] {
  return previewOwnership(tasks, file, toTaskId).collisions;
}
