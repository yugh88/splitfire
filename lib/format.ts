/** 45 -> "45m", 90 -> "1.5h", 360 -> "6h". */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours}h`;
}

export function formatUsd(usd: number): string {
  if (usd === 0) return "$0";
  if (usd < 0.01) return `<$0.01`;
  return `$${usd.toFixed(2)}`;
}

/** 1234 -> "1.2k", 2_500_000 -> "2.5M". */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${trim(tokens / 1_000_000)}M`;
  if (tokens >= 1_000) return `${trim(tokens / 1_000)}k`;
  return String(tokens);
}

/** "Serial 6h → 1.5h with 4 agents (4×)" */
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

function trim(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}
