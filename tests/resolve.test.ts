import { describe, expect, it } from "vitest";
import { buildResolveContext, parseJsonc, resolveImport } from "@/lib/analyze/resolve";
import type { FileNode } from "@/lib/types";

const node = (path: string, lang: FileNode["lang"] = "ts"): FileNode => ({ path, lang, bytes: 1 });

describe("parseJsonc", () => {
  it("strips comments and trailing commas but keeps // inside strings", () => {
    const text = `{ /* block */ "url": "https://x.dev", // line
      "a": [1, 2,], }`;
    expect(parseJsonc(text)).toEqual({ url: "https://x.dev", a: [1, 2] });
  });

  it("returns null on invalid JSON", () => {
    expect(parseJsonc("{ nope")).toBeNull();
  });
});

describe("resolveImport (js/ts)", () => {
  const files = [
    node("src/a.ts"),
    node("src/b.tsx"),
    node("src/lib/index.ts"),
    node("web/tsconfig.json", "other"),
    node("web/app/page.tsx"),
    node("web/components/button.tsx"),
  ];
  const ctx = buildResolveContext(files, {
    "web/tsconfig.json": '{ "compilerOptions": { "paths": { "~/*": ["./*"] } } }',
  });
  const from = node("src/a.ts");

  it("resolves relative, extensionless, .js→.ts and index imports", () => {
    expect(resolveImport(from, { spec: "./b", names: [] }, ctx)).toEqual(["src/b.tsx"]);
    expect(resolveImport(from, { spec: "./b.js", names: [] }, ctx)).toEqual(["src/b.tsx"]);
    expect(resolveImport(from, { spec: "./lib", names: [] }, ctx)).toEqual(["src/lib/index.ts"]);
  });

  it("drops external packages and paths outside the repo", () => {
    expect(resolveImport(from, { spec: "react", names: [] }, ctx)).toEqual([]);
    expect(resolveImport(from, { spec: "../../x", names: [] }, ctx)).toEqual([]);
  });

  it("applies tsconfig paths only inside the config's directory", () => {
    const page = node("web/app/page.tsx");
    expect(resolveImport(page, { spec: "~/components/button", names: [] }, ctx)).toEqual([
      "web/components/button.tsx",
    ]);
    expect(resolveImport(from, { spec: "~/components/button", names: [] }, ctx)).toEqual([]);
  });
});

describe("resolveImport (python)", () => {
  const files = [
    node("app/__init__.py", "py"),
    node("app/main.py", "py"),
    node("app/db/__init__.py", "py"),
    node("app/db/models.py", "py"),
    node("src/lib/util.py", "py"),
  ];
  const ctx = buildResolveContext(files, {});
  const main = node("app/main.py", "py");

  it("resolves relative imports with multiple dots", () => {
    const models = node("app/db/models.py", "py");
    expect(resolveImport(models, { spec: "..main", names: ["x"] }, ctx)).toEqual(["app/main.py"]);
    expect(resolveImport(models, { spec: ".", names: ["models"] }, ctx)).toEqual([
      "app/db/models.py",
    ]);
  });

  it("prefers submodules named in from-imports, else the package", () => {
    expect(resolveImport(main, { spec: "app.db", names: ["models"] }, ctx)).toEqual([
      "app/db/models.py",
    ]);
    expect(resolveImport(main, { spec: "app.db", names: ["Session"] }, ctx)).toEqual([
      "app/db/__init__.py",
    ]);
  });

  it("finds modules under src/ and ignores stdlib", () => {
    expect(resolveImport(main, { spec: "lib.util", names: [] }, ctx)).toEqual(["src/lib/util.py"]);
    expect(resolveImport(main, { spec: "os", names: [] }, ctx)).toEqual([]);
  });
});
