import { logger } from "../utils/logger";

export type AiTier = "primary" | "escalation";

export interface AiProviderConfig {
  provider: "gemini" | "openai" | "anthropic";
  apiKey: string;
  model: string;
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
 * PRIMARY_AI_* -> the cheap, high-volume tier (assessment + first-pass
 * generation). ESCALATION_AI_* -> only called when the deterministic
 * validator (vocabularyLessonQualityIssues / assertVocabularyLessonCompliant)
 * rejects primary-tier output, or when assessment flags a sense as
 * "ambiguous". Defaults match the cost analysis from earlier in this
 * project: Gemini Flash as the global default, no escalation configured
 * unless the operator opts in.
 */
function configFor(tier: AiTier): AiProviderConfig {
  const prefix = tier === "primary" ? "PRIMARY_AI" : "ESCALATION_AI";
  const provider = (process.env[`${prefix}_PROVIDER`] ||
    (tier === "primary" ? "gemini" : "gemini")) as AiProviderConfig["provider"];
  const apiKey = process.env[`${prefix}_API_KEY`] || process.env.GEMINI_API_KEY || "";
  const model =
    process.env[`${prefix}_MODEL`] ||
    (tier === "primary" ? "gemini-2.5-flash" : "gemini-2.5-pro");
  if (!apiKey) {
    throw new Error(
      `${prefix}_API_KEY is not set. Add it to .env.local before running the ` +
        `in-app generation pipeline (see .env.example).`,
    );
  }
  return { provider, apiKey, model };
}

async function callGemini(
  config: AiProviderConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
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
  return text;
}

async function callOpenAiCompatible(
  config: AiProviderConfig,
  systemPrompt: string,
  userPrompt: string,
  baseUrl: string,
): Promise<string> {
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
  return text;
}

/**
 * Calls the configured model for a tier and parses the result as JSON.
 * Throws on malformed JSON rather than attempting to repair it -- the
 * caller (assessment/generation stage) is responsible for deciding whether
 * a parse failure should retry same-tier or escalate.
 */
export async function generateJson<T>(options: GenerateJsonOptions): Promise<T> {
  const config = configFor(options.tier);
  let raw: string;

  switch (config.provider) {
    case "gemini":
      raw = await callGemini(config, options.systemPrompt, options.userPrompt);
      break;
    case "openai":
      raw = await callOpenAiCompatible(
        config,
        options.systemPrompt,
        options.userPrompt,
        "https://api.openai.com/v1",
      );
      break;
    case "anthropic":
      // Anthropic's API shape differs enough (no OpenAI-compatible
      // endpoint, system prompt is a top-level field, no response_format)
      // that it needs its own path rather than reusing callOpenAiCompatible.
      raw = await callAnthropic(config, options.systemPrompt, options.userPrompt);
      break;
    default:
      throw new Error(`Unsupported AI provider: ${config.provider}`);
  }

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    logger.warn(`Failed to parse ${tierLabel(options.tier)} model output as JSON`, {
      raw: raw.slice(0, 1000),
    });
    throw new Error(
      `${tierLabel(options.tier)} model (${config.model}) did not return valid JSON`,
    );
  }
}

async function callAnthropic(
  config: AiProviderConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
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
  return text;
}

function tierLabel(tier: AiTier) {
  return tier === "primary" ? "Primary" : "Escalation";
}
