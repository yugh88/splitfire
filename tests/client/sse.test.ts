import { describe, expect, it } from "vitest";
import { createSseParser, type SseMessage } from "@/lib/client/sse";

describe("createSseParser", () => {
  it("parses events split across arbitrary chunks", () => {
    const got: SseMessage[] = [];
    const push = createSseParser((m) => got.push(m));
    const stream = 'event: task\ndata: {"a":1}\n\nevent: done\r\ndata: {"b":\r\ndata: 2}\r\n\r\n';
    for (const ch of stream) push(ch);
    expect(got).toEqual([
      { event: "task", data: '{"a":1}' },
      { event: "done", data: '{"b":\n2}' },
    ]);
  });

  it("waits for the blank line before emitting", () => {
    const got: SseMessage[] = [];
    const push = createSseParser((m) => got.push(m));
    push("event: x\ndata: 1\n");
    expect(got).toEqual([]);
    push("\n");
    expect(got).toEqual([{ event: "x", data: "1" }]);
  });
});
