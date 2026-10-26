# Splitfire

> Split the work. Not the codebase.

Paste a GitHub repo and a feature request. Splitfire turns it into a collision-proof graph of
tasks that parallel coding agents can run at the same time — each with its own contract,
context pack, model, cost, and acceptance checks.

## Status

Work in progress for the OpenFire hackathon. See [SPEC.md](SPEC.md) for the locked spec.

## Quick start

```sh
npm install
cp .env.example .env.local   # MOCK_LLM=1 needs no keys
npm run dev
```

## Scripts

| Command             | What it does          |
| ------------------- | --------------------- |
| `npm run dev`       | Start the dev server  |
| `npm run lint`      | ESLint                |
| `npm run typecheck` | `tsc --noEmit`        |
| `npm test`          | Vitest unit tests     |
| `npm run test:e2e`  | Playwright smoke test |

## Architecture

_Coming soon._

## Known limits

v1 guarantees no _file_ overlap between tasks. Semantic conflicts (two tasks changing behaviour
the other relies on) are caught by acceptance gates, not prevented.

## License

[MIT](LICENSE)
