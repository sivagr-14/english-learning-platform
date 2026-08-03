import { logger } from "../utils/logger";

export type AiTier = "primary" | "escalation";

export interface AiProviderConfig {
  provider: "gemini" | "openai" | "anthropic";
  apiKey: string;
  model: string;
}

export interface GenerateJsonResult<T> {
  data: T;
  inputTokens: number;
  outputTokens: number;
  /** Estimated USD cost using published rates for the model. */
  estimatedCostUsd: number;
}

interface GenerateJsonOptions {
  systemPrompt: string;
  userPrompt: string;
  tier: AiTier;
}

/**
 * Reads provider config from env at call time (not module load time) so
 * tests/worker restarts pick up .env.local changes without a rebuild.
 *
 * PRIMARY_AI_* -> cheap, high-volume tier (assessment + first-pass generation).
 * ESCALATION_AI_* -> only called when the deterministic quality validator
 * rejects primary-tier output. Defaults: Gemini Flash primary, Gemini Pro
 * escalation (unset = skip escalation, just skip failed entries).
 */
export function configFor(tier: AiTier): AiProviderConfig {
  const prefix = tier === "primary" ? "PRIMARY_AI" : "ESCALATION_AI";
  const provider = (process.env[`${prefix}_PROVIDER`] ||
    "gemini") as AiProviderConfig["provider"];
  const apiKey = process.env[`${prefix}_API_KEY`] || process.env.GEMINI_API_KEY || "";
  const model =
    process.env[`${prefix}_MODEL`] ||
    (tier === "primary" ? "gemini-2.0-flash" : "gemini-2.5-pro");
  if (!apiKey) {
    throw new Error(
      `${prefix}_API_KEY is not set. Add it to .env.local before running the ` +
        `in-app generation pipeline (see .env.example).`,
    );
  }
  if (DEPRECATED_MODELS.has(model)) {
    logger.warn(
      `${prefix}_MODEL is set to "${model}", which Google no longer serves to new ` +
        `API keys. Update ${prefix}_MODEL in .env.local (e.g. to "gemini-2.0-flash" ` +
        `or "gemini-2.5-pro") before running the pipeline.`,
    );
  }
  return { provider, apiKey, model };
}

// Models that Google has retired for new API keys. Kept as an explicit list
// (rather than trying to detect 404s generically) so we can warn proactively
// at config-read time instead of only after burning a failed job.
const DEPRECATED_MODELS = new Set(["gemini-2.5-flash", "gemini-1.0-pro"]);

/**
 * Strips markdown code fences that some model versions wrap around JSON
 * even when responseMimeType: "application/json" is requested.
 * e.g. ```json\n{...}\n``` → {...}
 */
function stripJsonFences(raw: string): string {
  const fenced = raw.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
  return fenced ? fenced[1].trim() : raw.trim();
}

/**
 * Rough cost estimate (USD) based on published Gemini pricing per 1M tokens.
 * These approximate published rates; actual billing may differ.
 */
function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const rates: Record<string, { in: number; out: number }> = {
    "gemini-2.5-flash": { in: 0.30,  out: 2.50  },
    "gemini-2.5-pro":   { in: 1.25,  out: 10.00 },
    "gemini-1.5-flash": { in: 0.075, out: 0.30  },
    "gemini-1.5-pro":   { in: 3.50,  out: 10.50 },
  };
  const rate = rates[model] ?? { in: 0.30, out: 2.50 };
  return (inputTokens * rate.in + outputTokens * rate.out) / 1_000_000;
}

interface CallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

