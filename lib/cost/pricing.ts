import type { Price } from "@/lib/env";

/** Rough token count: ~4 characters per token for code and English. */
export function estimateTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

export function costUsd(price: Price, inputTokens: number, outputTokens: number): number {
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}
