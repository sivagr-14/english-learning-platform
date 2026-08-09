import { logger } from "../utils/logger";
import {
  classifyHttpFailure,
  ProviderRequestError,
  timeoutSignal,
  withProviderRetry,
} from "./provider-reliability";
import { calculateGeminiCost } from "./gemini-cost-optimization.service";

export type AiTier = "primary" | "escalation";

export interface AiProviderConfig {
  provider: "gemini" | "openai" | "anthropic" | "ollama";
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface GenerateJsonResult<T> {
  data: T;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  model: string;
  latencyMs: number;
  /** Estimated USD cost using published rates for the model. */
  estimatedCostUsd: number;
}

export interface GenerateJsonOptions {
  systemPrompt: string;
  userPrompt: string;
  tier: AiTier;
  signal?: AbortSignal;
  timeoutMs?: number;
  responseSchema?: Record<string, unknown>;
  provider?: AiProviderConfig["provider"];
}

export interface JsonProviderAdapter {
  generate<T>(options: GenerateJsonOptions): Promise<GenerateJsonResult<T>>;
  testConnection(signal?: AbortSignal): Promise<{ model: string; latencyMs: number }>;
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
export function configFor(
  tier: AiTier,
  providerOverride?: AiProviderConfig["provider"],
): AiProviderConfig {
  if (providerOverride === "ollama") {
    return {
      provider: "ollama",
      apiKey: "",
      model: process.env.OLLAMA_MODEL || "qwen3:14b",
      baseUrl: (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, ""),
    };
  }
  const prefix = tier === "primary" ? "PRIMARY_AI" : "ESCALATION_AI";
  const provider = (providerOverride || process.env[`${prefix}_PROVIDER`] ||
    "gemini") as AiProviderConfig["provider"];
  const apiKey =
    process.env[`${prefix}_API_KEY`] || process.env.GEMINI_API_KEY || "";
  const model =
    process.env[`${prefix}_MODEL`] ||
    (tier === "primary" ? "gemini-2.5-flash" : "gemini-2.5-pro");
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
const DEPRECATED_MODELS = new Set(["gemini-2.0-flash", "gemini-1.0-pro"]);

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
function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cachedTokens = 0,
): number {
  return calculateGeminiCost(model, { inputTokens, outputTokens, cachedTokens }, "standard");
}

interface CallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
}

async function callGemini(
  config: AiProviderConfig,
  systemPrompt: string,
  userPrompt: string,
  signal?: AbortSignal,
  responseSchema?: Record<string, unknown>,
): Promise<CallResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        ...(responseSchema ? { responseSchema } : {}),
      },
    }),
    signal,
  });
  if (!response.ok) {
    const body = await response.text();
    throw classifyHttpFailure(response.status, body);
  }
  const data = (await response.json()) as any;
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini response contained no text output");
  const usage = data?.usageMetadata ?? {};
  return {
    text,
    inputTokens: Number(usage.promptTokenCount ?? 0),
    outputTokens: Number(usage.candidatesTokenCount ?? 0),
    cachedTokens: Number(usage.cachedContentTokenCount ?? 0),
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
): Promise<{ batchId: string }> {
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
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
      },
    })),
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Gemini batch submit error (${response.status}): ${text.slice(0, 500)}`,
    );
  }
  const data = (await response.json()) as any;
  // The real response shape may be { name: "projects/.../batches/ID" } or
  // { batchId: "..." }. Try to pick a reasonable identifier.
  const batchId =
    data?.name ||
    data?.batchId ||
    data?.id ||
    JSON.stringify(data).slice(0, 80);
  return { batchId };
}

/**
 * Poll batch status. Minimal helper returning a status string and
 * optionally a results object. Production code should follow API shape.
 */
export async function pollGeminiBatchStatus(
  config: AiProviderConfig,
  batchId: string,
): Promise<{ status: string; result?: any }> {
  // Best-effort: attempt to GET the batch resource. The exact endpoint
  // depends on the returned batchId shape; adapt as needed.
  const url = `https://generativelanguage.googleapis.com/v1beta/${batchId}?key=${config.apiKey}`;
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Gemini batch status error (${response.status}): ${text.slice(0, 500)}`,
    );
  }
  const data = (await response.json()) as any;
  // Map to a simple status for worker usage.
  const status =
    data?.state || data?.status || (data?.done ? "done" : "pending");
  return { status, result: data };
}

async function callOpenAiCompatible(
  config: AiProviderConfig,
  systemPrompt: string,
  userPrompt: string,
  baseUrl: string,
  signal?: AbortSignal,
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
    signal,
  });
  if (!response.ok) {
    const body = await response.text();
    throw classifyHttpFailure(response.status, body);
  }
  const data = (await response.json()) as any;
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Response contained no text output");
  const usage = data?.usage ?? {};
  return {
    text,
    inputTokens: Number(usage.prompt_tokens ?? 0),
    outputTokens: Number(usage.completion_tokens ?? 0),
    cachedTokens: Number(usage.cached_tokens ?? 0),
  };
}

async function callAnthropic(
  config: AiProviderConfig,
  systemPrompt: string,
  userPrompt: string,
  signal?: AbortSignal,
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
    signal,
  });
  if (!response.ok) {
    const body = await response.text();
    throw classifyHttpFailure(response.status, body);
  }
  const data = (await response.json()) as any;
  const text = data?.content?.find((block: any) => block.type === "text")?.text;
  if (!text) throw new Error("Anthropic response contained no text output");
  const usage = data?.usage ?? {};
  return {
    text,
    inputTokens: Number(usage.input_tokens ?? 0),
    outputTokens: Number(usage.output_tokens ?? 0),
    cachedTokens: Number(usage.cache_read_input_tokens ?? 0),
  };
}

function ollamaSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ollamaSchema);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      key === "type" && typeof entry === "string"
        ? entry.toLowerCase()
        : ollamaSchema(entry),
    ]),
  );
}

async function callOllama(
  config: AiProviderConfig,
  systemPrompt: string,
  userPrompt: string,
  signal?: AbortSignal,
  responseSchema?: Record<string, unknown>,
): Promise<CallResult> {
  const response = await fetch(`${config.baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      stream: false,
      think: false,
      keep_alive: process.env.OLLAMA_KEEP_ALIVE || "10m",
      format: responseSchema ? ollamaSchema(responseSchema) : "json",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `${userPrompt}\n/no_think` },
      ],
      options: {
        temperature: Number(process.env.OLLAMA_TEMPERATURE || 0),
        num_ctx: Number(process.env.OLLAMA_CONTEXT_LENGTH || 16384),
        num_predict: Number(process.env.OLLAMA_MAX_OUTPUT_TOKENS || 8192),
      },
    }),
    signal,
  });
  if (!response.ok) {
    const body = await response.text();
    throw classifyHttpFailure(response.status, body);
  }
  const data = (await response.json()) as any;
  const text = data?.message?.content;
  if (!text) throw new Error("Ollama response contained no text output");
  return {
    text,
    inputTokens: Number(data.prompt_eval_count ?? 0),
    outputTokens: Number(data.eval_count ?? 0),
    cachedTokens: 0,
  };
}

