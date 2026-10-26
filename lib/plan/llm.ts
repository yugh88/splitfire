import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamObject } from "ai";
import type { Endpoint } from "@/lib/env";
import { ProposalListSchema, type TaskProposal, TaskProposalSchema } from "./schema";

/** The only place Splitfire talks to a model. */

export type LlmCall = {
  endpoint: Endpoint;
  model: string;
  system: string;
  prompt: string;
  maxOutputTokens: number;
  timeoutMs?: number;
  onTask: (task: TaskProposal) => void;
};

/** null when the provider did not report usage; callers then assume the worst case. */
export type LlmUsage = { inputTokens: number; outputTokens: number } | null;

export type LlmResult =
  | { ok: true; tasks: TaskProposal[]; usage: LlmUsage }
  | { ok: false; error: string; usage: LlmUsage };

/** Streams task proposals; each complete, schema-valid task is reported as soon as it arrives. */
export async function streamTaskProposals(call: LlmCall): Promise<LlmResult> {
  const provider = createOpenAICompatible({
    name: call.endpoint.name,
    baseURL: call.endpoint.baseURL,
    apiKey: call.endpoint.apiKey,
    includeUsage: true,
    fetch: openModelFetch(fetch),
  });
  let streamError: string | null = null;
  const result = streamObject({
    model: provider(call.model),
    output: "array",
    schema: TaskProposalSchema,
    system: call.system,
    prompt: call.prompt,
    maxOutputTokens: call.maxOutputTokens,
    temperature: 0.2,
    maxRetries: 2, // transient 5xx/429 from free tiers; validation failures are handled by the planner
    abortSignal: AbortSignal.timeout(call.timeoutMs ?? 60_000),
    onError: ({ error }) => {
      streamError = errorMessage(error);
    },
  });

  const usagePromise = result.usage.then(
    (u): LlmUsage =>
      u.inputTokens === undefined
        ? null
        : { inputTokens: u.inputTokens, outputTokens: u.outputTokens ?? 0 },
    () => null,
  );

  try {
    for await (const element of result.elementStream) {
      const parsed = TaskProposalSchema.safeParse(element);
      if (parsed.success) call.onTask(parsed.data);
    }
    const parsed = ProposalListSchema.safeParse(await result.object);
    const usage = await usagePromise;
    if (!parsed.success) return { ok: false, error: parsed.error.message, usage };
    return { ok: true, tasks: parsed.data, usage };
  } catch (error) {
    return { ok: false, error: streamError ?? errorMessage(error), usage: await usagePromise };
  }
}

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 1_000);
}

const THOUGHT_TAG = /<\/?thought>/g;
const FENCE = /```(?:json)?/g;

/**
 * Some open models (Gemma 4 on the Gemini API) stream their reasoning as ordinary content chunks
 * flagged `extra_content.google.thought`, and wrap the answer in stray `</thought>` tags or
 * markdown fences. A cleaner is created per response: it drops thought chunks, tags and fences,
 * and everything before the first `{`, so only the JSON reaches the parser.
 */
export function createSseCleaner(): (line: string) => string {
  let started = false;
  return (line) => {
    if (!line.startsWith("data: ") || line === "data: [DONE]") return line;
    let chunk: unknown;
    try {
      chunk = JSON.parse(line.slice(6));
    } catch {
      return line;
    }
    const choices = (chunk as { choices?: { delta?: Record<string, unknown> }[] }).choices;
    const delta = choices?.[0]?.delta;
    if (!delta || typeof delta.content !== "string") return line;
    const google = (delta.extra_content as { google?: { thought?: boolean } } | undefined)?.google;
    let content = google?.thought ? "" : delta.content.replace(THOUGHT_TAG, "").replace(FENCE, "");
    if (!started) {
      const brace = content.indexOf("{");
      content = brace === -1 ? "" : content.slice(brace);
      started = brace !== -1;
    }
    delta.content = content;
    delete delta.extra_content;
    return `data: ${JSON.stringify(chunk)}`;
  };
}

/** Gemma on the Gemini API rejects JSON mode on long prompts; the prompt already fixes the shape. */
export function adaptRequestBody(body: string): string {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return body;
  }
  if (typeof parsed.model !== "string" || !parsed.model.startsWith("gemma")) return body;
  delete parsed.response_format;
  return JSON.stringify(parsed);
}

function openModelFetch(base: typeof fetch): typeof fetch {
  return async (input, init) => {
    const body = typeof init?.body === "string" ? adaptRequestBody(init.body) : init?.body;
    const res = await base(input, { ...init, body });
    if (!res.body || !res.headers.get("content-type")?.includes("text/event-stream")) return res;
    const clean = createSseCleaner();
    let buffer = "";
    const encoder = new TextEncoder();
    const stream = res.body.pipeThrough(new TextDecoderStream()).pipeThrough(
      new TransformStream<string, Uint8Array>({
        transform(text, controller) {
          buffer += text;
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) controller.enqueue(encoder.encode(`${clean(line)}\n`));
        },
        flush(controller) {
          if (buffer) controller.enqueue(encoder.encode(clean(buffer)));
        },
      }),
    );
    return new Response(stream, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
  };
}
