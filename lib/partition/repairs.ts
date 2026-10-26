/** One automatic fix the partitioner made, kept structured so the UI can relabel tasks. */
export type Repair =
  | { kind: "owner"; file: string; winner: string; loser: string }
  | { kind: "dropped"; task: string }
  | { kind: "unknown-dep"; task: string; dep: string }
  | { kind: "self-dep"; task: string }
  | { kind: "cycle"; task: string; dep: string }
  | { kind: "contract"; task: string; files: string[]; from: string[] }
  | { kind: "fan-out"; task: string; dep: string; via: string };

export function describeRepair(r: Repair, label: (id: string) => string = (id) => id): string {
  switch (r.kind) {
    case "owner":
      return `Gave ${r.file} to ${label(r.winner)} only; ${label(r.loser)} reads it from its context pack.`;
    case "dropped":
      return `Merged ${label(r.task)} away: all of its files belong to other tasks.`;
    case "unknown-dep":
      return `Removed ${label(r.task)}'s dependency on unknown task ${r.dep}.`;
    case "self-dep":
      return `Removed ${label(r.task)}'s dependency on itself.`;
    case "cycle":
      return `Broke a cycle: ${label(r.task)} no longer waits for ${label(r.dep)}.`;
    case "contract":
      return `Moved ${r.files.join(", ")} into a new contract task ${label(r.task)} (was owned by ${r.from.map(label).join(", ")}).`;
    case "fan-out":
      return `${label(r.task)} now waits only for contract ${label(r.via)}, not for ${label(r.dep)}, so they run in parallel.`;
  }
}
