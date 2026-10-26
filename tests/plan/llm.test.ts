import { describe, expect, it } from "vitest";
import { adaptRequestBody, createSseCleaner } from "@/lib/plan/llm";

const line = (delta: Record<string, unknown>) =>
  `data: ${JSON.stringify({ choices: [{ index: 0, delta }] })}`;
const content = (out: string) => JSON.parse(out.slice(6)).choices[0].delta.content as string;

describe("createSseCleaner", () => {
  it("drops thought chunks, tags, fences and anything before the JSON", () => {
    const clean = createSseCleaner();
    expect(
      content(clean(line({ content: "planning…", extra_content: { google: { thought: true } } }))),
    ).toBe("");
    expect(content(clean(line({ content: "</thought>Here you go:\n```json\n" })))).toBe("");
    expect(content(clean(line({ content: '{"elements":[' })))).toBe('{"elements":[');
    expect(content(clean(line({ content: "{}]}\n```" })))).toBe("{}]}\n");
  });

  it("keeps text inside the JSON once it has started", () => {
    const clean = createSseCleaner();
    clean(line({ content: '{"a":' }));
    expect(content(clean(line({ content: '"x {y}"}' })))).toBe('"x {y}"}');
  });

  it("passes other lines through untouched", () => {
    const clean = createSseCleaner();
    expect(clean("data: [DONE]")).toBe("data: [DONE]");
    expect(clean(": keep-alive")).toBe(": keep-alive");
    const usage = `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 3 } })}`;
    expect(clean(usage)).toBe(usage);
  });
});

describe("adaptRequestBody", () => {
  it("removes JSON mode for Gemma only", () => {
    const body = (model: string) =>
      JSON.stringify({ model, response_format: { type: "json_object" } });
    expect(JSON.parse(adaptRequestBody(body("gemma-4-26b-a4b-it")))).toEqual({
      model: "gemma-4-26b-a4b-it",
    });
    expect(adaptRequestBody(body("qwen-3"))).toBe(body("qwen-3"));
    expect(adaptRequestBody("not json")).toBe("not json");
  });
});
