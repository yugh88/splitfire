import { describe, expect, it } from "vitest";
import { isIgnored, langOf, MAX_FILES, MAX_TOTAL_BYTES, selectFiles } from "@/lib/ingest/filter";

describe("langOf", () => {
  it("classifies by extension", () => {
    expect(langOf("a/b.tsx")).toBe("ts");
    expect(langOf("a/b.mjs")).toBe("js");
    expect(langOf("a/b.py")).toBe("py");
    expect(langOf("README.md")).toBe("other");
  });
});

describe("isIgnored", () => {
  it.each([
    "node_modules/x/index.js",
    "packages/a/dist/index.js",
    "package-lock.json",
    "web/pnpm-lock.yaml",
    "public/app.min.js",
    "logo.png",
    "src/__pycache__/x.py",
  ])("ignores %s", (p) => expect(isIgnored(p)).toBe(true));

  it.each(["src/index.ts", "package.json", "README.md", "Dockerfile", "app/page.tsx"])(
    "keeps %s",
    (p) => expect(isIgnored(p)).toBe(false),
  );
});

describe("selectFiles", () => {
  it("keeps source files first and caps the file count", () => {
    const entries = [
      ...Array.from({ length: MAX_FILES }, (_, i) => ({ path: `src/f${i}.ts`, bytes: 10 })),
      { path: "README.md", bytes: 10 },
    ];
    const { files, truncated, skipped } = selectFiles(entries);
    expect(files).toHaveLength(MAX_FILES);
    expect(files.some((f) => f.path === "README.md")).toBe(false);
    expect(truncated).toBe(true);
    expect(skipped).toBe(1);
  });

  it("respects the total byte cap", () => {
    const big = MAX_TOTAL_BYTES / 2 - 1;
    const entries = ["a.ts", "b.ts", "c.ts"].map((path) => ({ path, bytes: 150_000 }));
    entries.push({ path: "d.ts", bytes: big });
    const { files } = selectFiles(entries);
    expect(files.reduce((n, f) => n + f.bytes, 0)).toBeLessThanOrEqual(MAX_TOTAL_BYTES);
  });

  it("returns files sorted by path, with lang", () => {
    const { files, truncated } = selectFiles([
      { path: "z.py", bytes: 1 },
      { path: "a/b.js", bytes: 1 },
      { path: "yarn.lock", bytes: 1 },
    ]);
    expect(files).toEqual([
      { path: "a/b.js", lang: "js", bytes: 1 },
      { path: "z.py", lang: "py", bytes: 1 },
    ]);
    expect(truncated).toBe(false);
  });
});

describe("selectFiles priority", () => {
  it("ranks docs/examples source below core source when capping", () => {
    const entries = [
      ...Array.from({ length: MAX_FILES }, (_, i) => ({ path: `docs_src/t${i}.py`, bytes: 1 })),
      { path: "pkg/deep/core.py", bytes: 1 },
    ];
    const { files } = selectFiles(entries);
    expect(files.some((f) => f.path === "pkg/deep/core.py")).toBe(true);
  });
});
