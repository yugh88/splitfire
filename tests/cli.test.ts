import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AGENTS, DEFAULT_OUT, parseArgs } from "@/cli/args";
import { loadLocalAnalysis, readGitInfo, walkRepo } from "@/cli/local";
import { main } from "@/cli/main";
import { modelSafe } from "@/cli/plan";
import { CliError } from "@/cli/errors";

const SAMPLE_REPO = path.join(__dirname, "fixtures", "sample-repo");
const tempDirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "splitfire-cli-"));
  tempDirs.push(dir);
  return dir;
}

function touch(root: string, relative: string, contents = "export const x = 1;\n"): string {
  const full = path.join(root, relative);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, contents, "utf8");
  return full;
}

afterEach(() => {
  vi.restoreAllMocks();
  while (tempDirs.length > 0) rmSync(tempDirs.pop() as string, { recursive: true, force: true });
});

describe("parseArgs", () => {
  it("parses a plan request with contract defaults", () => {
    expect(parseArgs(["plan", "add a multiply helper"])).toEqual({
      command: "plan",
      request: "add a multiply helper",
      agents: DEFAULT_AGENTS,
      out: DEFAULT_OUT,
      mock: false,
      offline: false,
    });
  });

  it("accepts space and equals forms for value options", () => {
    const options = parseArgs([
      "plan",
      "ship auth",
      "--repo",
      "yugh88/splitfire",
      "--agents=4",
      "--out",
      "plans",
      "--mock",
    ]);
    expect(options).toMatchObject({
      command: "plan",
      request: "ship auth",
      repo: "yugh88/splitfire",
      agents: 4,
      out: "plans",
      mock: true,
      offline: false,
    });
  });

  it("joins unquoted request words", () => {
    expect(parseArgs(["plan", "add", "rate", "limits"]).request).toBe("add rate limits");
  });

  it("treats --offline as a boolean and does not echo it into the request", () => {
    const options = parseArgs(["plan", "--offline", "add checks"]);
    expect(options.offline).toBe(true);
    expect(options.request).toBe("add checks");
  });

  it("returns help for no arguments, help and --help", () => {
    expect(parseArgs([]).command).toBe("help");
    expect(parseArgs(["help"]).command).toBe("help");
    expect(parseArgs(["--help"]).command).toBe("help");
  });

  it("returns the version command", () => {
    expect(parseArgs(["version"]).command).toBe("version");
    expect(parseArgs(["-v"]).command).toBe("version");
  });

  it("rejects a missing request", () => {
    expect(() => parseArgs(["plan"])).toThrow(CliError);
    expect(() => parseArgs(["plan", "--offline"])).toThrow(/Missing request/);
  });

  it("rejects unknown commands and options", () => {
    expect(() => parseArgs(["deploy", "now"])).toThrow(/Unknown command "deploy"/);
    expect(() => parseArgs(["plan", "x", "--turbo"])).toThrow(/Unknown option --turbo/);
  });

  it("rejects a missing option value", () => {
    expect(() => parseArgs(["plan", "x", "--repo"])).toThrow(/--repo needs a value/);
    expect(() => parseArgs(["plan", "x", "--agents", "--offline"])).toThrow(
      /--agents needs a value/,
    );
  });

  it("rejects invalid agent counts", () => {
    expect(() => parseArgs(["plan", "x", "--agents", "0"])).toThrow(CliError);
    expect(() => parseArgs(["plan", "x", "--agents", "2.5"])).toThrow(CliError);
    expect(() => parseArgs(["plan", "x", "--agents", "many"])).toThrow(CliError);
  });

  it("rejects using the repo root as the pack directory", () => {
    expect(() => parseArgs(["plan", "x", "--out", "."])).toThrow(/pack directory/);
    expect(() => parseArgs(["plan", "x", "--out", "/"])).toThrow(/pack directory/);
  });
});

