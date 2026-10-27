"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  type Dragging,
  type Preview,
  type ResplitContextValue,
  ResplitProvider,
} from "@/components/resplit/resplit-context";
import {
  initialResplit,
  previewOwnership,
  type ResplitMove,
  resplitReducer,
  type ResplitView,
  resplitView,
} from "@/lib/client/resplit";
import type { Metrics } from "@/lib/plan/events";
import type { Collision } from "@/lib/partition/ownership";
import { taskLabels } from "@/lib/partition/waves";
import type { Task } from "@/lib/types";

export type ResplitController = {
  view: ResplitView | null;
  canEdit: boolean;
  edited: boolean;
  canUndo: boolean;
  moves: number;
  lastMove: ResplitMove | null;
  dragging: Dragging;
  hoveredTask: string | null;
  preview: Preview;
  claims: Collision[];
  claimScore: number;
  moveFile: (file: string, to: string) => void;
  undo: () => void;
  reset: () => void;
  startDrag: (file: string, from: string) => void;
  endDrag: () => void;
  setHoveredTask: (id: string | null) => void;
  context: ResplitContextValue;
};

type Args = {
  tasks: Task[] | null;
  metrics: Metrics | null;
  agents: number;
  /** Changes only when the plan itself changes, which is when the edit history resets. */
  planKey: string | null;
};

/** Owns the interactive ownership state for a finished plan: moves, undo, preview and metrics. */
export function useResplitPlan({ tasks, metrics, agents, planKey }: Args): ResplitController {
  const [state, dispatch] = useReducer(resplitReducer, tasks ?? [], initialResplit);
  const [dragging, setDragging] = useState<Dragging>(null);
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);

  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  useEffect(() => {
    dispatch({ type: "init", tasks: tasksRef.current ?? [] });
    setDragging(null);
    setHoveredTask(null);
  }, [planKey]);

  const view = useMemo(
    () => (tasks && metrics ? resplitView(state, metrics, agents) : null),
    [state, tasks, metrics, agents],
  );

  const preview = useMemo<Preview>(
    () =>
      dragging && hoveredTask && hoveredTask !== dragging.from
        ? { file: dragging.file, from: dragging.from, to: hoveredTask }
        : null,
    [dragging, hoveredTask],
  );

  const previewState = useMemo(
    () => (preview && view ? previewOwnership(view.tasks, preview.file, preview.to) : null),
    [preview, view],
  );

  const canEdit = Boolean(view && (tasks?.length ?? 0) > 0);
  const canUndo = state.past.length > 0;

  const moveFile = useCallback((file: string, to: string) => {
    dispatch({ type: "move", file, toTaskId: to });
    setDragging(null);
    setHoveredTask(null);
  }, []);
  const undo = useCallback(() => {
    dispatch({ type: "undo" });
    setDragging(null);
    setHoveredTask(null);
  }, []);
  const reset = useCallback(() => {
    dispatch({ type: "reset" });
    setDragging(null);
    setHoveredTask(null);
  }, []);
  const startDrag = useCallback((file: string, from: string) => {
    setDragging({ file, from });
    setHoveredTask(null);
  }, []);
  const endDrag = useCallback(() => {
    setDragging(null);
    setHoveredTask(null);
  }, []);
  const setHover = useCallback((id: string | null) => setHoveredTask(id), []);

  // Cmd/Ctrl+Z anywhere except inside a form field.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey) return;
      if (event.key.toLowerCase() !== "z" || !canUndo) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canUndo, undo]);

  const labels = useMemo(() => taskLabels(view?.tasks ?? []), [view]);
  const claims = useMemo(
    () => previewState?.collisions ?? view?.collisions ?? [],
    [previewState, view],
  );
  const claimScore = previewState?.collisionScore ?? view?.collisionScore ?? 0;
  const focusFile = preview?.file ?? state.lastMove?.file ?? null;

  const context = useMemo<ResplitContextValue>(
    () => ({
      canEdit,
      tasks: view?.tasks ?? [],
      labels,
      collisions: view?.collisions ?? [],
      claims,
      collisionScore: view?.collisionScore ?? 0,
      claimScore,
      dragging,
      hoveredTask,
      preview,
      focusFile,
      startDrag,
      endDrag,
      setHoveredTask: setHover,
      moveFile,
    }),
    [
      canEdit,
      view,
      labels,
      claims,
      claimScore,
      dragging,
      hoveredTask,
      preview,
      focusFile,
      startDrag,
      endDrag,
      setHover,
      moveFile,
    ],
  );

  return {
    view,
    canEdit,
    edited: view?.edited ?? false,
    canUndo,
    moves: state.past.length,
    lastMove: state.lastMove,
    dragging,
    hoveredTask,
    preview,
    claims,
    claimScore,
    moveFile,
    undo,
    reset,
    startDrag,
    endDrag,
    setHoveredTask: setHover,
    context,
  };
}

/** Convenience wrapper so plan screens only need one element around their tree. */
export function ResplitScope({
  controller,
  children,
}: {
  controller: ResplitController;
  children: React.ReactNode;
}) {
  return <ResplitProvider value={controller.context}>{children}</ResplitProvider>;
}
