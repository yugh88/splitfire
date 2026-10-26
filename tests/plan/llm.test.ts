import { describe, expect, it } from "vitest";
import { cleanSseLine } from "@/lib/plan/llm";

const line = (delta: Record<string, unknown>) =>
  `data: ${JSON.stringify({ choices: [{ index: 0, delta }] })}`;

describe("cleanSseLine", () => {
  it("drops thought chunks and strips stray thought tags", () => {
    const thought = cleanSseLine(
      line({ content: "planning…", extra_content: { google: { thought: true } } }),
    );
    expect(JSON.parse(thought.slice(6)).choices[0].delta).toEqual({ content: "" });
    const answer = cleanSseLine(line({ content: '</thought>{"elements":[' }));
    expect(JSON.parse(answer.slice(6)).choices[0].delta.content).toBe('{"elements":[');
  });

  it("passes other lines through untouched", () => {
    expect(cleanSseLine("data: [DONE]")).toBe("data: [DONE]");
    expect(cleanSseLine(": keep-alive")).toBe(": keep-alive");
    const usage = `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 3 } })}`;
    expect(cleanSseLine(usage)).toBe(usage);
  });
});
