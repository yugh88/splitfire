import { describe, expect, it } from "vitest";
import {
  assignOwnership,
  collisionScore,
  findCollisions,
  normalizePath,
  normalizeProposals,
} from "@/lib/partition/ownership";
import { proposal } from "../helpers/plan";

const draft = (id: string, ownedFiles: string[], dependsOn: string[] = []) =>
  normalizeProposals([proposal(id, ownedFiles, dependsOn)])[0]!;

describe("findCollisions / collisionScore", () => {
  it("reports files with more than one owner, counting extra claims", () => {
    const tasks = [
      draft("a", ["x.ts", "y.ts"]),
      draft("b", ["y.ts"]),
      draft("c", ["y.ts", "x.ts"]),
    ];
    expect(findCollisions(tasks)).toEqual([
      { file: "x.ts", tasks: ["a", "c"] },
      { file: "y.ts", tasks: ["a", "b", "c"] },
    ]);
    expect(collisionScore(tasks)).toBe(3);
  });

  it("is zero for disjoint tasks and ignores duplicates within one task", () => {
    expect(collisionScore([draft("a", ["x.ts", "x.ts"]), draft("b", ["y.ts"])])).toBe(0);
  });
});

describe("normalizeProposals", () => {
  it("slugs and dedupes ids, rewriting dependencies to match", () => {
    const tasks = normalizeProposals([
      proposal("Auth API", ["a.ts"]),
      proposal("Auth API", ["b.ts"]),
      proposal("UI", ["c.ts"], ["Auth API"]),
    ]);
    expect(tasks.map((t) => t.id)).toEqual(["auth-api", "auth-api-2", "ui"]);
    expect(tasks[2]!.dependsOn).toEqual(["auth-api"]);
  });

  it("normalizes paths and clamps difficulty", () => {
    const [task] = normalizeProposals([
      proposal("a", ["./src/a.ts", "/src/b.ts", "src\\c.ts", " "], [], { difficulty: 7 }),
    ]);
    expect(task!.ownedFiles).toEqual(["src/a.ts", "src/b.ts", "src/c.ts"]);
    expect(task!.difficulty).toBe(3);
  });

  it("falls back to positional ids when a slug is empty", () => {
    expect(normalizeProposals([proposal("!!!", ["a.ts"])])[0]!.id).toBe("task-1");
  });
});

describe("normalizePath", () => {
  it("strips leading ./ and / and trailing slashes", () => {
    expect(normalizePath("./a/b/")).toBe("a/b");
  });
});

describe("assignOwnership", () => {
  const edges = [
    { from: "b1.ts", to: "shared.ts" },
    { from: "b2.ts", to: "shared.ts" },
  ];

  it("gives a contested file to the task with the most import ties", () => {
    const { tasks, repairs } = assignOwnership(
      [draft("a", ["a1.ts", "shared.ts"]), draft("b", ["b1.ts", "b2.ts", "shared.ts"])],
      edges,
    );
    expect(tasks.find((t) => t.id === "b")!.ownedFiles).toContain("shared.ts");
    const a = tasks.find((t) => t.id === "a")!;
    expect(a.ownedFiles).toEqual(["a1.ts"]);
    expect(a.readFiles).toEqual(["shared.ts"]);
    expect(repairs).toEqual([{ kind: "owner", file: "shared.ts", winner: "b", loser: "a" }]);
    expect(collisionScore(tasks)).toBe(0);
  });

  it("breaks affinity ties in favour of the earlier task", () => {
    const { tasks } = assignOwnership(
      [draft("a", ["x.ts", "s.ts"]), draft("b", ["y.ts", "s.ts"])],
      [],
    );
    expect(tasks[0]!.ownedFiles).toContain("s.ts");
    expect(tasks[1]!.ownedFiles).toEqual(["y.ts"]);
  });

  it("drops tasks left with no files and re-points their dependents", () => {
    const { tasks, repairs } = assignOwnership(
      [draft("base", ["s.ts"]), draft("dup", ["s.ts"], ["base"]), draft("ui", ["u.ts"], ["dup"])],
      [],
    );
    expect(tasks.map((t) => t.id)).toEqual(["base", "ui"]);
    expect(tasks[1]!.dependsOn).toEqual(["base"]);
    expect(repairs).toContainEqual({ kind: "dropped", task: "dup" });
  });
});
