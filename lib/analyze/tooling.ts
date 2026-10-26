import { parseJsonc } from "./resolve";

/** What a repo uses to build and test, so acceptance checks name real commands. */
export type Tooling = {
  packageManager: "npm" | "pnpm" | "yarn" | "bun" | null;
  scripts: string[];
  testRunner: "vitest" | "jest" | "pytest" | null;
  typescript: boolean;
};

const LOCKFILES: [string, NonNullable<Tooling["packageManager"]>][] = [
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["bun.lockb", "bun"],
  ["bun.lock", "bun"],
  ["package-lock.json", "npm"],
];

export function detectTooling(treePaths: string[], contents: Record<string, string>): Tooling {
  const paths = new Set(treePaths);
  const pkg = contents["package.json"] ? parseJsonc(contents["package.json"]) : null;
  const scripts = record(pkg?.scripts);
  const deps = { ...record(pkg?.dependencies), ...record(pkg?.devDependencies) };

  let packageManager: Tooling["packageManager"] = null;
  for (const [file, pm] of LOCKFILES) {
    if (paths.has(file)) {
      packageManager = pm;
      break;
    }
  }
  if (!packageManager && pkg) packageManager = "npm";

  const python = [
    contents["pyproject.toml"],
    contents["requirements.txt"],
    contents["setup.cfg"],
  ].join("\n");
  const pyTests = treePaths.some((p) => /(^|\/)test_[^/]*\.py$|_test\.py$/.test(p));
  const testRunner: Tooling["testRunner"] =
    "vitest" in deps
      ? "vitest"
      : "jest" in deps
        ? "jest"
        : /\bpytest\b/.test(python) || pyTests
          ? "pytest"
          : null;

  return {
    packageManager,
    scripts: Object.keys(scripts).sort(),
    testRunner,
    typescript: paths.has("tsconfig.json") || treePaths.some((p) => /\.tsx?$/.test(p)),
  };
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
