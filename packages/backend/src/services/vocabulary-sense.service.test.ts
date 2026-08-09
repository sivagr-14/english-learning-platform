import {
  displayVocabularyLabel,
  parseVocabularyDisplayLabel,
  normalizeSenseKey,
  normalizeVocabularyTerm,
  resolveContextualSense,
  senseRankToLetters,
} from "./vocabulary-sense.service";

const financialBank = {
  id: "11111111-1111-4111-8111-111111111111",
  word: "bank",
  normalized_term: "bank",
  sense_rank: 1,
  sense_key: "financial-institution",
  sense_gloss: "an institution that receives, keeps, and lends money",
};

describe("vocabulary sense identity", () => {
  it("normalizes real terms and stable sense keys without adding labels", () => {
    expect(normalizeVocabularyTerm("  River   Bank ")).toBe("river bank");
    expect(normalizeSenseKey("Land beside a river")).toBe(
      "land-beside-a-river",
    );
  });

  it("keeps sense A implicit and labels every later rank permanently", () => {
    expect(displayVocabularyLabel("bank", 1)).toBe("bank");
    expect(displayVocabularyLabel("bank", 2)).toBe("bank (B)");
    expect(displayVocabularyLabel("bank", 5)).toBe("bank (E)");
    expect(displayVocabularyLabel("bank", 26)).toBe("bank (Z)");
    expect(displayVocabularyLabel("bank", 27)).toBe("bank (AA)");
    expect(senseRankToLetters(52)).toBe("AZ");
    expect(parseVocabularyDisplayLabel("bank (B)")).toEqual({
      term: "bank",
      senseRank: 2,
    });
    expect(parseVocabularyDisplayLabel("bank")).toEqual({
      term: "bank",
      senseRank: null,
    });
  });

  it("reuses an existing entry when the stable sense key matches", () => {
    expect(
      resolveContextualSense(
        {
          term: "bank",
          contextualMeaning: "a business that keeps and lends money",
          senseKey: "financial institution",
          declaredDecision: "same_sense",
        },
        [financialBank],
      ),
    ).toMatchObject({
      decision: "same_sense",
      matchedSense: { id: financialBank.id },
    });
  });

  it.each([
    [
      "ambitious",
      "determined to achieve significant success or difficult goals",
      "having a strong desire and determination to succeed",
    ],
    [
      "bizarre",
      "extremely strange and difficult to explain",
      "very strange or unusual",
    ],
  ])(
    "reuses %s when the contextual meanings are equivalent paraphrases",
    (term, contextualMeaning, storedMeaning) => {
      expect(
        resolveContextualSense(
          {
            term,
            contextualMeaning,
            senseKey: `source-${term}-sense`,
            declaredDecision: "new_sense",
          },
          [
            {
              id: `${term}-word-id`,
              word: term,
              normalized_term: term,
              sense_rank: 1,
              sense_key: `stored-${term}-sense`,
              sense_gloss: storedMeaning,
            },
          ],
        ),
      ).toMatchObject({
        decision: "same_sense",
        matchedSense: { id: `${term}-word-id` },
      });
    },
  );

  it("creates a new sense for a clearly different contextual meaning", () => {
    expect(
      resolveContextualSense(
        {
          term: "bank",
          contextualMeaning: "the sloping land beside a river",
          senseKey: "river-side-land",
          declaredDecision: "new_sense",
        },
        [financialBank],
      ),
    ).toMatchObject({ decision: "new_sense", matchedSense: null });
  });

  it("keeps a declared new sense automatic despite moderate wording overlap", () => {
    expect(
      resolveContextualSense(
        {
          term: "bank",
          contextualMeaning: "a raised bank of money used as a reserve",
          senseKey: "reserve-or-stock",
          declaredDecision: "new_sense",
        },
        [financialBank],
      ),
    ).toMatchObject({ decision: "new_sense", matchedSense: null });
  });

  it("holds an unsupported same-sense claim instead of guessing", () => {
    expect(
      resolveContextualSense(
        {
          term: "bank",
          contextualMeaning: "the sloping land beside a river",
          senseKey: "river-side-land",
          declaredDecision: "same_sense",
        },
        [financialBank],
      ).decision,
    ).toBe("ambiguous");
  });
});