describe("walkRepo", () => {
  it("respects .gitignore including negation, and skips hard-ignored directories", () => {
    const root = tempDir();
    writeFileSync(
      path.join(root, ".gitignore"),
      ["node_modules/", "dist/", "*.log", "!important.log", "docs/tmp/", ""].join("\n"),
      "utf8",
    );
    touch(root, "src/a.ts");
    touch(root, "src/b.ts");
    touch(root, "debug.log");
    touch(root, "important.log");
    touch(root, "docs/tmp/notes.md", "# skip\n");
    touch(root, "docs/keep.md", "# keep\n");
    touch(root, "node_modules/pkg/index.ts");
    touch(root, "dist/bundle.js");
    touch(root, ".git/config", "[core]\n");

    const paths = walkRepo(root).map((entry) => entry.path);

    expect(paths).toContain("src/a.ts");
    expect(paths).toContain("src/b.ts");
    expect(paths).toContain("docs/keep.md");
    expect(paths).toContain("important.log");
    expect(paths).not.toContain("debug.log");
    expect(paths).not.toContain("docs/tmp/notes.md");
    expect(paths.some((p) => p.startsWith("node_modules/"))).toBe(false);
    expect(paths.some((p) => p.startsWith("dist/"))).toBe(false);
    expect(paths.some((p) => p.startsWith(".git/"))).toBe(false);
    expect(paths).toEqual([...paths].sort((a, b) => a.localeCompare(b)));
  });

  it("applies nested .gitignore files to their own subtree only", () => {
    const root = tempDir();
    writeFileSync(path.join(root, ".gitignore"), "", "utf8");
    touch(root, "pkg/.gitignore", "*.gen.ts\n");
    touch(root, "pkg/a.gen.ts");
    touch(root, "pkg/a.ts");
    touch(root, "other/b.gen.ts");

    const paths = walkRepo(root).map((entry) => entry.path);
    expect(paths).toContain("pkg/a.ts");
    expect(paths).not.toContain("pkg/a.gen.ts");
    expect(paths).toContain("other/b.gen.ts");
  });

  it("leaves out a requested output directory", () => {
    const root = tempDir();
    touch(root, "src/a.ts");
    touch(root, ".splitfire/plan.json", "{}");

    const paths = walkRepo(root, { skipDirs: [".splitfire"] }).map((entry) => entry.path);
    expect(paths).toContain("src/a.ts");
    expect(paths.some((p) => p.startsWith(".splitfire/"))).toBe(false);
  });
});

