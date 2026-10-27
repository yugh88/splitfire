#!/usr/bin/env node
// Launches the TypeScript CLI with Splitfire's own tsconfig, so its `@/` imports resolve even
// when the command runs inside another repository.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const result = spawnSync(
  "npx",
  [
    "--yes",
    "tsx",
    "--tsconfig",
    path.join(root, "tsconfig.json"),
    path.join(root, "bin", "splitfire.ts"),
    ...process.argv.slice(2),
  ],
  { stdio: "inherit", shell: process.platform === "win32" },
);
process.exitCode = result.status ?? 2;
