import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parse } from "yaml";
import { gateCommands } from "@/lib/gates/commands";
import {
  GATES_WORKFLOW_PATH,
  GATE_RUNNER_SCRIPT,
  REPORT_SCRIPT,
  generateGatesWorkflow,
} from "@/lib/gates/workflow";
import type { Task } from "@/lib/types";

type GateTask = Pick<Task, "id" | "title" | "dependsOn" | "acceptance">;

const plan = (tasks: GateTask[]) => ({ tasks });

type GateResult = {
  skip?: boolean;
  reason?: string;
  label?: string;
  title?: string;
  conclusion?: string;
  summary?: string;
  checks?: { source: string; kind: string; command: string; status: string }[];
  manual?: { source: string; reason: string }[];
};

function tempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function writeRepo(root: string, tasks: GateTask[], files: Record<string, string> = {}) {
  mkdirSync(join(root, ".splitfire"), { recursive: true });
  writeFileSync(join(root, ".splitfire", "plan.json"), JSON.stringify(plan(tasks), null, 2));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), text);
  }
}

function runGate(
  tasks: GateTask[],
  branch: string,
  files: Record<string, string> = {},
  dryRun = false,
) {
  const root = tempDir("splitfire-gate-");
  writeRepo(root, tasks, files);
  const script = join(root, "gate.mjs");
  writeFileSync(script, GATE_RUNNER_SCRIPT);
  const runnerTemp = join(root, "runner");
  const run = spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      GITHUB_REF_NAME: branch,
      GITHUB_SHA: "abc123",
      RUNNER_TEMP: runnerTemp,
      ...(dryRun ? { SPLITFIRE_GATE_DRY_RUN: "1" } : {}),
    },
  });
  const resultPath = join(runnerTemp, "splitfire", "result.json");
  const result = existsSync(resultPath)
    ? (JSON.parse(readFileSync(resultPath, "utf8")) as GateResult)
    : null;
  return { run, result, root };
}

const task = (id: string, acceptance: string[], extra: Partial<GateTask> = {}): GateTask => ({
  id,
  title: `Title ${id}`,
  dependsOn: [],
  acceptance,
  ...extra,
});

describe("generateGatesWorkflow", () => {
  const yaml = generateGatesWorkflow(plan([task("a", ["npm test"])]));
  const doc = parse(yaml) as Record<string, unknown>;

  it("is valid YAML with the documented name and triggers", () => {
    expect(doc.name).toBe("Splitfire gates");
    const on = doc.on as { push: { branches: string[] } };
    expect(on.push.branches).toEqual(["splitfire/**"]);
  });

  it("asks only for checks: write and contents: read", () => {
    expect(doc.permissions).toEqual({ contents: "read", checks: "write" });
    expect(yaml).not.toContain("write-all");
    expect(yaml).not.toContain("pull_request_target");
  });

  it("runs the gate script and then reports the check run even after a failure", () => {
    const job = (
      doc.jobs as Record<
        string,
        { steps: { name?: string; if?: string; run?: string; uses?: string }[] }
      >
    ).gate!;
    const names = job.steps.map((step) => step.name ?? step.uses);
    expect(names).toContain("Run acceptance checks");
    const report = job.steps.find((step) => step.name === "Report check run");
    expect(report?.if).toBe("always()");
    expect(job.steps.some((step) => step.run?.includes(".splitfire/plan.json"))).toBe(true);
    const envStep = job.steps.find((step) => step.run?.includes("report.mjs")) as
      { env?: Record<string, string> } | undefined;
    expect(envStep?.env?.GITHUB_TOKEN).toContain("secrets.GITHUB_TOKEN");
  });

  it("only trusts a safe task id in the branch name and never reads commit messages", () => {
    expect(yaml).toContain("^splitfire\\/([A-Za-z0-9][A-Za-z0-9._-]{0,63})$");
    expect(yaml).toContain('"splitfire/" + taskRef');
    expect(yaml).not.toContain("head_commit");
    expect(yaml).not.toContain("commit.message");
  });

  it("matches the workflow committed to this repo", () => {
    const committed = readFileSync(join(process.cwd(), GATES_WORKFLOW_PATH), "utf8");
    expect(parse(committed)).toEqual(doc);
  });
});

