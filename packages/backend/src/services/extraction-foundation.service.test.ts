import {
  applyCandidatePolicy,
  buildGenerationPlan,
  deduplicateByContextualSense,
  enumerateCandidates,
  makeSegment,
  normalizeSourceText,
} from "./extraction-foundation.service";

const segment = (text: string, sequence = 1) =>
  makeSegment({
    sequence,
    originalText: text,
    status: "readable",
    locator: {
      unit: "paragraph",
      unitIndex: sequence,
      paragraph: sequence,
      startOffset: 0,
      endOffset: text.length,
    },
  });

describe("Phase 2 extraction foundation", () => {
  test("normalization and enumeration are deterministic and retain exact occurrences", () => {
    expect(normalizeSourceText("“Workers” carried-on\r\nwork")).toBe(
      '"Workers" carried-on\nwork',
    );
    const source = [
      segment("They carried on working. Later they carry on despite setbacks."),
    ];
    expect(enumerateCandidates(source)).toEqual(enumerateCandidates(source));
    const phrase = enumerateCandidates(source).find(
      (c) => c.baseForm === "carry on",
    );
    expect(phrase?.occurrences).toHaveLength(2);
    expect(phrase?.occurrences[0].sentence).toBe("They carried on working.");
  });

  test("separable phrasal verbs and duplicate occurrences preserve spans", () => {
    const candidates = enumerateCandidates([
      segment("She turned the offer down. They turn down weak offers."),
    ]);
    const phrase = candidates.find((c) => c.baseForm === "turn down");
    expect(phrase?.occurrences).toHaveLength(2);
    expect(phrase?.occurrences.every((o) => o.endOffset > o.startOffset)).toBe(
      true,
    );
  });

  test("open n-gram discovery is not limited to the curated expression list", () => {
    const candidates = enumerateCandidates([
      segment("Engineers carefully reconcile every lexical inventory item."),
    ]);
    expect(candidates.some((candidate) =>
      candidate.baseForm === "reconcile every lexical inventory" &&
      candidate.detection.includes("open-ngram-4"),
    )).toBe(true);
  });

  test("policy accounts for low frequency and malformed candidates with stable reasons", () => {
    const candidate = enumerateCandidates([
      segment("Researchers investigate evidence."),
    ]).find((c) => c.baseForm === "researcher")!;
    expect(applyCandidatePolicy(candidate, "low")).toMatchObject({
      decision: "filtered",
      reasonCode: "LOW_FREQUENCY_SENSE",
    });
    expect(
      applyCandidatePolicy({ ...candidate, normalizedTerm: "bad@@token" }),
    ).toMatchObject({ decision: "rejected", reasonCode: "MALFORMED_TOKEN" });
  });

  test("same term and sense merges across documents but distinct senses remain", () => {
    const base = enumerateCandidates([
      segment("The bank approved the loan."),
    ]).find((c) => c.baseForm === "bank")!;
    const occurrence2 = {
      ...base.occurrences[0],
      segmentId: "other",
      startOffset: 10,
      endOffset: 14,
    };
    const merged = deduplicateByContextualSense([
      {
        ...base,
        senseKey: "financial-institution",
        contextualMeaning: "an institution that manages money",
      },
      {
        ...base,
        candidateId: "repeat",
        occurrences: [occurrence2],
        senseKey: "financial-institution",
        contextualMeaning: "an institution that manages money",
      },
      {
        ...base,
        candidateId: "river",
        senseKey: "river-edge",
        contextualMeaning: "land beside a river",
      },
    ]);
    expect(merged).toHaveLength(2);
    expect(
      merged.find((c) => c.senseKey === "financial-institution")?.occurrences,
    ).toHaveLength(2);
  });

  test("generation plans contain each candidate once and never exceed ten", () => {
    const candidates = Array.from({ length: 17 }, (_, i) => ({
      candidateId: `c${i}`,
    }));
    expect(buildGenerationPlan(candidates, 8).map((b) => b.length)).toEqual([
      8, 8, 1,
    ]);
    expect(() =>
      buildGenerationPlan([...candidates, { candidateId: "c1" }], 8),
    ).toThrow(/more than once/);
    expect(() => buildGenerationPlan(candidates, 11)).toThrow(
      /between 1 and 10/,
    );
  });
});
