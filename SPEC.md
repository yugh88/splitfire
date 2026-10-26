# Splitfire — Locked Spec (OpenFire Hackathon)

> **One-liner:** Paste a GitHub repo + a feature request. Splitfire turns it into a
> collision-proof graph of tasks that parallel coding agents can run at the same time —
> each with its own contract, context pack, model, cost, and acceptance checks.

**Tagline:** *Split the work. Not the codebase.*

---

## 1. Problem

Running several coding agents on one repo fails in four ways:

1. **Merge conflicts:** two agents edit the same file.
2. **Idle agents:** task B waits for task A, so parallelism collapses into a queue.
3. **Context bloat:** every agent gets the whole repo; slow, expensive, and weak on open models.
4. **No proof of done:** a human still checks every result.

**Users:** developers running parallel coding agents (Alan, Cursor, Codex, Claude Code, etc.).

---

## 2. Locked features

### Must ship (the demo depends on these)

| # | Feature | What it does | Done when |
|---|---|---|---|
| F1 | **Repo ingest** | Public GitHub URL → file tree + contents via GitHub REST (no clone) | Works on a 300-file TS repo in < 10 s |
| F2 | **Import graph** | web-tree-sitter parses TS/JS/Python imports into a dependency graph | Graph matches real imports on a sample repo |
| F3 | **Streaming planner** | Open model proposes tasks (title, goal, files owned, depends-on); streamed so the graph grows node by node | Nodes appear live; output validated by Zod |
| F4 | **Collision-proof partitioning** | Deterministic code assigns each file to exactly one task; computes a collision score; auto-repairs overlaps | Final plan always has collision score 0, or explains why not |
| F5 | **Contracts-first** | Detects dependency chains; inserts a tiny "contract" task (shared types, signatures, API shapes) so dependents run in parallel | Demo shows a chain turning into a fan-out |
| F6 | **Speedup score** | Critical path vs. serial effort → "Serial 6h → 1.5h with 4 agents (4×)" | Number shown on every plan |
| F7 | **Graph UI** | React Flow + ELK layout, task cards, collision heatmap toggle, ember animation on completion | Smooth at 40 nodes, readable at phone width |
| F8 | **Export** | Copy Alan-ready prompts per task, download `.splitfire/` markdown pack, plan JSON | One click per format |

### Should ship (Tuesday morning)

| # | Feature | What it does |
|---|---|---|
| F9 | **Context packs** | Each task gets only the files it needs (owned + direct imports) + a brief; UI shows "tokens saved vs. full repo" |
| F10 | **Model routing + cost** | Small model for easy tasks, strong model for hard ones; per-task and total cost estimate |
| F11 | **Acceptance gates** | Each task lists commands/checks that prove it's done (test, build, file exists) |
| F12 | **Share links** | `/p/<planId>` read-only plan pages |

### Stretch (cut first, in this order)

| # | Feature |
|---|---|
| F15 | CLI: `npx splitfire plan "<request>"` writes `.splitfire/` |
| F14 | Live mission control: watch `splitfire/<task-id>` branches, light up nodes as they land |
| F13 | "Re-split" button: user drags a file to another task; collision score recomputes live |

**Never cut:** F3 graph, F4 heatmap, F5 contracts-first, F6 speedup number.

**Known limit (state it in the README):** v1 guarantees no *file* overlap. Semantic conflicts
(two tasks changing behaviour the other relies on) are caught by acceptance gates, not prevented.

---

## 3. Tech stack (locked)

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript (strict) |
| Styling | Tailwind CSS + shadcn/ui + Framer Motion |
| Graph view | @xyflow/react (React Flow) + elkjs layout |
| Parsing | web-tree-sitter (WASM) with TS/JS/Python grammars; regex fallback |
| Graph math | graphology + graphology-dag (toposort, cycles, critical path) |
| LLM | Vercel AI SDK (`ai`) + `@ai-sdk/openai-compatible`, `streamObject` + Zod |
| Models | Open models only. `PLANNER_MODEL` (strong), `FAST_MODEL` (small), `FALLBACK_*` |
| Data | Upstash Redis: plan store, cache, rate limits |
| Repo access | GitHub REST API (`GITHUB_TOKEN` optional, raises rate limit) |
| Tests | Vitest (core logic), Playwright (one smoke test of the main flow) |
| Quality | ESLint + Prettier, `tsc --noEmit` in CI |
| CI | GitHub Actions: lint, typecheck, test on push |
| Deploy | Vercel |
| License | MIT |

