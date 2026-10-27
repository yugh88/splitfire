#!/usr/bin/env -S npx --yes tsx
import { main } from "../cli/main";

void main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  },
);
