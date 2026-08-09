import { AiProviderConfig } from "./ai-provider.service";
import { classifyHttpFailure, ProviderRequestError } from "./provider-reliability";
import {
  VOCABULARY_SECTION_TEMPLATE_PROMPT,
  VOCABULARY_LESSON_FORMAT_VERSION,
  VOCABULARY_ENTRY_RESPONSE_SCHEMA,
  generatedVocabularyEntryQualityIssues,
} from "../data/vocabulary-lesson-template";
import { GeneratedPackEntrySchema } from "./content-pack-contract";

export type GenerationExecutionMode = "auto" | "standard" | "batch";
export type ResolvedGenerationExecutionMode = Exclude<GenerationExecutionMode, "auto">;
export const GEMINI_BATCH_THRESHOLD = 20;

export function resolveGenerationExecutionMode(
  requested: GenerationExecutionMode,
  generationCount: number,
): ResolvedGenerationExecutionMode {
  if (!Number.isInteger(generationCount) || generationCount < 0)
    throw new Error("Generation count must be a non-negative integer.");
  return requested === "auto"
    ? generationCount <= GEMINI_BATCH_THRESHOLD
      ? "standard"
      : "batch"
    : requested;
}

export interface GeminiBatchRequest {
  candidateId: string;
  systemPrompt: string;
  userPrompt: string;
  responseSchema: Record<string, unknown>;
}

export interface GeminiBatchSubmission {
  name: string;
  state: string;
}

export interface GeminiBatchResult {
  candidateId: string;
  response?: Record<string, unknown>;
  error?: { code?: number; message?: string; status?: string };
}

function apiKeyHeader(config: AiProviderConfig) {
  return { "Content-Type": "application/json", "x-goog-api-key": config.apiKey };
}

function normalizeBatchName(name: unknown): string {
  const value = String(name || "");
  if (!/^batches\/[A-Za-z0-9._-]+$/.test(value))
    throw new ProviderRequestError(
      "permanent_failure",
      "Gemini Batch API did not return a valid batches/* resource name.",
      false,
    );
  return value;
}

async function readFailure(response: Response): Promise<never> {
  const body = await response.text();
  throw classifyHttpFailure(response.status, body.slice(0, 500));
}

/**
 * Batch creation is deliberately never retried here. Google's create call is
 * not idempotent: an uncertain network result must be recorded for attention
 * instead of risking a second paid batch.
 */
export async function submitGeminiBatch(
  config: AiProviderConfig,
  displayName: string,
  requests: GeminiBatchRequest[],
  signal?: AbortSignal,
): Promise<GeminiBatchSubmission> {
  if (!requests.length) throw new Error("A Gemini batch requires at least one request.");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:batchGenerateContent`,
    {
      method: "POST",
      headers: apiKeyHeader(config),
      signal,
      body: JSON.stringify({
        batch: {
          displayName,
          inputConfig: {
            requests: {
              requests: requests.map((item) => ({
                metadata: { candidateId: item.candidateId },
                request: {
                  systemInstruction: { parts: [{ text: item.systemPrompt }] },
                  contents: [{ role: "user", parts: [{ text: item.userPrompt }] }],
                  generationConfig: {
                    temperature: 0,
                    responseMimeType: "application/json",
                    responseSchema: item.responseSchema,
                  },
                },
              })),
            },
          },
        },
      }),
    },
  );
  if (!response.ok) return readFailure(response);
  const data = (await response.json()) as any;
  return {
    name: normalizeBatchName(data.name ?? data.batch?.name),
    state: String(data.metadata?.state ?? data.batch?.state ?? "BATCH_STATE_PENDING"),
  };
}

export async function getGeminiBatch(
  config: AiProviderConfig,
  name: string,
  signal?: AbortSignal,
): Promise<{ name: string; state: string; results: GeminiBatchResult[]; stats: Record<string, number> }> {
  const batchName = normalizeBatchName(name);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${batchName}`,
    { headers: apiKeyHeader(config), signal },
  );
  if (!response.ok) return readFailure(response);
  const data = (await response.json()) as any;
  const raw =
    data.output?.inlinedResponses?.inlinedResponses ??
    data.dest?.inlinedResponses ??
    data.response?.inlinedResponses ??
    [];
  const results: GeminiBatchResult[] = raw.map((item: any) => ({
    candidateId: String(item.metadata?.candidateId ?? ""),
    ...(item.response ? { response: item.response } : {}),
    ...(item.error ? { error: item.error } : {}),
  }));
  if (results.some((item) => !item.candidateId))
    throw new ProviderRequestError(
      "validation_failed",
      "Gemini Batch result is missing immutable candidate metadata.",
      false,
    );
  const sourceStats = data.batchStats ?? data.metadata?.batchStats ?? {};
  const stats = Object.fromEntries(
    ["requestCount", "successfulRequestCount", "failedRequestCount", "pendingRequestCount"]
      .map((key) => [key, Number(sourceStats[key] ?? 0)]),
  );
  return {
    name: batchName,
    state: String(data.state ?? data.metadata?.state ?? "BATCH_STATE_PENDING"),
    results,
    stats,
  };
}

