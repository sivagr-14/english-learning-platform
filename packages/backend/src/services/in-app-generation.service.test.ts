import {
  buildManifestDocument,
  resolveManifestCandidateAgainstExisting,
} from "./in-app-generation.service";
import { ManifestCandidateSchema } from "./content-pack-contract";

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
  it("reuses an existing stored sense by stable sense key", () => {
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

  it("holds a partially overlapping stored sense for attention", () => {
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
        sense_gloss: "an institution that manages money and financial services",
      }],
    );

    expect(resolved).toMatchObject({
      decision: "rejected",
      senseDecision: "ambiguous",
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
