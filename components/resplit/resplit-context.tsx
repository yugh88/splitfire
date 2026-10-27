"use client";

import { createContext, useContext } from "react";
import type { Collision } from "@/lib/partition/ownership";
import type { Task } from "@/lib/types";

/** Custom MIME so a file drop can be told apart from a stray text drag. */
export const RESPLIT_MIME = "application/x-splitfire-file";

export type Dragging = { file: string; from: string } | null;
export type Preview = { file: string; from: string; to: string } | null;

export type ResplitContextValue = {
  canEdit: boolean;
  tasks: Task[];
  labels: Map<string, string>;
  /** Collisions in the current plan. */
  collisions: Collision[];
  /** Collisions plus the overlap a drop in flight would create. */
  claims: Collision[];
  collisionScore: number;
  claimScore: number;
  dragging: Dragging;
  hoveredTask: string | null;
  preview: Preview;
  /** The file in flight, or the last one moved, so the heatmap can keep its row in view. */
  focusFile: string | null;
  startDrag: (file: string, from: string) => void;
  endDrag: () => void;
  setHoveredTask: (id: string | null) => void;
  moveFile: (file: string, to: string) => void;
};

const ResplitContext = createContext<ResplitContextValue | null>(null);

export function ResplitProvider({
  value,
  children,
}: {
  value: ResplitContextValue;
  children: React.ReactNode;
}) {
  return <ResplitContext.Provider value={value}>{children}</ResplitContext.Provider>;
}

/** Null outside an editable plan, so nodes and cards stay inert while a plan streams. */
export function useResplit(): ResplitContextValue | null {
  return useContext(ResplitContext);
}

/** Props for the draggable part of an owned-file row. */
export function dragProps(value: ResplitContextValue, file: string, from: string) {
  return {
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData(RESPLIT_MIME, file);
      e.dataTransfer.setData("text/plain", file);
      e.dataTransfer.effectAllowed = "move";
      value.startDrag(file, from);
    },
    onDragEnd: () => value.endDrag(),
  };
}

/** Props that make a task node or heatmap column accept a file drop. */
export function dropProps(value: ResplitContextValue, taskId: string) {
  const isFileDrag = (e: React.DragEvent) =>
    Array.from(e.dataTransfer.types).includes(RESPLIT_MIME);
  return {
    onDragEnter: (e: React.DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      value.setHoveredTask(taskId);
    },
    onDragOver: (e: React.DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      value.setHoveredTask(taskId);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) value.setHoveredTask(null);
    },
    onDrop: (e: React.DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      const file = e.dataTransfer.getData(RESPLIT_MIME) || e.dataTransfer.getData("text/plain");
      value.endDrag();
      if (file) value.moveFile(file, taskId);
    },
  };
}
