import { mkdirSync, writeFileSync } from "node:fs";
import nodePath from "node:path";
import { splitfirePack } from "@/lib/context/export";
import type { Plan } from "@/lib/types";

export const GATES_PATH = ".github/workflows/splitfire-gates.yml";

/**
 * The pack contract always names `.splitfire/…`; `--out` only relocates that folder. The gates
 * workflow stays under `.github/` because GitHub only reads workflows from there.
 */
export function packPaths(plan: Plan, outDir: string): Record<string, string> {
  const pack = splitfirePack(plan);
  const normalized = normalizeOut(outDir);
  if (normalized === ".splitfire") return pack;

  const remapped: Record<string, string> = {};
  for (const [file, contents] of Object.entries(pack)) {
    remapped[
      file.startsWith(".splitfire/") ? `${normalized}${file.slice(".splitfire".length)}` : file
    ] = contents;
  }
  return remapped;
}

/** Writes every pack file under `root`; returns the paths written, relative to `root`. */
export function writePack(root: string, files: Record<string, string>): string[] {
  const written: string[] = [];
  for (const [relative, contents] of Object.entries(files)) {
    const target = nodePath.isAbsolute(relative) ? relative : nodePath.join(root, relative);
    mkdirSync(nodePath.dirname(target), { recursive: true });
    writeFileSync(target, contents, "utf8");
    written.push(relative);
  }
  return written.sort((a, b) => a.localeCompare(b));
}

/** `./out/` -> `out`; keeps absolute paths usable. */
export function normalizeOut(outDir: string): string {
  const trimmed = outDir.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  if (!trimmed) return ".splitfire";
  if (trimmed === "." || trimmed === "./") return ".splitfire";
  return trimmed;
}

/** The pack folder as a repo-relative path, used to skip old output when re-walking. */
export function outRelativeTo(root: string, outDir: string): string | null {
  const normalized = normalizeOut(outDir);
  if (nodePath.isAbsolute(normalized)) {
    const relative = nodePath.relative(root, normalized).replace(/\\/g, "/");
    if (!relative || relative.startsWith("../")) return null;
    return relative;
  }
  return normalized.replace(/^\.\/+/, "");
}
