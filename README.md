# Splitfire

**Split the work. Not the codebase.**

Paste a GitHub repo and a feature request. Splitfire turns it into a collision-proof graph of tasks
that coding agents can run at the same time — each with its own contract, context pack, model, cost
estimate and acceptance checks.

[Live demo](https://splitfire-one.vercel.app) · [Example plan](https://splitfire-one.vercel.app/p/43e1f368e8a2c689)

![Splitfire landing page](docs/landing.png)

## The problem

Running several coding agents on one repo fails in four ways:

- **Merge conflicts.** Two agents edit the same file.
- **Idle agents.** Task B waits for task A, so parallelism collapses into a queue.
- **Context bloat.** Every agent reads the whole repo: slow, expensive, and weak on open models.
- **No proof of done.** A human still has to check every result.

Splitfire plans around all four before a single agent starts.

## A real plan

These numbers come from an actual `POST /api/plan` call with an open model, not a mock. The plan
targets [`shadcn-ui/taxonomy`](https://github.com/shadcn-ui/taxonomy) at commit
`298a885` and asks for "Add OAuth login" with four agents.

| Result          | Value                                                 |
| --------------- | ----------------------------------------------------- |
| Tasks           | 5, across 3 agents                                    |
| File collisions | **0** — every file has exactly one owner              |
| Schedule        | **1h 36m serial → 46m parallel (2.1×)**               |
| Context         | **8.8k tokens** with packs vs **428.8k** for the repo |
| Cost            | **$0.00** — open-model endpoint priced at $0          |
| Critical path   | `auth-contract → oauth-integration-test`              |
| Planner         | `gemma-4-26b-a4b-it`, planner mode `llm`              |

Every number is rendered from the committed fixture in `data/featured-plan.json`; regenerate the
fixture instead of editing the stats by hand. The full plan is a read-only share page:
<https://splitfire-one.vercel.app/p/43e1f368e8a2c689>.

![Task graph for the real plan](docs/plan-graph.png)

Contracts run first, then dependent work fans out. The heatmap shows what the model's draft got
wrong and what the deterministic repair fixed:

![Collision heatmap and repair log](docs/heatmap.png)

## How it works

```mermaid
flowchart LR
  UI["Browser<br/>Next.js + React Flow"] -- "POST /api/plan" --> API["Route handlers<br/>(Node, stateless)"]
  API -- "SSE: ingested · graph · task · partitioned · metrics · done" --> UI
  API --> Ingest["ingest/<br/>GitHub REST, no clone"]
  Ingest --> Analyze["analyze/<br/>tree-sitter import graph"]
  Analyze --> Plan["plan/<br/>LLM proposes tasks<br/>Zod + repair + fallback"]
  Plan --> Partition["partition/<br/>ownership · cycles · contracts · critical path"]
  Partition --> Context["context/<br/>packs · acceptance · exports"]
  Context --> Cost["cost/<br/>routing + estimates"]
  Analyze <--> Store[("Upstash Redis<br/>tree:{repo}@{sha} · plan:{id}<br/>spend:* · ratelimit:*")]
  Cost --> Store
```

1. **Map.** tree-sitter parses every import, so ownership follows how the code actually connects.
2. **Split.** Deterministic code assigns each file exactly one owner, inserts a small contract task
   ahead of shared types, repairs overlaps and cycles, and schedules the critical path.
3. **Ship.** Each task gets a context pack, a model, a cost estimate and acceptance checks. Copy an
   Alan-ready prompt, download the `.splitfire/` pack, or export the plan JSON.

**Deterministic core, LLM on the edges.** Parsing, partitioning, collision checks, contracts and the
critical path are plain, unit-tested functions. The model only _proposes_ groupings; code verifies
and repairs them. Every model answer passes Zod plus a DAG check. On failure: one retry with the
error, then the fallback model, then a deterministic plan built from import-graph communities.

Repos are cached by commit SHA and plan ids are `hash(repo, sha, request, agents, settingsVersion)`,
so repeating a request replays the stored plan for free. No source code is stored — only the plan.

## What ships

- **Repo ingest** — public GitHub repos via REST, no clone; vendored, generated and lock files are
  skipped, and files are capped at 500 / 2 MB.
- **Real import graph** — tree-sitter (WASM) for TS/JS/Python, with a regex fallback.
- **Streaming planner** — tasks appear node by node over SSE, not behind a spinner.
- **Collision-proof partitioning** — one owner per file, automatic repair of overlaps and cycles;
  the heatmap shows the draft's clashes next to the repaired plan.
- **Contracts-first** — shared types and API surfaces become a tiny contract task so a chain of
  waiting work becomes a fan-out. Kept only when it shortens the schedule.
- **Speedup score** — critical path and agent scheduling on every plan.
- **Context packs** — each task gets its owned files plus their direct imports, not the repo.
- **Model routing + cost** — a fast model for easy tasks, the strong model for hard ones, with
  per-task and total estimates.
- **Acceptance gates** — checks generated from the repo's real tooling (vitest/jest/pytest,
  typecheck, build, required files, and "the diff touches only owned files").
- **Mission control** — optionally watch `splitfire/<task>` branches and light up each task as it
  moves through working, checking, passed, failed and merged.
- **Export and share** — copy Alan-ready prompts per task or all at once, download the `.splitfire/`
  pack or plan JSON, and share read-only plans at `/p/<planId>`.

## Built with Alan and open models

Splitfire was built by parallel Alan agents working on separate `splitfire/*` branches — the same
workflow it plans for you. It also planned part of itself: `.splitfire/plan.json` is Splitfire's own
plan for adding a CLI and interactive re-split, split into five tasks with zero file collisions.

Planning runs on open models through an OpenAI-compatible endpoint. The fixture above was produced
by `gemma-4-26b-a4b-it`; a smaller model handles easy tasks and a fallback endpoint is tried before
the deterministic planner.

## Quick start

Requires Node 20+.

```sh
git clone https://github.com/yugh88/splitfire && cd splitfire
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>. `.env.example` ships with `MOCK_LLM=1`, so the UI works with fixture
plans and no keys. For real plans, set `MOCK_LLM=0` and fill in `OPENMODEL_BASE_URL`,
`OPENMODEL_API_KEY`, `PLANNER_MODEL` and `MODEL_PRICES_JSON`. With no model configured, Splitfire
plans deterministically and labels the plan as such.

A `GITHUB_TOKEN` is optional; it raises GitHub's 60-requests-per-hour anonymous limit. Upstash Redis
is optional too — without it, plans, rate limits and spend live in memory.

## Configuration

| Variable                                                  | Purpose                                                              |
| --------------------------------------------------------- | -------------------------------------------------------------------- |
| `OPENMODEL_BASE_URL`, `OPENMODEL_API_KEY`                 | Primary OpenAI-compatible open-model endpoint                        |
| `PLANNER_MODEL`, `FAST_MODEL`                             | Strong and small model ids                                           |
| `FALLBACK_BASE_URL`, `FALLBACK_API_KEY`, `FALLBACK_MODEL` | Fallback endpoint                                                    |
| `MODEL_PRICES_JSON`                                       | USD per 1M tokens per model, e.g. `{"m":{"input":0.6,"output":2.4}}` |
| `CREDIT_BUDGET_USD`, `PLAN_MAX_COST_USD`                  | Total and per-plan spend caps (defaults `5` and `0.05`)              |
| `MOCK_LLM`                                                | `1` = fixture plans, no model calls                                  |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`      | Plan store, cache, spend and rate limits (in-memory if unset)        |
| `GITHUB_TOKEN`                                            | Optional; raises the GitHub rate limit                               |

**Credit guards.** Before every model call the worst-case cost is checked against both caps using
`MODEL_PRICES_JSON`; a call that could exceed them is not made, and unpriced models are never
called. Real usage is recorded after each call. At 90% of the budget every call switches to
`FAST_MODEL`; at 100% the deterministic planner takes over. The app is also limited to 5 plans per
IP per hour. `GET /api/health` reports spend and the current mode (numbers only, no secrets).

## API

- `POST /api/plan` with `{ "repo": "owner/repo", "request": "...", "agents": 4 }` streams SSE:
  `ingested`, `graph`, `task`, `partitioned`, `metrics`, `done`, `error`.
- `GET /api/health` returns spend, budget and the planning mode.
- `GET /api/track/<planId>` returns live `splitfire/*` branch status for a stored plan.
- `/p/<planId>` is the read-only share page.

## Development

```sh
npm run lint          # ESLint
npm run typecheck     # tsc --noEmit
npm test              # Vitest unit tests
npm run test:e2e      # Playwright smoke test (mock dev server, or set E2E_BASE_URL)
npm run format:check  # Prettier
```

CI runs lint, format check, typecheck and unit tests on every push.

```
app/          routes: /, /p/[id], /api/plan, /api/health, /api/track/[id]
components/   landing, planner, graph, task cards, heatmap, mission control, export
lib/          ingest/ analyze/ plan/ partition/ context/ cost/ gates/ store/ track/ · types.ts
tests/        Vitest unit tests and a fixture repo
e2e/          Playwright smoke test
data/         featured-plan.json — the real plan behind the landing stats
docs/         screenshots used in this README
```

## Known limits

v1 guarantees no _file_ overlap between tasks. Semantic conflicts — two tasks changing behaviour the
other relies on — are caught by the acceptance gates, not prevented. Repos larger than ~500 source
files or 2 MB are planned from a deterministic subset (core source first). Free-tier open-model
endpoints rate-limit; Splitfire retries once, falls back, then uses the deterministic planner.

**In progress:** a CLI (`npx splitfire plan`) that writes the `.splitfire/` pack — the pack schema
and npm entry point are in place in `package.json` — and an interactive re-split where dragging a
file to another task recomputes the collision score live.

## License

[MIT](LICENSE)