/**
 * Calls the configured model for a tier and parses the result as JSON.
 * Returns the parsed data PLUS token-usage telemetry for cost tracking.
 * Throws on malformed JSON -- the caller decides whether to retry or escalate.
 */
export async function generateJson<T>(
  options: GenerateJsonOptions,
): Promise<GenerateJsonResult<T>> {
  const config = configFor(options.tier, options.provider);
  const startedAt = Date.now();
  const requestTimeoutMs = options.timeoutMs ??
    (config.provider === "ollama"
      ? Number(process.env.OLLAMA_REQUEST_TIMEOUT_MS || 300_000)
      : 90_000);
  const callResult = await withProviderRetry(async () => {
    const timeout = timeoutSignal(options.signal, requestTimeoutMs);
    try {
      switch (config.provider) {
        case "gemini":
          return await callGemini(
            config,
            options.systemPrompt,
            options.userPrompt,
            timeout.signal,
            options.responseSchema,
          );
        case "openai":
          return await callOpenAiCompatible(
            config,
            options.systemPrompt,
            options.userPrompt,
            "https://api.openai.com/v1",
            timeout.signal,
          );
        case "anthropic":
          return await callAnthropic(
            config,
            options.systemPrompt,
            options.userPrompt,
            timeout.signal,
          );
        case "ollama":
          return await callOllama(
            config,
            options.systemPrompt,
            options.userPrompt,
            timeout.signal,
            options.responseSchema,
          );
        default:
          throw new ProviderRequestError(
            "permanent_failure",
            `Unsupported AI provider: ${config.provider}`,
            false,
          );
      }
    } catch (error) {
      if (timeout.timedOut())
        throw new ProviderRequestError(
          "timeout",
          `Provider request exceeded ${requestTimeoutMs} ms`,
          true,
        );
      throw error;
    } finally {
      timeout.dispose();
    }
  });

  const cleaned = stripJsonFences(callResult.text);
  let data: T;
  try {
    data = JSON.parse(cleaned) as T;
  } catch {
    // Never log provider output: it can contain private source text.
    logger.warn(`Failed to parse ${tierLabel(options.tier)} model output as JSON`);
    throw new ProviderRequestError(
      "malformed_json",
      `${tierLabel(options.tier)} model (${
        config.model
      }) did not return valid JSON`,
      false,
    );
  }

  const estimatedCostUsd = config.provider === "ollama"
    ? 0
    : estimateCostUsd(
        config.model,
        callResult.inputTokens,
        callResult.outputTokens,
        callResult.cachedTokens,
      );

  logger.debug(`AI call [${options.tier}/${config.model}]`, {
    inputTokens: callResult.inputTokens,
    outputTokens: callResult.outputTokens,
    estimatedCostUsd: estimatedCostUsd.toFixed(6),
  });

  return {
    data,
    inputTokens: callResult.inputTokens,
    outputTokens: callResult.outputTokens,
    cachedTokens: callResult.cachedTokens,
    model: config.model,
    latencyMs: Date.now() - startedAt,
    estimatedCostUsd,
  };
}