describe("the embedded gate runner", () => {
  it("passes when every runnable check passes and lists prose as manual", () => {
    const { run, result } = runGate(
      [task("a", ["test -f marker.txt", "git diff --name-only touches only owned files"])],
      "splitfire/T0",
      { "marker.txt": "ok" },
    );
    expect(run.status).toBe(0);
    expect(result?.conclusion).toBe("success");
    expect(result?.checks).toMatchObject([
      {
        source: "test -f marker.txt",
        kind: "file",
        command: "test -f 'marker.txt'",
        status: "passed",
        exitCode: 0,
      },
    ]);
    expect(result?.manual).toEqual([
      { source: "git diff --name-only touches only owned files", reason: "not-a-command" },
    ]);
  });

  it("runs the workflow's own run step end to end", () => {
    const doc = parse(generateGatesWorkflow(plan([task("a", ["test -f marker.txt"])]))) as {
      jobs: Record<string, { steps: { name?: string; run?: string }[] }>;
    };
    const step = doc.jobs.gate!.steps.find((s) => s.name === "Run acceptance checks");
    const root = tempDir("splitfire-step-");
    writeRepo(root, [task("a", ["test -f marker.txt"])], { "marker.txt": "ok" });
    const run = spawnSync("/bin/bash", ["-euo", "pipefail", "-c", step!.run!], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_REF_NAME: "splitfire/T0",
        GITHUB_SHA: "abc123",
        RUNNER_TEMP: join(root, "runner"),
      },
    });
    expect(run.status, run.stderr).toBe(0);
    const result = JSON.parse(
      readFileSync(join(root, "runner", "splitfire", "result.json"), "utf8"),
    ) as GateResult;
    expect(result.conclusion).toBe("success");
    expect(result.checks?.[0]?.command).toBe("test -f 'marker.txt'");
  });

  it("fails when a check fails", () => {
    const { run, result } = runGate([task("a", ["test -f missing.txt"])], "splitfire/T0");
    expect(run.status).toBe(1);
    expect(result?.conclusion).toBe("failure");
    expect(result?.checks?.[0]?.status).toBe("failed");
  });

  it("fails when a task has no runnable checks", () => {
    const { run, result } = runGate([task("a", ["All acceptance criteria pass"])], "splitfire/T0");
    expect(run.status).toBe(1);
    expect(result?.conclusion).toBe("failure");
    expect(result?.summary).toContain("No runnable acceptance checks");
  });

  it("skips branches whose task id is missing or unsafe", () => {
    const branches = [
      "main",
      "splitfire/",
      "splitfire/../x",
      "splitfire/a;rm",
      "splitfire/$(x)",
      `splitfire/${"a".repeat(65)}`,
    ];
    for (const branch of branches) {
      const { run, result } = runGate([task("a", ["npm test"])], branch);
      expect(run.status, branch).toBe(0);
      expect(result?.skip, branch).toBe(true);
    }
  });

  it("fails when a safe task id does not name a task in the plan", () => {
    for (const branch of ["splitfire/T9", "splitfire/missing-task"]) {
      const { run, result } = runGate([task("a", ["npm test"])], branch);
      expect(run.status, branch).toBe(1);
      expect(result?.conclusion).toBe("failure");
      expect(result?.summary).toContain("No task " + branch.slice("splitfire/".length));
    }
  });

  it("runs a slug task id branch and names the gate after that id", () => {
    const { run, result } = runGate(
      [task("auth-contract", ["test -f marker.txt"])],
      "splitfire/auth-contract",
      { "marker.txt": "ok" },
    );
    expect(run.status).toBe(0);
    expect(result).toMatchObject({ label: "auth-contract", conclusion: "success" });
    expect(result?.summary).toContain("**auth-contract - Title auth-contract**");
  });

  it("still runs a legacy splitfire/Tn label branch", () => {
    const { run, result } = runGate([task("a", ["test -f marker.txt"])], "splitfire/T0", {
      "marker.txt": "ok",
    });
    expect(run.status).toBe(0);
    expect(result).toMatchObject({ label: "T0", conclusion: "success" });
  });

  it("maps labels by wave order, not array order", () => {
    const { result } = runGate(
      [task("b", ["test -f marker.txt"], { dependsOn: ["a"] }), task("a", ["test -f marker.txt"])],
      "splitfire/T0",
      { "marker.txt": "ok" },
    );
    expect(result?.title).toBe("Title a");
  });

  it("parses acceptance exactly like lib/gates/commands", () => {
    const corpus = [
      "npm --version",
      "pnpm --version",
      "yarn --version",
      "npx --version",
      "vitest --version",
      "playwright --version",
      "pytest --version",
      "tsc --version",
      "go version",
      "cargo --version",
      "python3 -m py_compile scripts/x.py",
      "python3 scripts/x.py",
      "test -f bin/splitfire.ts",
      "test -e package.json",
      "[ -f tests/cli.test.ts ]",
      "tests/cli.test.ts exists",
      "`src/types.ts` must exist",
      "- [ ] npm test",
      "`npm run typecheck` passes",
      "Run `npm run build` and `npm test`.",
      "`npm --version` and `src/x.ts`",
      "git diff --name-only touches only owned files",
      "feature exists",
      "npm test; rm -rf /",
      "npm test && curl https://evil.test",
      "bash -c 'rm -rf /'",
      "`rm -rf /`",
      "test -f /etc/passwd",
      "npm --version",
    ];
    const { result } = runGate([task("a", corpus)], "splitfire/T0", {}, true);
    const expected = gateCommands(corpus);
    expect(result?.checks?.map(({ source, kind, command }) => ({ source, kind, command }))).toEqual(
      expected.runnable,
    );
    expect(result?.manual).toEqual(expected.manual);
  });
});

