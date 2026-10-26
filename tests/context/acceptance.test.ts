import { describe, expect, it } from "vitest";
import type { Tooling } from "@/lib/analyze/tooling";
import { acceptanceChecks, OWNED_ONLY } from "@/lib/context/acceptance";

const node: Tooling = {
  packageManager: "pnpm",
  scripts: ["build", "test", "typecheck"],
  testRunner: "vitest",
  typescript: true,
};
const existing = new Set(["src/a.ts", "src/a.test.ts"]);

describe("acceptanceChecks", () => {
  it("runs the task's own tests and the repo typecheck", () => {
    expect(
      acceptanceChecks(
        { kind: "feature", ownedFiles: ["src/a.ts", "src/a.test.ts"] },
        node,
        existing,
      ),
    ).toEqual(["npx vitest run src/a.test.ts", "pnpm run typecheck", "pnpm run build", OWNED_ONLY]);
  });

  it("requires new files to exist and never drops the owned-files gate", () => {
    const checks = acceptanceChecks(
      {
        kind: "feature",
        ownedFiles: ["src/new1.ts", "src/new2.ts", "src/new3.ts", "src/new.test.ts"],
      },
      node,
      existing,
    );
    expect(checks).toContain("test -f src/new1.ts");
    expect(checks).toHaveLength(5);
    expect(checks.at(-1)).toBe(OWNED_ONLY);
  });

  it("uses pytest and py_compile for python and skips build for contracts", () => {
    const py: Tooling = {
      packageManager: null,
      scripts: [],
      testRunner: "pytest",
      typescript: false,
    };
    expect(
      acceptanceChecks(
        { kind: "test", ownedFiles: ["tests/test_api.py"] },
        py,
        new Set(["tests/test_api.py"]),
      ),
    ).toEqual(["pytest tests/test_api.py", OWNED_ONLY]);
    expect(
      acceptanceChecks(
        { kind: "contract", ownedFiles: ["app/types.py"] },
        py,
        new Set(["app/types.py"]),
      ),
    ).toEqual(["python -m py_compile app/types.py", OWNED_ONLY]);
  });
});
