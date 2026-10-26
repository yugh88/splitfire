import { describe, expect, it } from "vitest";
import { detectTooling } from "@/lib/analyze/tooling";
import { selectFiles } from "@/lib/ingest/filter";

describe("detectTooling", () => {
  it("reads package manager, scripts and test runner", () => {
    const pkg = JSON.stringify({
      scripts: { test: "vitest", build: "tsc" },
      devDependencies: { vitest: "3" },
    });
    expect(
      detectTooling(["package.json", "pnpm-lock.yaml", "src/a.ts"], { "package.json": pkg }),
    ).toEqual({
      packageManager: "pnpm",
      scripts: ["build", "test"],
      testRunner: "vitest",
      typescript: true,
    });
  });

  it("detects pytest projects and repos without a manifest", () => {
    expect(
      detectTooling(["pyproject.toml", "tests/test_api.py"], { "pyproject.toml": "[project]" }),
    ).toMatchObject({
      packageManager: null,
      testRunner: "pytest",
      typescript: false,
    });
  });
});

describe("selectFiles manifests", () => {
  it("always keeps root manifests even when source fills the cap", () => {
    const entries = [
      ...Array.from({ length: 600 }, (_, i) => ({ path: `src/f${i}.ts`, bytes: 1 })),
      { path: "package.json", bytes: 1 },
    ];
    expect(selectFiles(entries).files.some((f) => f.path === "package.json")).toBe(true);
  });
});