export class GeminiAdapter implements JsonProviderAdapter {
  generate<T>(options: GenerateJsonOptions) {
    return generateJson<T>(options);
  }

  async testConnection(signal?: AbortSignal) {
    const startedAt = Date.now();
    const result = await generateJson<{ ok: boolean }>({
      tier: "primary",
      systemPrompt: "Return JSON only.",
      userPrompt: 'Return {"ok":true}. Do not repeat any supplied data.',
      responseSchema: {
        type: "OBJECT",
        properties: { ok: { type: "BOOLEAN" } },
        required: ["ok"],
      },
      signal,
      timeoutMs: 15_000,
    });
    if (result.data.ok !== true) throw new Error("Gemini connectivity response was invalid");
    return { model: result.model, latencyMs: Date.now() - startedAt };
  }
}

export class OllamaAdapter implements JsonProviderAdapter {
  generate<T>(options: GenerateJsonOptions) {
    return generateJson<T>({ ...options, provider: "ollama" });
  }

  async testConnection(signal?: AbortSignal) {
    const startedAt = Date.now();
    const result = await generateJson<{ ok: boolean }>({
      tier: "primary",
      provider: "ollama",
      systemPrompt: "Return JSON only.",
      userPrompt: 'Return {"ok":true}.',
      responseSchema: {
        type: "object",
        additionalProperties: false,
        properties: { ok: { type: "boolean" } },
        required: ["ok"],
      },
      signal,
      timeoutMs: Number(process.env.OLLAMA_CONNECTION_TIMEOUT_MS || 120_000),
    });
    if (result.data.ok !== true)
      throw new Error("Ollama connectivity response was invalid");
    return { model: result.model, latencyMs: Date.now() - startedAt };
  }
}

function tierLabel(tier: AiTier) {
  return tier === "primary" ? "Primary" : "Escalation";
}