describe("loadLocalAnalysis", () => {
  it("filters with the shared web ingest rules and builds an import graph", async () => {
    const root = tempDir();
    cpSync(SAMPLE_REPO, root, { recursive: true });
    touch(root, "node_modules/pkg/index.ts");
    touch(root, "package-lock.json", "{}");

    const { analysis, contents } = await loadLocalAnalysis(root);

    const paths = analysis.files.map((file) => file.path);
    expect(paths).toContain("src/index.ts");
    expect(paths).toContain("src/math.ts");
    expect(paths).not.toContain("package-lock.json");
    expect(paths.some((p) => p.startsWith("node_modules/"))).toBe(false);
    expect(contents["src/math.ts"]).toContain("export function add");
    expect(analysis.edges).toContainEqual({ from: "src/index.ts", to: "src/math.ts" });
    expect(analysis.repo).toBe(`local/${path.basename(root)}`);
    expect(analysis.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(analysis.skipped).toBeGreaterThan(0);
  });
});

describe("modelSafe", () => {
  it("keeps paths and the import graph but drops content-derived fields", async () => {
    const root = tempDir();
    cpSync(SAMPLE_REPO, root, { recursive: true });
    const { analysis } = await loadLocalAnalysis(root);

    const safe = modelSafe(analysis);

    expect(safe.files.map((file) => file.path)).toEqual(analysis.files.map((file) => file.path));
    expect(safe.files.every((file) => file.bytes === 0)).toBe(true);
    expect(safe.edges).toEqual(analysis.edges);
    expect(safe.symbols).toEqual({});
    expect(safe.repo).toBe(analysis.repo);
  });
});

describe("readGitInfo", () => {
  it("reads HEAD and the origin remote without spawning git", () => {
    const root = tempDir();
    const sha = "0123456789abcdef0123456789abcdef01234567";
    mkdirSync(path.join(root, ".git", "refs", "heads"), { recursive: true });
    writeFileSync(path.join(root, ".git", "HEAD"), "ref: refs/heads/main\n", "utf8");
    writeFileSync(path.join(root, ".git", "refs", "heads", "main"), `${sha}\n`, "utf8");
    writeFileSync(
      path.join(root, ".git", "config"),
      '[remote "origin"]\n\turl = git@github.com:yugh88/splitfire.git\n',
      "utf8",
    );

    expect(readGitInfo(root)).toEqual({ sha, repo: "yugh88/splitfire" });
  });

  it("falls back to packed refs and https remotes", () => {
    const root = tempDir();
    const sha = "fedcba9876543210fedcba9876543210fedcba98";
    mkdirSync(path.join(root, ".git"), { recursive: true });
    writeFileSync(path.join(root, ".git", "HEAD"), "ref: refs/heads/main\n", "utf8");
    writeFileSync(
      path.join(root, ".git", "packed-refs"),
      `# pack-refs with: peeled fully-peeled sorted\n${sha} refs/heads/main\n`,
      "utf8",
    );
    writeFileSync(
      path.join(root, ".git", "config"),
      '[remote "origin"]\n\turl = https://github.com/acme/app.git\n',
      "utf8",
    );

    expect(readGitInfo(root)).toEqual({ sha, repo: "acme/app" });
  });

  it("returns nulls outside a git repository", () => {
    expect(readGitInfo(tempDir())).toEqual({ sha: null, repo: null });
  });
});

describe("CLI end to end (offline)", () => {
  it("documents local-mode privacy and the offline flag in --help", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });

    expect(await main(["--help"])).toBe(0);
    const help = logs.join("\n");
    expect(help).toContain("--offline");
    expect(help).toContain("--repo");
    expect(help).toContain("file contents NEVER leave your machine");
    expect(help).toContain("Only file paths, the import graph and your request");
    expect(help).toContain("Exit codes");
  });

  it("writes the full .splitfire pack from a local fixture repo", async () => {
    const root = tempDir();
    cpSync(SAMPLE_REPO, root, { recursive: true });

    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    });

    const code = await main(["plan", "add multiply and string helpers", "--offline"], {
      cwd: root,
    });

    expect(errors).toEqual([]);
    expect(code).toBe(0);

    const pack = path.join(root, ".splitfire");
    expect(existsSync(path.join(pack, "README.md"))).toBe(true);
    expect(existsSync(path.join(pack, "plan.json"))).toBe(true);
    expect(existsSync(path.join(root, ".github", "workflows", "splitfire-gates.yml"))).toBe(true);

    const plan = JSON.parse(readFileSync(path.join(pack, "plan.json"), "utf8")) as {
      id: string;
      repo: string;
      sha: string;
      request: string;
      tasks: { id: string; ownedFiles: string[]; acceptance: string[]; dependsOn: string[] }[];
      collisionScore: number;
      speedup: number;
      serialMinutes: number;
      parallelMinutes: number;
      agents: number;
    };
    expect(plan.id).toMatch(/^[0-9a-f]{16}$/);
    expect(plan.repo).toBe(`local/${path.basename(root)}`);
    expect(plan.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(plan.request).toBe("add multiply and string helpers");
    expect(plan.tasks.length).toBeGreaterThan(0);
    expect(plan.collisionScore).toBe(0);
    expect(plan.agents).toBeGreaterThanOrEqual(1);
    expect(plan.agents).toBeLessThanOrEqual(DEFAULT_AGENTS);
    expect(plan.serialMinutes).toBeGreaterThan(0);
    expect(plan.parallelMinutes).toBeLessThanOrEqual(plan.serialMinutes);
    expect(plan.tasks.every((task) => task.acceptance.length > 0)).toBe(true);

    const owned = plan.tasks.flatMap((task) => task.ownedFiles);
    expect(new Set(owned).size).toBe(owned.length);
    const ids = new Set(plan.tasks.map((task) => task.id));
    for (const task of plan.tasks) {
      for (const dep of task.dependsOn) expect(ids.has(dep)).toBe(true);
    }

    const taskFiles = readdirSync(path.join(pack, "tasks"));
    expect(taskFiles).toHaveLength(plan.tasks.length);
    for (const file of taskFiles) expect(file).toMatch(/\.md$/);

    const workflow = readFileSync(
      path.join(root, ".github", "workflows", "splitfire-gates.yml"),
      "utf8",
    );
    expect(workflow).toContain("splitfire/");
    expect(workflow).toContain("plan.json");

    const readme = readFileSync(path.join(pack, "README.md"), "utf8");
    expect(readme).toContain("collision score 0");
    expect(readme).toContain("add multiply and string helpers");

    const output = logs.join("\n");
    expect(output).toContain("Collision score");
    expect(output).toContain("Speedup");
    expect(output).toContain("Wrote");
    expect(output).toContain("deterministic");
    expect(output).not.toContain("Privacy:");
  });

  it("honours --out while keeping the gates workflow under .github", async () => {
    const root = tempDir();
    cpSync(SAMPLE_REPO, root, { recursive: true });
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const code = await main(["plan", "tidy math", "--offline", "--out", "plans/split"], {
      cwd: root,
    });

    expect(code).toBe(0);
    expect(existsSync(path.join(root, "plans", "split", "README.md"))).toBe(true);
    expect(existsSync(path.join(root, "plans", "split", "plan.json"))).toBe(true);
    expect(existsSync(path.join(root, ".splitfire"))).toBe(false);
    expect(existsSync(path.join(root, ".github", "workflows", "splitfire-gates.yml"))).toBe(true);
  });

  it("returns exit code 1 for user errors", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    });

    expect(await main(["plan"], { cwd: tempDir() })).toBe(1);
    expect(await main(["plan", "x", "--repo", "not a repo!!"], { cwd: tempDir() })).toBe(1);
    expect(errors.join("\n")).toContain("Missing request");
  });

  it("is deterministic for the same repo and request", async () => {
    const root = tempDir();
    cpSync(SAMPLE_REPO, root, { recursive: true });
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    expect(await main(["plan", "add helpers", "--offline"], { cwd: root })).toBe(0);
    const first = JSON.parse(readFileSync(path.join(root, ".splitfire", "plan.json"), "utf8")) as {
      id: string;
      tasks: { id: string; ownedFiles: string[] }[];
    };
    expect(await main(["plan", "add helpers", "--offline"], { cwd: root })).toBe(0);
    const second = JSON.parse(readFileSync(path.join(root, ".splitfire", "plan.json"), "utf8")) as {
      id: string;
      tasks: { id: string; ownedFiles: string[] }[];
    };

    expect(second.id).toBe(first.id);
    expect(second.tasks).toEqual(first.tasks);
  });
});
