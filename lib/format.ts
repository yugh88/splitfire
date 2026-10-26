/** 45 -> "45m", 90 -> "1h 30m", 245 -> "4h 05m", 360 -> "6h". */
export function formatMinutes(minutes: number): string {
  const total = Math.round(minutes);
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, "0")}m`;
}

export function formatUsd(usd: number): string {
  if (usd === 0) return "$0";
  if (usd < 0.001) return "<$0.001";
  return usd < 1 ? `$${usd.toFixed(3)}` : `$${usd.toFixed(2)}`;
}

/** 1234 -> "1.2k", 2_500_000 -> "2.5M". */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${trim(tokens / 1_000_000)}M`;
  if (tokens >= 1_000) return `${trim(tokens / 1_000)}k`;
  return String(tokens);
}

/** "Serial 6h → 1h 30m with 4 agents (4×)" */
export function speedupLine(m: {
  serialMinutes: number;
  parallelMinutes: number;
  agents: number;
  speedup: number;
}) {
  const agents = `${m.agents} agent${m.agents === 1 ? "" : "s"}`;
  return `Serial ${formatMinutes(m.serialMinutes)} → ${formatMinutes(m.parallelMinutes)} with ${agents} (${m.speedup}×)`;
}

export function percentSaved(full: number, used: number): number {
  return full > 0 ? Math.max(0, Math.round((1 - used / full) * 100)) : 0;
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Keeps the end of long paths, where the distinguishing part is: "…/src/conninfo.ts". */
export function shortPath(path: string, max = 32): string {
  if (path.length <= max) return path;
  const parts = path.split("/");
  let tail = parts.pop() ?? path;
  while (parts.length > 0 && tail.length + (parts.at(-1)?.length ?? 0) + 3 <= max)
    tail = `${parts.pop()}/${tail}`;
  return `…/${tail}`;
}

function trim(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}
