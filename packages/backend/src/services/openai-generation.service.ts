import { createHash } from "crypto";
import { z } from "zod";
import {
  assertVocabularyLessonCompliant,
  VocabularyLessonSchema,
} from "../data/vocabulary-lesson-template";
import { AssessmentControlService } from "./assessment-control.service";
import { VocabularyImportService } from "./vocabulary-import.service";

const CandidateSchema = z.object({
  item: z.string().trim().min(1).max(255),
  baseForm: z.string().trim().min(1).max(255),
  itemType: z.enum([
    "word",
    "phrasal verb",
    "idiom",
    "collocation",
    "fixed phrase",
    "conversational pattern",
  ]),
  cefrLevel: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
  usageFrequency: z.enum(["heavy", "medium"]),
  fluencyValue: z.enum(["essential", "useful", "specialized"]),
  contextualMeaning: z.string().trim().min(8),
  originalSentence: z.string().trim().min(8),
  categoryName: z.string().trim().min(1),
});

const CandidateListSchema = z.object({
  candidates: z.array(CandidateSchema).max(40),
});

const GeneratedEntrySchema = z.object({
  pronunciation: z.string().trim().min(2),
  wordType: z.string().trim().min(2),
  englishMeaning: z.string().trim().min(8),
  tamilMeaning: z.string().trim().min(2),
  coreIdea: z.string().trim().min(8),
  lesson: VocabularyLessonSchema,
});

type Candidate = z.infer<typeof CandidateSchema>;
type GeneratedEntry = z.infer<typeof GeneratedEntrySchema>;

const textValue = { type: "string", minLength: 8 };
const usefulList = { type: "array", minItems: 1, items: textValue };
const lessonJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "format_version",
    "overview",
    "meaning_in_context",
    "usage_guide",
    "patterns_collocations",
    "natural_examples",
    "mistakes_differences",
    "memory_practice",
    "advanced_nuance",
  ],
  properties: {
    format_version: { type: "string", const: "simplified-v2" },
    overview: {
      type: "object",
      additionalProperties: false,
      required: ["meaning_usage_profile"],
      properties: {
        meaning_usage_profile: {
          type: "object",
          additionalProperties: false,
          required: ["meaning_type", "connotation", "tone", "register"],
          properties: {
            meaning_type: textValue,
            connotation: textValue,
            tone: textValue,
            register: textValue,
          },
        },
      },
    },
    meaning_in_context: objectSchema(
      ["source_sentence", "contextual_meaning", "simple_explanation"],
      {
        source_sentence: textValue,
        contextual_meaning: textValue,
        simple_explanation: textValue,
      },
    ),
    usage_guide: objectSchema(["when_to_use", "when_not_to_use"], {
      when_to_use: usefulList,
      when_not_to_use: usefulList,
    }),
    patterns_collocations: objectSchema(
      ["main_pattern", "common_collocations"],
      {
        main_pattern: textValue,
        common_collocations: {
          type: "array",
          minItems: 2,
          items: textValue,
        },
      },
    ),
    natural_examples: objectSchema(["examples", "mini_conversation"], {
      examples: {
        type: "object",
        additionalProperties: false,
        required: ["Everyday", "Professional"],
        properties: { Everyday: textValue, Professional: textValue },
      },
      mini_conversation: textValue,
    }),
    mistakes_differences: objectSchema(
      ["common_mistake", "correction", "important_difference"],
      {
        common_mistake: textValue,
        correction: textValue,
        important_difference: textValue,
      },
    ),
    memory_practice: objectSchema(
      [
        "memory_trigger",
        "memory_sentence",
        "recall_question",
        "recognition_task",
        "production_task",
      ],
      {
        memory_trigger: textValue,
        memory_sentence: textValue,
        recall_question: textValue,
        recognition_task: textValue,
        production_task: textValue,
      },
    ),
    advanced_nuance: usefulList,
  },
};

function objectSchema(required: string[], properties: Record<string, unknown>) {
  return { type: "object", additionalProperties: false, required, properties };
}

const generatedEntryJsonSchema = objectSchema(
  [
    "pronunciation",
    "wordType",
    "englishMeaning",
    "tamilMeaning",
    "coreIdea",
    "lesson",
  ],
  {
    pronunciation: { type: "string", minLength: 2 },
    wordType: { type: "string", minLength: 2 },
    englishMeaning: textValue,
    tamilMeaning: { type: "string", minLength: 2 },
    coreIdea: textValue,
    lesson: lessonJsonSchema,
  },
);

const candidateListJsonSchema = objectSchema(["candidates"], {
  candidates: {
    type: "array",
    maxItems: 40,
    items: objectSchema(
      [
        "item",
        "baseForm",
        "itemType",
        "cefrLevel",
        "usageFrequency",
        "fluencyValue",
        "contextualMeaning",
        "originalSentence",
        "categoryName",
      ],
      {
        item: { type: "string" },
        baseForm: { type: "string" },
        itemType: {
          type: "string",
          enum: [
            "word",
            "phrasal verb",
            "idiom",
            "collocation",
            "fixed phrase",
            "conversational pattern",
          ],
        },
        cefrLevel: {
          type: "string",
          enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
        },
        usageFrequency: { type: "string", enum: ["heavy", "medium"] },
        fluencyValue: {
          type: "string",
          enum: ["essential", "useful", "specialized"],
        },
        contextualMeaning: textValue,
        originalSentence: textValue,
        categoryName: { type: "string" },
      },
    ),
  },
});

