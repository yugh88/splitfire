# T3 · Interactive Re-split UI

Repo: yugh88/splitfire @ be45d6a · Branch: `splitfire/drag-and-drop-ui`
Overall feature: Add an npx splitfire CLI that plans a repo and writes the .splitfire pack, and a re-split interaction where the user drags a file to another task and the collision score recomputes live
Plan: https://splitfire-one.vercel.app/p/cf0746ed8f6c7194
Suggested model: strong model (gemma-4-26b-a4b-it) · Estimate: 31 min

## Goal
Implement drag-and-drop file movement between tasks with live collision score updates.

## Files you own (edit only these)
- `components/task-card.tsx`
- `components/plan-screen.tsx`

## Context pack (read-only, do not edit)
- `components/export-actions.tsx`
- `lib/format.ts`
- `lib/types.ts`
- `lib/utils.ts`
- `components/graph/task-graph.tsx`
- `components/heatmap-view.tsx`
- `components/kind.ts`
- `components/logo.tsx`
- `components/metric-cards.tsx`
- `components/progress-steps.tsx`
- `components/ui/button.tsx`
- `components/wave-list.tsx`
- `hooks/use-media-query.ts`
- `lib/client/graph-model.ts`
- `lib/client/plan-state.ts`
- `lib/cost/estimate.ts`

## Before you start
- Wait for T1 (Re-split Collision Logic) to be merged.

## Done when
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `git diff --name-only touches only owned files`

## Rules
- Change only the files you own. Other agents are editing the rest of the repo in parallel.
- If you truly need to change a file you do not own, stop and report it instead of editing it.
- Keep the change focused on the goal; no drive-by refactors.
