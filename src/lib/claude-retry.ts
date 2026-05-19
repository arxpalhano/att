/**
 * Wrapper para chamadas Claude com retry + fallback automático.
 * - 529 (overloaded), 503, 502: retry com exponential backoff
 * - Após 2 retries no modelo primário, tenta modelo fallback
 */
import Anthropic from "@anthropic-ai/sdk";

interface CallOptions {
  primaryModel: string;
  fallbackModel?: string;
  system: string;
  userPrompt: string;
  maxTokens?: number;
  apiKey: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function callClaudeWithRetry(opts: CallOptions): Promise<{
  text: string;
  usage: { input_tokens: number; output_tokens: number };
  modelUsed: string;
  attempts: number;
}> {
  const ai = new Anthropic({ apiKey: opts.apiKey });
  const models = opts.fallbackModel ? [opts.primaryModel, opts.fallbackModel] : [opts.primaryModel];
  let lastError: Error | null = null;
  let attempts = 0;

  for (const model of models) {
    // 3 tentativas por modelo (backoff: 0, 1.5s, 3s)
    for (let i = 0; i < 3; i++) {
      attempts++;
      try {
        const msg = await ai.messages.create({
          model,
          max_tokens: opts.maxTokens ?? 2048,
          system: opts.system,
          messages: [{ role: "user", content: opts.userPrompt }],
        });
        const text = msg.content
          .filter((c) => c.type === "text")
          .map((c) => (c as { type: "text"; text: string }).text)
          .join("\n");
        return { text, usage: msg.usage, modelUsed: model, attempts };
      } catch (e) {
        lastError = e as Error;
        // Status codes que valem a pena retentar
        const errStr = (e as { status?: number; message?: string }).status ?? (e as Error).message;
        const status = typeof errStr === "number" ? errStr : 0;
        const retriable = status === 529 || status === 503 || status === 502 || status === 429 || /overloaded|rate limit/i.test((e as Error).message);
        if (!retriable) throw e;
        // Backoff: 0 → 1.5s → 3s
        if (i < 2) await sleep(1500 * (i + 1));
      }
    }
    // Modelo primário esgotou retries — tenta fallback
  }
  throw lastError ?? new Error("Claude API failed after retries");
}
