import type { ImportEdge } from "@/lib/types";
import type { DraftTask } from "./ownership";
import type { Repair } from "./repairs";

export const CONTRACT_ID = "contracts";
const MAX_CONTRACT_FILES = 6;
const MAX_INTERFACE_BYTES = 12_000;
const SMALL_FILE_BYTES = 3_000;
/** Declaration-shaped names: `types.ts`, `user.schema.ts`, `settings-types.ts`, `*.d.ts`. */
const TYPE_NAME =
  /(^|[-_.])(types?|interfaces?|contracts?|schemas?|models?|dtos?)\.[cm]?[jt]sx?$|\.d\.ts$|(^|[-_.])(types?|schemas?|models?)\.py$/i;
/** Re-export entry points: small ones are API surface, not implementation. */
const BARREL = /(^|\/)(index\.[cm]?[jt]sx?|__init__\.py)$/;
/** Folders that hold only declarations. */
const TYPE_DIR = /(^|\/)(types|interfaces|contracts|schemas)\//i;

/** A file shaped like shared declarations: types, schemas, API shapes. */
function isBarrel(file: string): boolean {
  return BARREL.test(file);
}

export function isTypeLike(file: string): boolean {
  const name = file.slice(file.lastIndexOf("/") + 1);
  return TYPE_NAME.test(name) || TYPE_DIR.test(file);
}

/**
 * Contracts-first. For each dependency A → B, the "interface" is what B actually needs from A:
 * the type-like files and small barrel files A owns that B imports, or, when no
 * imports connect them (new files), A's type-like files. Moving those into one small
 * contract task lets A and B both start as soon as the contract lands, turning chains into a
 * fan-out. Edges whose interface is missing or too big are left alone.
 */
export function insertContracts(
  tasks: DraftTask[],
  edges: ImportEdge[],
  bytes: Map<string, number>,
): { tasks: DraftTask[]; repairs: Repair[]; inserted: boolean } {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const importsOf = new Map<string, Set<string>>();
  for (const e of edges) importsOf.set(e.from, (importsOf.get(e.from) ?? new Set()).add(e.to));

  const moved = new Map<string, string>(); // file -> task it came from
  const broken: { task: string; dep: string }[] = [];

  for (const task of tasks) {
    for (const depId of task.dependsOn) {
      const dep = byId.get(depId);
      if (!dep || dep.kind === "contract") continue;
      const uses = new Set(
        [...task.ownedFiles, ...task.readFiles].flatMap((f) => [...(importsOf.get(f) ?? [])]),
      );
      const imported = dep.ownedFiles.filter((f) => uses.has(f));
      let iface = imported.filter(
        (f) => isTypeLike(f) || (isBarrel(f) && (bytes.get(f) ?? 0) <= SMALL_FILE_BYTES),
      );
      if (imported.length === 0) iface = dep.ownedFiles.filter(isTypeLike);
      const size = iface.reduce((n, f) => n + (bytes.get(f) ?? 0), 0);
      const fresh = iface.filter((f) => !moved.has(f));
      const fits = moved.size + fresh.length <= MAX_CONTRACT_FILES && size <= MAX_INTERFACE_BYTES;
      if (iface.length === 0 || !fits || iface.length === dep.ownedFiles.length) continue;
      for (const f of fresh) moved.set(f, dep.id);
      broken.push({ task: task.id, dep: dep.id });
    }
  }
  if (broken.length === 0) return { tasks, repairs: [], inserted: false };

  const id = byId.has(CONTRACT_ID) ? `${CONTRACT_ID}-shared` : CONTRACT_ID;
  const files = [...moved.keys()].sort();
  const sources = [...new Set(moved.values())];
  const dependents = [...new Set(broken.map((b) => b.task))];
  const isBroken = (task: string, dep: string) =>
    broken.some((b) => b.task === task && b.dep === dep);

  const rewired = tasks.map((t) => {
    const ownedFiles = t.ownedFiles.filter((f) => !moved.has(f));
    const touches = sources.includes(t.id) || dependents.includes(t.id);
    const dependsOn = t.dependsOn.filter((d) => !isBroken(t.id, d));
    return {
      ...t,
      ownedFiles,
      readFiles: touches
        ? [...new Set([...t.readFiles, ...files])].filter((f) => !ownedFiles.includes(f))
        : t.readFiles,
      dependsOn: touches ? [id, ...dependsOn] : dependsOn,
    };
  });

  const contract: DraftTask = {
    id,
    title: "Shared contracts",
    goal: `Define the shared types, signatures and API shapes in ${files.join(", ")} that the other tasks build against. Declarations only, no behaviour, so dependent tasks can start in parallel.`,
    kind: "contract",
    ownedFiles: files,
    readFiles: [],
    dependsOn: [],
    difficulty: 1,
  };

  return {
    tasks: [contract, ...rewired],
    repairs: [
      { kind: "contract", task: id, files, from: sources },
      ...broken.map((b): Repair => ({ kind: "fan-out", task: b.task, dep: b.dep, via: id })),
    ],
    inserted: true,
  };
}
