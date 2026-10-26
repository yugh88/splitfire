import { describe, expect, it } from "vitest";
import { partition } from "@/lib/partition";
import { isAcyclic } from "@/lib/partition/dag";
import { proposal } from "../helpers/plan";

/** Small deterministic PRNG so the property test is reproducible. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
    return seed / 2 ** 31;
  };
}

describe("partition", () => {
  it("repairs overlaps and cycles in one pass", () => {
    const result = partition(
      [proposal("a", ["x.ts", "shared.ts"], ["b"]), proposal("b", ["y.ts", "shared.ts"], ["a"])],
      [],
    );
    expect(result.collisionScoreBefore).toBe(1);
    expect(result.collisions).toEqual([{ file: "shared.ts", tasks: ["a", "b"] }]);
    expect(result.collisionScore).toBe(0);
    expect(isAcyclic(result.tasks)).toBe(true);
    expect(result.repairs.length).toBeGreaterThanOrEqual(2);
  });

  it("always ends with collision score 0 and a DAG (200 random plans)", () => {
    const random = rng(42);
    const files = Array.from({ length: 15 }, (_, i) => `f${i}.ts`);
    for (let run = 0; run < 200; run++) {
      const ids = Array.from({ length: 2 + Math.floor(random() * 6) }, (_, i) => `t${i}`);
      const proposals = ids.map((id) =>
        proposal(
          id,
          files.filter(() => random() < 0.25).concat(files[Math.floor(random() * files.length)]!),
          ids.filter((other) => other !== id && random() < 0.3),
        ),
      );
      const edges = files.slice(1).map((f, i) => ({ from: f, to: files[i]! }));
      const result = partition(proposals, edges);
      expect(result.collisionScore).toBe(0);
      expect(isAcyclic(result.tasks)).toBe(true);
      const owned = result.tasks.flatMap((t) => t.ownedFiles);
      expect(new Set(owned).size).toBe(owned.length);
      expect(new Set(owned)).toEqual(new Set(proposals.flatMap((p) => p.ownedFiles)));
    }
  });
});