export class OpenAIResponsesClient {
  constructor(
    private readonly apiKey = process.env.OPENAI_API_KEY,
    private readonly model = process.env.OPENAI_MODEL || "gpt-5.6-terra",
    private readonly request: typeof fetch = fetch,
  ) {}

  configured() {
    return Boolean(this.apiKey?.trim());
  }

  async structured<T>(
    name: string,
    schema: Record<string, unknown>,
    instructions: string,
    input: string,
  ): Promise<{ value: T; responseId: string }> {
    if (!this.configured()) {
      const error = new Error(
        "OpenAI generation is not configured. Add OPENAI_API_KEY to .env.local and restart the current version.",
      ) as Error & { status?: number };
      error.status = 503;
      throw error;
    }
    const response = await this.request("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        store: false,
        instructions,
        input,
        text: { format: { type: "json_schema", name, strict: true, schema } },
      }),
      signal: AbortSignal.timeout(120_000),
    });
    const body = (await response.json()) as any;
    if (!response.ok) {
      throw new Error(
        body?.error?.message || `OpenAI request failed (${response.status}).`,
      );
    }
    const outputText = (body.output || [])
      .flatMap((item: any) => item.content || [])
      .find((item: any) => item.type === "output_text")?.text;
    if (!outputText)
      throw new Error("OpenAI returned no structured lesson content.");
    return { value: JSON.parse(outputText) as T, responseId: body.id };
  }
}

export class AutomatedVocabularyService {
  private readonly activeJobs = new Set<string>();

  constructor(
    private readonly database: any,
    private readonly openai = new OpenAIResponsesClient(),
  ) {}

  status() {
    return {
      configured: this.openai.configured(),
      model: process.env.OPENAI_MODEL || "gpt-5.6-terra",
    };
  }

  async assessText(userId: string, name: string, text: string) {
    const categories = await this.database("vocabulary_categories")
      .where({ is_active: true })
      .pluck("category_name");
    const { value } = await this.openai.structured<unknown>(
      "vocabulary_candidates",
      candidateListJsonSchema,
      [
        "Identify valuable English vocabulary from the supplied content.",
        "Select only high- or medium-frequency items worth learning.",
        "Prefer the exact sense used in the source and preserve its source sentence.",
        `Choose exactly one category from: ${categories.join(", ")}.`,
        "Do not invent items absent from the content.",
      ].join("\n"),
      text,
    );
    const { candidates } = CandidateListSchema.parse(value);
    if (!candidates.length) {
      const error = new Error(
        "No suitable high- or medium-value vocabulary was found.",
      ) as Error & {
        status?: number;
      };
      error.status = 422;
      throw error;
    }

    const existing = await this.database("vocabulary_words")
      .where((builder: any) =>
        builder.where("owner_user_id", userId).orWhereNull("owner_user_id"),
      )
      .whereIn(
        this.database.raw("LOWER(word)"),
        candidates.map((candidate) => candidate.item.toLowerCase()),
      )
      .select("id", "word");
    const existingByTerm = new Map<string, any>(
      existing.map((word: any) => [word.word.toLowerCase(), word]),
    );
    const hash = createHash("sha256").update(text).digest("hex");
    const assessment = new AssessmentControlService(this.database);
    return assessment.createAssessment(userId, {
      operationId: `local-${hash.slice(0, 20)}-${Date.now()}`,
      source: {
        type: "text",
        name,
        contentHash: hash,
        metadata: { characters: text.length },
      },
      candidates: candidates.map((candidate) => {
        const match = existingByTerm.get(candidate.item.toLowerCase());
        return {
          action: match ? "unchanged" : "new",
          matchedWordId: match?.id,
          item: candidate.item,
          baseForm: candidate.baseForm,
          itemType: candidate.itemType,
          cefrLevel: candidate.cefrLevel,
          usageFrequency: candidate.usageFrequency,
          fluencyValue: candidate.fluencyValue,
          learningPriority:
            candidate.usageFrequency === "heavy" ? "high" : "medium",
          contextualMeaning: candidate.contextualMeaning,
          originalSentence: candidate.originalSentence,
          proposedCategories: [
            { name: candidate.categoryName, relationship: "primary" },
          ],
        };
      }),
    });
  }