describe("the embedded reporter", () => {
  const servers: ReturnType<typeof createServer>[] = [];

  afterEach(async () => {
    await Promise.all(
      servers
        .splice(0)
        .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
    );
  });

  async function listen() {
    const received: { url?: string; auth?: string; body: Record<string, unknown> }[] = [];
    const server = createServer((request, response) => {
      let raw = "";
      request.on("data", (chunk: Buffer) => (raw += chunk.toString()));
      request.on("end", () => {
        received.push({
          url: request.url,
          auth: request.headers.authorization,
          body: JSON.parse(raw) as Record<string, unknown>,
        });
        response.writeHead(201, { "content-type": "application/json" });
        response.end(JSON.stringify({ html_url: "https://example.test/check/1" }));
      });
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const { port } = server.address() as AddressInfo;
    return { received, api: `http://127.0.0.1:${port}` };
  }

  /** Async spawn: the fake API server lives in this process, so the event loop must stay free. */
  async function runReport(api: string, branch: string, result: GateResult | null) {
    const root = tempDir("splitfire-report-");
    const runnerTemp = join(root, "runner");
    mkdirSync(join(runnerTemp, "splitfire"), { recursive: true });
    if (result) {
      writeFileSync(join(runnerTemp, "splitfire", "result.json"), JSON.stringify(result));
    }
    const script = join(root, "report.mjs");
    writeFileSync(script, REPORT_SCRIPT);
    const child = spawn(process.execPath, [script], {
      cwd: root,
      env: {
        ...process.env,
        GITHUB_API_URL: api,
        GITHUB_REPOSITORY: "acme/app",
        GITHUB_TOKEN: "test-token",
        GITHUB_REF_NAME: branch,
        GITHUB_SHA: "deadbeef",
        RUNNER_TEMP: runnerTemp,
      },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    const status = await new Promise<number | null>((resolve, reject) => {
      child.on("error", reject);
      child.on("close", (code) => resolve(code));
    });
    return { status, stdout, stderr };
  }

  it("creates a check run named splitfire/<task-id> on the head commit", async () => {
    const { received, api } = await listen();
    const run = await runReport(api, "splitfire/re-split-logic", {
      conclusion: "success",
      title: "Title auth-contract",
      summary: "1 passed, 0 failed, 0 manual.",
    });
    expect(run.status, run.stderr).toBe(0);
    expect(received).toHaveLength(1);
    expect(received[0]?.url).toBe("/repos/acme/app/check-runs");
    expect(received[0]?.auth).toBe("Bearer test-token");
    expect(received[0]?.body).toMatchObject({
      name: "splitfire/re-split-logic",
      head_sha: "deadbeef",
      status: "completed",
      conclusion: "success",
      output: {
        title: "splitfire/re-split-logic: Title auth-contract",
        summary: "1 passed, 0 failed, 0 manual.",
      },
    });
  });

  it("still names a legacy splitfire/Tn check run after the label", async () => {
    const { received, api } = await listen();
    const run = await runReport(api, "splitfire/T2", { conclusion: "success", title: "Title a" });
    expect(run.status, run.stderr).toBe(0);
    expect(received[0]?.body).toMatchObject({ name: "splitfire/T2" });
  });

  it("reports failure when the gate produced no result", async () => {
    const { received, api } = await listen();
    const run = await runReport(api, "splitfire/T2", null);
    expect(run.status, run.stderr).toBe(0);
    expect(received[0]?.body).toMatchObject({
      name: "splitfire/T2",
      conclusion: "failure",
    });
    expect(String((received[0]?.body.output as { summary: string }).summary)).toContain(
      "did not report a result",
    );
  });

  it("creates no check run for a branch whose task id is unsafe", async () => {
    for (const branch of ["main", "splitfire/../x", "splitfire/a;rm", "splitfire/$(x)"]) {
      const { received, api } = await listen();
      const run = await runReport(api, branch, { conclusion: "success" });
      expect(run.status, run.stderr).toBe(0);
      expect(received, branch).toEqual([]);
    }
  });
});