async function callGemini(
  config: AiProviderConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<CallResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
      },
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${body.slice(0, 500)}`);
  }
  const data = (await response.json()) as any;
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini response contained no text output");
  const usage = data?.usageMetadata ?? {};
  return {
    text,
    inputTokens: Number(usage.promptTokenCount ?? 0),
    outputTokens: Number(usage.candidatesTokenCount ?? 0),
  };
}

/**
 * Submit a batched generation request to Gemini's cached/batch endpoint.
 * This is an opt-in, best-effort helper that returns a batch identifier
 * which can be polled later for completion. It is implemented as a
 * minimal stub to integrate with the worker; real-world use should
 * follow the exact Google API spec and handle retries/quotas.
 */
export async function submitGeminiBatch(
  config: AiProviderConfig,
  requests: Array<{ id: string; systemPrompt: string; userPrompt: string }>,
): Promise<{ batchId: string }>
{
  // Using the documented cachedBatches endpoint (v1beta)
  const url = `https://generativelanguage.googleapis.com/v1beta/cachedBatches?key=${config.apiKey}`;
  const body = {
    model: config.model,
    // Each request becomes an item in the batch. Structure may vary
    // depending on Google's exact batch API; adapt when wiring for
    // production.
    requests: requests.map((r) => ({
      id: r.id,
      systemInstruction: { parts: [{ text: r.systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: r.userPrompt }] }],
      generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
    })),
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini batch submit error (${response.status}): ${text.slice(0, 500)}`);
  }
  const data = (await response.json()) as any;
  // The real response shape may be { name: "projects/.../batches/ID" } or
  // { batchId: "..." }. Try to pick a reasonable identifier.
  const batchId = data?.name || data?.batchId || data?.id || JSON.stringify(data).slice(0, 80);
  return { batchId };
}

/**
 * Poll batch status. Minimal helper returning a status string and
 * optionally a results object. Production code should follow API shape.
 */
export async function pollGeminiBatchStatus(
  config: AiProviderConfig,
  batchId: string,
): Promise<{ status: string; result?: any }>
{
  // Best-effort: attempt to GET the batch resource. The exact endpoint
  // depends on the returned batchId shape; adapt as needed.
  const url = `https://generativelanguage.googleapis.com/v1beta/${batchId}?key=${config.apiKey}`;
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini batch status error (${response.status}): ${text.slice(0, 500)}`);
  }
  const data = await response.json();
  // Map to a simple status for worker usage.
  const status = data?.state || data?.status || (data?.done ? "done" : "pending");
  return { status, result: data };
}

async function callOpenAiCompatible(
  config: AiProviderConfig,
  systemPrompt: string,
  userPrompt: string,
  baseUrl: string,
): Promise<CallResult> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API error (${response.status}): ${body.slice(0, 500)}`);
  }
  const data = (await response.json()) as any;
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Response contained no text output");
  const usage = data?.usage ?? {};
  return {
    text,
    inputTokens: Number(usage.prompt_tokens ?? 0),
    outputTokens: Number(usage.completion_tokens ?? 0),
  };
}

async function callAnthropic(
  config: AiProviderConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<CallResult> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${body.slice(0, 500)}`);
  }
  const data = (await response.json()) as any;
  const text = data?.content?.find((block: any) => block.type === "text")?.text;
  if (!text) throw new Error("Anthropic response contained no text output");
  const usage = data?.usage ?? {};
  return {
    text,
    inputTokens: Number(usage.input_tokens ?? 0),
    outputTokens: Number(usage.output_tokens ?? 0),
  };
}

/**
 * Calls the configured model for a tier and parses the result as JSON.
 * Returns the parsed data PLUS token-usage telemetry for cost tracking.
 * Throws on malformed JSON -- the caller decides whether to retry or escalate.
 */
export async function generateJson<T>(options: GenerateJsonOptions): Promise<GenerateJsonResult<T>> {
  const config = configFor(options.tier);
  let callResult: CallResult;

  switch (config.provider) {
    case "gemini":
      callResult = await callGemini(config, options.systemPrompt, options.userPrompt);
      break;
    case "openai":
      callResult = await callOpenAiCompatible(
        config,
        options.systemPrompt,
        options.userPrompt,
        "https://api.openai.com/v1",
      );
      break;
    case "anthropic":
      callResult = await callAnthropic(config, options.systemPrompt, options.userPrompt);
      break;
    default:
      throw new Error(`Unsupported AI provider: ${config.provider}`);
  }

  const cleaned = stripJsonFences(callResult.text);
  let data: T;
  try {
    data = JSON.parse(cleaned) as T;
  } catch {
    logger.warn(`Failed to parse ${tierLabel(options.tier)} model output as JSON`, {
      raw: callResult.text.slice(0, 1000),
    });
    throw new Error(
      `${tierLabel(options.tier)} model (${config.model}) did not return valid JSON`,
    );
  }

  const estimatedCostUsd = estimateCostUsd(
    config.model,
    callResult.inputTokens,
    callResult.outputTokens,
  );

  logger.debug(`AI call [${options.tier}/${config.model}]`, {
    inputTokens: callResult.inputTokens,
    outputTokens: callResult.outputTokens,
    estimatedCostUsd: estimatedCostUsd.toFixed(6),
  });

  return { data, inputTokens: callResult.inputTokens, outputTokens: callResult.outputTokens, estimatedCostUsd };
}

function tierLabel(tier: AiTier) {
  return tier === "primary" ? "Primary" : "Escalation";
}
