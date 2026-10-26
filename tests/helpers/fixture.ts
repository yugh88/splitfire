import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { langOf } from "@/lib/ingest/filter";
import type { FileNode } from "@/lib/types";

export const SAMPLE_REPO = path.join(__dirname, "..", "fixtures", "sample-repo");

/** Reads a fixture directory the way ingest would hand it to analyze. */
export function loadFixture(root: string = SAMPLE_REPO) {
  const files: FileNode[] = [];
  const contents: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      const rel = path.relative(root, full).split(path.sep).join("/");
      const text = readFileSync(full, "utf8");
      files.push({ path: rel, lang: langOf(rel), bytes: Buffer.byteLength(text) });
      contents[rel] = text;
    }
  };
  walk(root);
  return { files, contents };
}