  async processJob(userId: string, jobId: string) {
    if (this.activeJobs.has(jobId)) return;
    this.activeJobs.add(jobId);
    try {
      await this.database("generation_jobs")
        .where({ id: jobId, owner_user_id: userId })
        .update({ status: "processing", updated_at: new Date() });
      await this.database("generation_job_items")
        .where({ generation_job_id: jobId, status: "processing" })
        .update({ status: "pending", updated_at: new Date() });
      const items = await this.database("generation_job_items")
        .join(
          "assessment_candidates",
          "generation_job_items.assessment_candidate_id",
          "assessment_candidates.id",
        )
        .where({
          "generation_job_items.generation_job_id": jobId,
          "generation_job_items.status": "pending",
        })
        .select(
          "generation_job_items.id as job_item_id",
          "assessment_candidates.*",
        );

      for (const candidate of items) {
        await this.processItem(userId, jobId, candidate);
      }
      await this.reconcileJob(userId, jobId);
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  async resumePendingJobs() {
    const jobs = await this.database("generation_jobs")
      .whereIn("status", ["approved", "processing"])
      .select("id", "owner_user_id");
    for (const job of jobs) {
      await this.processJob(job.owner_user_id, job.id);
    }
  }

  private async processItem(userId: string, jobId: string, candidate: any) {
    await this.database("generation_job_items")
      .where({ id: candidate.job_item_id })
      .update({
        status: "processing",
        attempt_count: this.database.raw("attempt_count + 1"),
        updated_at: new Date(),
      });
    try {
      const categories = readJson<any[]>(candidate.proposed_categories, []);
      const primary = categories.find(
        (category: any) => category.relationship === "primary",
      );
      const generated = await this.generateEntry(candidate);
      const imported = await new VocabularyImportService(
        this.database,
      ).importSingle(
        {
          category: primary?.name,
          word: candidate.item,
          pronunciation: generated.value.pronunciation,
          word_type: generated.value.wordType,
          item_type: candidate.item_type,
          cefr_level: candidate.cefr_level,
          frequency: candidate.usage_frequency === "heavy" ? "High" : "Medium",
          english_meaning: generated.value.englishMeaning,
          tamil_meaning: generated.value.tamilMeaning,
          core_idea: generated.value.coreIdea,
          lesson_data: generated.value.lesson,
        },
        userId,
      );
      if (imported.imported !== 1) {
        throw new Error(
          imported.errors[0]?.message || "The generated entry was not saved.",
        );
      }
      const wordId = imported.items[0].word.id;
      await this.database.transaction(async (trx: any) => {
        await trx("generation_job_items")
          .where({ id: candidate.job_item_id })
          .update({
            status: "completed",
            last_error: null,
            completed_at: new Date(),
            updated_at: new Date(),
          });
        await trx("assessment_candidates").where({ id: candidate.id }).update({
          status: "completed",
          matched_word_id: wordId,
          updated_at: new Date(),
        });
        await trx("control_audit_events").insert({
          owner_user_id: userId,
          operation_id: `${jobId}:${candidate.job_item_id}`,
          event_type: "generation.completed",
          entity_type: "vocabulary_word",
          entity_id: wordId,
          details: JSON.stringify({ responseId: generated.responseId }),
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.database("generation_job_items")
        .where({ id: candidate.job_item_id })
        .update({
          status: "manual_review",
          last_error: message,
          updated_at: new Date(),
        });
      await this.database("assessment_candidates")
        .where({ id: candidate.id })
        .update({ status: "manual_review", updated_at: new Date() });
    }
  }

  private async generateEntry(candidate: unknown) {
    const term = String((candidate as any)?.item || "").trim();
    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const result = await this.openai.structured<unknown>(
          "vocabulary_lesson",
          generatedEntryJsonSchema,
          [
            "Create a complete English learning entry with useful Tamil support.",
            "All eight lesson sections are mandatory and must be specific to the exact term and sense.",
            "Use the term explicitly in the source sentence, main pattern, memory sentence, at least two examples, mistake/correction, and advanced nuance.",
            "Never use placeholders, generic advice, or empty values.",
            attempt === 2
              ? `The first result failed local validation: ${lastError instanceof Error ? lastError.message : String(lastError)}`
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
          JSON.stringify(candidate),
        );
        const value = GeneratedEntrySchema.parse(result.value);
        assertVocabularyLessonCompliant(value.lesson, term);
        return { ...result, value };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  private async reconcileJob(userId: string, jobId: string) {
    const counts = await this.database("generation_job_items")
      .where({ generation_job_id: jobId })
      .select("status")
      .then((rows: any[]) =>
        rows.reduce<Record<string, number>>((total, row) => {
          total[row.status] = (total[row.status] || 0) + 1;
          return total;
        }, {}),
      );
    const completed = counts.completed || 0;
    const failed = counts.failed || 0;
    const manual = counts.manual_review || 0;
    const status = manual || failed ? "manual_review" : "completed";
    const job = await this.database("generation_jobs")
      .where({ id: jobId, owner_user_id: userId })
      .first();
    await this.database.transaction(async (trx: any) => {
      await trx("generation_jobs").where({ id: jobId }).update({
        status,
        completed_items: completed,
        failed_items: failed,
        manual_review_items: manual,
        updated_at: new Date(),
      });
      await trx("assessment_runs").where({ id: job.assessment_run_id }).update({
        status,
        completed_at: new Date(),
        updated_at: new Date(),
      });
    });
  }
}

function readJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return (value as T) || fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export const openAIContract = {
  CandidateListSchema,
  GeneratedEntrySchema,
  candidateListJsonSchema,
  generatedEntryJsonSchema,
};
