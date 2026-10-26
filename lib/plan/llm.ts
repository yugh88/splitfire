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
    maxRetries: 0,
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
