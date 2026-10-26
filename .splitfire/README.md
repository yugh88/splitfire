# Splitfire plan: Add an npx splitfire CLI that plans a repo and writes the .splitfire pack, and a re-split interaction where the user drags a file to another task and the collision score recomputes live

Repo: yugh88/splitfire @ be45d6a · https://splitfire-one.vercel.app/p/cf0746ed8f6c7194

Serial 1h 46m → 57m with 2 agents (1.9×) · collision score 0 · est. cost $0.000

Run each wave in parallel, one agent per task, each on its own `splitfire/<task-id>` branch.
Start a wave when every task it waits for is merged. Every file has exactly one owner.

| Task | Wave | Kind | Title | Files | Waits for | Model | Estimate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T0 | 1 | contract | CLI & Pack Contract | 1 | — | fast | 11 min |
| T1 | 1 | feature | Re-split Collision Logic | 1 | — | fast | 18 min |
| T2 | 2 | feature | Splitfire CLI Implementation | 1 | T0 | strong | 28 min |
| T3 | 2 | feature | Interactive Re-split UI | 2 | T1 | strong | 31 min |
| T4 | 3 | test | CLI Integration Tests | 1 | T2 | fast | 18 min |

Prompts for each task are in `tasks/`. The full plan is in `plan.json`.
