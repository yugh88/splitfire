import { describe, expect, it } from "vitest";
import { MAX_READ_FILES, withContextPacks } from "@/lib/context/pack";

describe("withContextPacks", () => {
  const edges = [
    { from: "ui.ts", to: "types.ts" },
    { from: "ui.ts", to: "api.ts" },
    { from: "form.ts", to: "types.ts" },
    { from: "ui.ts", to: "form.ts" },
  ];

  it("adds direct imports of owned files, most-used first, excluding owned files", () => {
    const [task] = withContextPacks([{ ownedFiles: ["ui.ts", "form.ts"], readFiles: [] }], edges);
    expect(task!.readFiles).toEqual(["types.ts", "api.ts"]);
  });

  it("keeps existing read-only files and caps the pack", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ from: "a.ts", to: `dep${i}.ts` }));
    const [task] = withContextPacks([{ ownedFiles: ["a.ts"], readFiles: ["shared.ts"] }], many);
    expect(task!.readFiles[0]).toBe("shared.ts");
    expect(task!.readFiles).toHaveLength(MAX_READ_FILES);
  });
});
