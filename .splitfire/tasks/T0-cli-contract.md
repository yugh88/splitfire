# T0 · CLI & Pack Contract

Repo: yugh88/splitfire @ be45d6a · Branch: `splitfire/cli-contract`
Overall feature: Add an npx splitfire CLI that plans a repo and writes the .splitfire pack, and a re-split interaction where the user drags a file to another task and the collision score recomputes live
Plan: https://splitfire-one.vercel.app/p/cf0746ed8f6c7194
Suggested model: fast model (gemma-4-26b-a4b-it) · Estimate: 11 min

## Goal
Define the CLI command structure and the schema for the .splitfire pack file.

## Files you own (edit only these)
- `package.json`

## Done when
- [ ] `npm run typecheck`
- [ ] `git diff --name-only touches only owned files`

## Rules
- Change only the files you own. Other agents are editing the rest of the repo in parallel.
- If you truly need to change a file you do not own, stop and report it instead of editing it.
- Keep the change focused on the goal; no drive-by refactors.