**Look and feel:** dark grid background, pixel font (e.g. "Press Start 2P" or "Silkscreen")
for headings only, Inter/Geist for body. Fire palette accents (amber → red). Nodes glow
and emit embers on completion. Matches OpenFire's retro style without copying its art.

---

## 4. System design

```
Browser (Next.js UI, React Flow)
   │  POST /api/plan  → SSE stream of plan events
   ▼
API (stateless route handlers, Node runtime)
   ├── ingest/      GitHub REST → FileTree           cache: tree:{owner}/{repo}@{sha}
   ├── analyze/     tree-sitter → ImportGraph        pure + deterministic
   ├── plan/        LLM router → TaskProposal[]      Zod-validated, 1 repair retry
   ├── partition/   ownership + collisions + contracts + critical path   pure + deterministic
   ├── context/     per-task context packs + token counts
   ├── cost/        model routing + cost estimate
   └── store/       Upstash Redis: plan:{id}, ratelimit:{ip}
```

### Principles

1. **Deterministic core, LLM on the edges.** Parsing, partitioning, collision checks,
   contracts and critical path are plain, unit-tested functions. The LLM only *proposes*
   groupings; code *verifies* and repairs them.
2. **Validate → repair → fallback.** Every LLM output passes a Zod schema plus a DAG check
   (no cycles, every file owned once). On failure: one retry with the error attached, then
   the fallback model, then a deterministic plan from graph communities.
3. **Cache by commit SHA.** Same repo@sha skips fetch and parse.
4. **Stateless + streaming.** Scales horizontally; the user sees progress, not a spinner.
5. **Idempotent plan IDs.** `planId = hash(repo, sha, request, settingsVersion)`.
6. **Guard the credits.** Rate limit 5 plans/IP/hour; repo cap ~500 source files or 2 MB;
   hard token cap per plan; skip vendored/generated/lock files.
7. **Privacy by default.** Public repos, no login, no source stored; only the plan is saved.
8. **Observability.** Log per request: duration, tokens in/out, model used, retries, cache hit.

### Core types (contract between modules)

```ts
type FileNode   = { path: string; lang: "ts" | "js" | "py" | "other"; bytes: number };
type ImportEdge = { from: string; to: string };
type Task = {
  id: string; title: string; goal: string;
  kind: "contract" | "feature" | "test" | "docs";
  ownedFiles: string[];        // exclusive
  readFiles: string[];         // context only
  dependsOn: string[];
  difficulty: 1 | 2 | 3;
  model: string; estTokens: number; estCostUsd: number; estMinutes: number;
  acceptance: string[];
};
type Plan = {
  id: string; repo: string; sha: string; request: string;
  tasks: Task[]; collisionScore: number;
  serialMinutes: number; parallelMinutes: number; speedup: number; agents: number;
  tokensFullRepo: number; tokensWithPacks: number; totalCostUsd: number;
};
// SSE events: "ingested" | "graph" | "task" | "partitioned" | "metrics" | "done" | "error"
```

---

## 5. Credits plan (per the OpenFire email)

### 5.1 Alan setup checklist (do this yourself, by hand — ~10 min)

