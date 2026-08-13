jest.mock("srt-parser-2", () => ({
  __esModule: true,
  default: class {
    fromSrt() {
      return [];
    }
  },
}));
jest.mock("epub2", () => ({
  __esModule: true,
  default: { createAsync: jest.fn() },
}));

import {
  buildPortableAssessmentRequest,
  CreateSourceRequestSchema,
} from "./source-request.service";

describe("portable ChatGPT assessment request", () => {
  const database = () => {
    const rows = [
      {
        id: "word-1",
        word: "reconcile",
        normalized_term: "reconcile",
        sense_rank: 1,
        sense_key: "make-consistent",
        sense_gloss: "make records consistent",
        english_meaning: "make records agree",
      },
    ];
    const query: any = {
      select: () => query,
      where: () => query,
      whereIn: (_column: string, terms: string[]) =>
        Promise.resolve(rows.filter((row) => terms.includes(row.normalized_term))),
    };
    return query;
  };

  test("builds a self-contained, reconciled request for ChatGPT", async () => {
    const text =
      "Auditors reconcile the inventory carefully. The result remains dependable.";
    const request = await buildPortableAssessmentRequest(
      database,
      "user-1",
      {
        sourceName: "sample.txt",
        contentBase64: Buffer.from(text).toString("base64"),
      },
    );

    expect(request.formatVersion).toBe("chatgpt-assessment-request-v1");
    expect(request.requestId).toMatch(/^source-request-/);
    expect(request.inventory.source.readableWordCount).toBe(9);
    expect(request.reconciliation.untrackedReadableUnits).toBe(0);
    expect(request.reconciliation.untrackedReadableWords).toBe(0);
    expect(request.existingVocabulary).toHaveLength(1);
    expect(request.assessmentPlan.groupSize).toBe(100);
    expect(request.assessmentPlan.groupingPolicy).toBe("fewest-balanced-50-100-v1");
    expect(request.assessmentPlan.automaticContinuation).toBe(true);
    expect(request.assessmentPlan.totalGroups).toBeGreaterThan(0);
    expect(request.assessmentPlan.groups[0]).toMatchObject({
      groupNumber: 1,
      status: "pending",
    });
    expect(request.assessmentPlan.groups[0].proposedCandidateIds.length).toBeLessThanOrEqual(100);
    expect(request.assessmentPlan.groups[0].recallUnitIds.length).toBeGreaterThan(0);
    expect(request.reconciliation.trackedExpressionRecallUnits).toBe(
      request.reconciliation.expressionRecallUnits,
    );
    expect(request.reconciliation.untrackedExpressionRecallUnits).toBe(0);
    expect(request.reconciliation.assessmentGroups).toBe(
      request.assessmentPlan.totalGroups,
    );
    expect(request.taxonomy.domains).toHaveLength(22);
    expect(request.taxonomy.specificCategories).toHaveLength(440);
    expect(request.requestHash).toMatch(/^[a-f0-9]{64}$/);
  });

  test("rejects empty source data", () => {
    expect(() =>
      CreateSourceRequestSchema.parse({
        sourceName: "empty.txt",
        contentBase64: "",
      }),
    ).toThrow();
  });
});
