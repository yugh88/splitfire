import { describe, expect, it } from "vitest";
import { extractSymbols, extractWithRegex } from "@/lib/analyze/extract";
import { buildImportGraph } from "@/lib/analyze/graph";
import { loadFixture } from "./helpers/fixture";

const EXPECTED_EDGES = [
  { from: "py/main.py", to: "py/pkg/core.py" },
  { from: "py/pkg/core.py", to: "py/pkg/helpers.py" },
  { from: "py/pkg/core.py", to: "py/pkg/models.py" },
  { from: "src/components/App.tsx", to: "packages/shared/src/index.ts" },
  { from: "src/components/App.tsx", to: "src/math.ts" },
  { from: "src/components/App.tsx", to: "src/util/index.ts" },
  { from: "src/index.ts", to: "src/math.ts" },
  { from: "src/index.ts", to: "src/types.ts" },
  { from: "src/index.ts", to: "src/util/strings.ts" },
  { from: "src/legacy.js", to: "src/util/strings.ts" },
  { from: "src/util/index.ts", to: "src/util/strings.ts" },
];

describe("buildImportGraph", () => {
  it("matches the real imports of the sample repo using tree-sitter", async () => {
    const { files, contents } = loadFixture();
    const graph = await buildImportGraph(files, contents);
    expect(graph.parser).toBe("tree-sitter");
    expect(graph.edges).toEqual(EXPECTED_EDGES);
  });

  it("collects exported symbols per file", async () => {
    const { files, contents } = loadFixture();
    const { symbols } = await buildImportGraph(files, contents);
    expect(symbols["src/index.ts"]).toEqual(["greet"]);
    expect(symbols["py/pkg/models.py"]).toEqual(["Model"]);
  });
});

describe("extractWithRegex", () => {
  it("finds js/ts import forms", () => {
    const src = `import a from "./a";\nimport "./side";\nexport { b } from './b';\nconst c = require("./c");\nconst d = import("./d");`;
    expect(
      extractWithRegex("ts", src)
        .map((i) => i.spec)
        .sort(),
    ).toEqual(["./a", "./b", "./c", "./d", "./side"]);
  });

  it("finds python import forms with names", () => {
    const src = "import os, sys as s\nfrom .core import (a,\n  b as c)\nfrom pkg import *\n";
    expect(extractWithRegex("py", src)).toEqual([
      { spec: ".core", names: ["a", "b"] },
      { spec: "pkg", names: [] },
      { spec: "os", names: [] },
      { spec: "sys", names: [] },
    ]);
  });
});

describe("extractSymbols", () => {
  it("lists exported js/ts and top-level python names", () => {
    expect(
      extractSymbols("ts", "export default async function main() {}\nexport type T = 1;"),
    ).toEqual(["main", "T"]);
    expect(extractSymbols("py", "def f():\n    def inner(): pass\nclass K: pass")).toEqual([
      "f",
      "K",
    ]);
  });
});