- [ ] Download the Alan desktop app (Windows or Mac) from https://tryalan.ai/download/
- [ ] Create your account and complete onboarding
- [ ] Go to **Settings → Organization → Plan**
- [ ] Select the **$10 Individual Plan**
- [ ] Apply promo code **`ALANOPENFIRE2026`**. The price must show **$0** before you confirm. If it asks for a card, stop and ask on Discord, since the email says no card is needed
- [ ] Confirm the $20 open-model credits appear in your account, and note which models they cover
- [ ] Ask on Discord: can the credits be used through an API key (for Splitfire's deployed app), or only inside the Alan app?
- [ ] Open the Splitfire repo folder in Alan and paste the kickoff prompt from `PROMPT.md`

### 5.2 Hard credit limits (enforced in code, not just a plan)

Splitfire must never spend more than the credits allow. These rules are mandatory:

- `CREDIT_BUDGET_USD` env var (default `5`): the total that the **deployed app** may spend.
- `PLAN_MAX_COST_USD` env var (default `0.05`): the hard cap for a single plan.
- Before every LLM call, estimate its cost from the input tokens and the model's price
  (`MODEL_PRICES_JSON` env var, USD per 1M input/output tokens). If the call would push the
  plan or the total over its cap, **don't make the call**. Fall back to the deterministic
  plan and tell the user "demo budget reached".
- After every call, add the real token usage to a running total in Redis (`spend:total`,
  `spend:day:{date}`), using an atomic increment.
- When `spend:total` reaches 90% of the budget, switch all calls to `FAST_MODEL`. At 100%,
  disable LLM planning entirely; the deterministic planner keeps the app working.
- A `/api/health` route shows spend used vs. budget (numbers only, no secrets).
- In local dev, use a fixture/mock mode (`MOCK_LLM=1`) for UI work, so building the UI costs nothing.

### 5.3 Budget split

**$20 open-model credits:** first confirm on Discord **where** they apply: only inside the
Alan app, or also as an API key. If only inside Alan, Splitfire's runtime needs a separate
OpenAI-compatible open-model endpoint; the code stays provider-agnostic via env vars, so
this is a config change only.

| Bucket | Budget | Notes |
|---|---|---|
| Building with Alan | ~$8 | Use the strong model for planning and hard tasks, the small one for boilerplate |
| Dev testing of Splitfire's planner | ~$3 | Test on small repos; cache by SHA |
| Demo rehearsal + recording | ~$2 | Pre-warm the cache for the demo repo |
| Public usage during judging | ~$5 | Rate limits + token caps on |
| Reserve | ~$2 | Never spend it before submission |

Show a live **"credits used"** counter in the dev logs. Stop public planning if spend passes
the bucket.

---

## 6. Repo layout

```
splitfire/
  app/                 # Next.js routes: /, /p/[id], /api/plan
  components/          # graph, task-card, heatmap, metrics-bar, export-menu
  lib/
    ingest/  analyze/  plan/  partition/  context/  cost/  store/
    types.ts           # the contract above
  tests/               # vitest unit tests for lib/*
  e2e/                 # one Playwright smoke test
  .splitfire/          # Splitfire's own plan used to build itself (demo proof)
  .env.example
  README.md  LICENSE  SPEC.md
```

---

## 7. Timeline (IST)

| When | Goal |
|---|---|
| Mon 3–6 PM | Scaffold, F1 ingest, F2 import graph, types, CI |
| Mon 6–10 PM | F3 planner (streaming), F4 partitioning + collisions |
| Mon 10 PM–1 AM | F7 graph UI, heatmap, F6 speedup score |
| Mon 1–7 AM | Sleep |
| Tue 7 AM–12 PM | F5 contracts-first, F9 context packs, F10 routing + cost, F11 gates |
| Tue 12–4 PM | F8 exports, F12 share links, deploy, stretch if ahead |
| Tue 4–6 PM | Polish, README + GIF, test on 3 real repos |
| Tue 6–8 PM | Record 1–3 min demo, post on X |
| Tue by 10 PM | Submit: X post + working link + public repo |

## 8. Demo script (90 seconds)

1. **0–10 s, hook:** "4 agents, 1 repo, 0 merge conflicts. Here's how."
2. **10–40 s:** paste a well-known open-source repo + a feature request; the graph grows live.
3. **40–60 s:** toggle the heatmap; it goes red → zero. Show contracts-first turning a chain into a fan-out.
4. **60–75 s:** speedup number, tokens saved, cost per plan.
5. **75–90 s:** "Splitfire planned its own build. Alan's agents ran it in parallel on open models." Link + repo.