export async function cancelGeminiBatch(
  config: AiProviderConfig,
  name: string,
  signal?: AbortSignal,
): Promise<void> {
  const batchName = normalizeBatchName(name);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${batchName}:cancel`,
    { method: "POST", headers: apiKeyHeader(config), signal },
  );
  if (!response.ok) return readFailure(response);
}

export function reconcileGeminiBatchResults(
  expectedCandidateIds: string[],
  results: GeminiBatchResult[],
) {
  const expected = new Set(expectedCandidateIds);
  const seen = new Set<string>();
  const succeeded: GeminiBatchResult[] = [];
  const failed: GeminiBatchResult[] = [];
  for (const result of results) {
    if (!expected.has(result.candidateId))
      throw new Error(`Unexpected Gemini Batch candidate ID: ${result.candidateId}`);
    if (seen.has(result.candidateId))
      throw new Error(`Duplicate Gemini Batch candidate ID: ${result.candidateId}`);
    seen.add(result.candidateId);
    (result.response ? succeeded : failed).push(result);
  }
  return {
    succeeded,
    failed,
    missingCandidateIds: expectedCandidateIds.filter((id) => !seen.has(id)),
  };
}


export interface LessonBatchCandidate {
  candidateId: string;
  term: string;
  contextualMeaning: string;
  sourceSentence: string;
  surroundingContext?: string;
  cefrLevel?: string;
  categoryName?: string;
}

export function buildGeminiLessonBatchRequest(
  candidate: LessonBatchCandidate,
): GeminiBatchRequest {
  return {
    candidateId: candidate.candidateId,
    responseSchema: VOCABULARY_ENTRY_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
    systemPrompt: `You write a complete vocabulary lesson for an English learner.

${VOCABULARY_SECTION_TEMPLATE_PROMPT}

Return only the exact structured JSON requested. Use the real unsuffixed term "${candidate.term}", exactly one contextual sense, all eight ${VOCABULARY_LESSON_FORMAT_VERSION} sections, natural Tamil, and no placeholders or generic advice.`,
    userPrompt: `Term: ${candidate.term}
Contextual meaning: ${candidate.contextualMeaning}
Exact source sentence: ${candidate.sourceSentence}
Surrounding context: ${candidate.surroundingContext || candidate.sourceSentence}
CEFR level: ${candidate.cefrLevel || "B1"}
Category: ${candidate.categoryName || "general"}
Tamil must naturally translate only this contextual sense.`,
  };
}

export function parseGeminiLessonBatchResponse(
  candidate: LessonBatchCandidate,
  response: Record<string, any>,
) {
  const text = response?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new ProviderRequestError("malformed_json", "Gemini Batch response contained no text output.", false);
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(String(text).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  } catch {
    throw new ProviderRequestError("malformed_json", "Gemini Batch response was not valid JSON.", false);
  }
  const { word, pronunciation, wordType, englishMeaning, tamilMeaning, coreIdea, ...lesson } = raw;
  const issues = generatedVocabularyEntryQualityIssues(
    { word, pronunciation, wordType, englishMeaning, tamilMeaning, coreIdea, lesson },
    { term: candidate.term, contextualMeaning: candidate.contextualMeaning, sourceSentence: candidate.sourceSentence },
  );
  if (issues.length)
    throw new ProviderRequestError("validation_failed", `Gemini Batch lesson failed quality validation: ${issues.join("; ")}`, false);
  return {
    entry: GeneratedPackEntrySchema.parse({
      candidateId: candidate.candidateId,
      word: String(word || ""),
      pronunciation: String(pronunciation || ""),
      wordType: String(wordType || ""),
      englishMeaning: String(englishMeaning || ""),
      tamilMeaning: String(tamilMeaning || ""),
      coreIdea: String(coreIdea || ""),
      lesson,
    }),
    inputTokens: Number(response?.usageMetadata?.promptTokenCount ?? 0),
    outputTokens: Number(response?.usageMetadata?.candidatesTokenCount ?? 0),
    cachedTokens: Number(response?.usageMetadata?.cachedContentTokenCount ?? 0),
    thinkingTokens: Number(response?.usageMetadata?.thoughtsTokenCount ?? 0),
  };
}
