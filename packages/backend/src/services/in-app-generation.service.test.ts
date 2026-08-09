import {
  GEMINI_CANDIDATE_RESPONSE_SCHEMA,
  buildManifestDocument,
  normalizeCandidateTaxonomy,
  resolveManifestCandidateAgainstExisting,
} from "./in-app-generation.service";
import { ManifestCandidateSchema } from "./content-pack-contract";
import {
  TAXONOMY_SPECIFIC_CATEGORIES,
  taxonomyPathForCategoryKey,
} from "../data/vocabulary-taxonomy";

function candidate(overrides: Record<string, unknown> = {}) {
  return ManifestCandidateSchema.parse({
    candidateId: "cand-bank-financial",
    term: "bank",
    baseForm: "bank",
    itemType: "word",
    decision: "generate",
    senseDecision: "new_sense",
    senseKey: "financial-institution",
    cefrLevel: "B1",
    usageFrequency: "heavy",
    fluencyValue: "essential",
    categoryName: "Money and banking",
    contextualMeaning: "a financial institution that holds and manages money",
    senseEvidence: {
      sentence: "She deposited the money at the bank.",
      explanation: "Depositing money identifies the financial-institution sense.",
    },
    occurrences: [{
      page: 2,
      chunkId: "chunk-0002",
      sentence: "She deposited the money at the bank.",
    }],
    ...overrides,
  });
}

describe("Gemini Phase 1 contract and contextual-sense parity", () => {
  it("accepts exact short source evidence and records the generated operation", () => {\n    const parsed = candidate({\n      senseEvidence: {\n        sentence: "Go now.",\n        explanation: "The imperative meaning is explicit in the source.",\n      },\n      occurrences: [{ page: 2, chunkId: "chunk-0002", sentence: "Go now." }],\n    });\n\n    expect(parsed.operation).toBe("new");\n    expect(parsed.senseEvidence.sentence).toBe("Go now.");\n  });\n\n  it("reuses an existing stored sense by stable sense key", () => {
    const resolved = resolveManifestCandidateAgainstExisting(candidate(), [{
      id: "11111111-1111-4111-8111-111111111111",
      word: "bank",
      normalized_term: "bank",
      sense_rank: 1,
      sense_key: "financial-institution",
      sense_gloss: "a financial institution that holds and manages money",
    }]);

    expect(resolved).toMatchObject({
      decision: "existing",
      senseDecision: "same_sense",
      matchedWordId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("reuses an equivalent sense despite a different generated sense key", () => {
    const resolved = resolveManifestCandidateAgainstExisting(
      candidate({
        senseKey: "money-service",
        contextualMeaning: "a service that manages money for customers",
      }),
      [{
        id: "22222222-2222-4222-8222-222222222222",
        word: "bank",
        normalized_term: "bank",
        sense_rank: 1,
        sense_key: "financial-institution",
        sense_gloss: "an institution that manages money in accounts",
      }],
    );

    expect(resolved).toMatchObject({
      decision: "existing",
      senseDecision: "same_sense",
      matchedWordId: "22222222-2222-4222-8222-222222222222",
    });
  });

  it("recomputes decision counts and preserves exact page/chunk provenance", () => {
    const generated = candidate();
    const existing = resolveManifestCandidateAgainstExisting(generated, [{
      id: "11111111-1111-4111-8111-111111111111",
      word: "bank",
      normalized_term: "bank",
      sense_key: "financial-institution",
      sense_gloss: "a financial institution that holds and manages money",
    }]);
    const filtered = candidate({
      candidateId: "cand-rare",
      term: "rare",
      baseForm: "rare",
      senseKey: "uncommon",
      decision: "filtered",
      reason: "This contextual sense is low-frequency under the stored import policy.",
    });

    const manifest = buildManifestDocument({
      manifestId: "inapp-phase-1-test",
      sourceName: "source.pdf",
      sourceType: "pdf",
      contentHash: "a".repeat(64),
      totalPages: 2,
      candidates: [existing, filtered] as any,
      pages: [
        { page: 1, status: "assessed", chunkIds: ["chunk-0001"] },
        { page: 2, status: "assessed", chunkIds: ["chunk-0002"] },
      ],
      chunks: [
        {
          chunkId: "chunk-0001",
          pageStart: 1,
          pageEnd: 1,
          status: "assessed",
          candidateIds: ["cand-rare"],
        },
        {
          chunkId: "chunk-0002",
          pageStart: 2,
          pageEnd: 2,
          status: "assessed",
          candidateIds: ["cand-bank-financial"],
        },
      ],
    });

    expect(manifest.counts).toMatchObject({
      totalCandidates: 2,
      generate: 0,
      existing: 1,
      filtered: 1,
      rejected: 0,
    });
    expect(manifest.coverage.pages[0].chunkIds).toEqual(["chunk-0001"]);
    expect(manifest.coverage.pages[1].chunkIds).toEqual(["chunk-0002"]);
    expect(manifest.generationPlan.batches).toEqual([]);
  });
});

describe("Gemini assessment wire schema", () => {
  it("keeps categoryKey compact instead of embedding the taxonomy catalogue", () => {
    const candidateProperties =
      GEMINI_CANDIDATE_RESPONSE_SCHEMA.properties.candidates.items.properties;
    const categorySchema = candidateProperties.categoryKey as {
      type: string;
      enum?: readonly string[];
    };

    expect(categorySchema).toEqual({ type: "STRING" });
    expect(categorySchema.enum).toBeUndefined();
  });
});

describe("assessment taxonomy normalization", () => {
  const approvedCategory = TAXONOMY_SPECIFIC_CATEGORIES[0];
  const approvedPath = taxonomyPathForCategoryKey(approvedCategory.key)!;
  const assessedCandidate = {
    candidateId: "0b97d8f29f04140a7692c8e8ea7bf4d0",
    term: "unpredictable",
    baseForm: "unpredictable",
    itemType: "word",
    contextualMeaning: "likely to change suddenly in a way that cannot be expected",
    senseKey: "not-reliably-predictable",
    categoryKey: approvedCategory.key,
    domainKey: "invented-domain",
    usageGroupKey: "mismatched-group",
    taxonomyConfidence: "high" as const,
    cefrLevel: "B2",
    usageFrequency: "medium" as const,
    fluencyValue: "useful" as const,
    sourceSentence: "The terrain became increasingly unpredictable.",
    senseExplanation: "The terrain could change unexpectedly.",
    decision: "generate" as const,
  };

  it("derives canonical parents from a valid approved leaf", () => {
    expect(normalizeCandidateTaxonomy(assessedCandidate)).toMatchObject({
      categoryKey: approvedCategory.key,
      domainKey: approvedPath.domainKey,
      usageGroupKey: approvedPath.usageGroupKey,
    });
  });

  it("still rejects an invented leaf before manifest persistence", () => {
    expect(() =>
      normalizeCandidateTaxonomy({
        ...assessedCandidate,
        categoryKey: "invented-category",
      }),
    ).toThrow(
      "Assessment proposed an invented taxonomy category for candidate 0b97d8f29f04140a7692c8e8ea7bf4d0",
    );
  });
});

