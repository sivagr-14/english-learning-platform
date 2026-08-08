import { TAXONOMY_VERSION } from "../data/vocabulary-taxonomy";
import { TaxonomyAssignmentSchema } from "./content-pack-contract";

describe("EXT-07 constrained taxonomy review contract", () => {
  const valid = {
    taxonomyVersion: TAXONOMY_VERSION,
    domainKey: "everyday_life",
    usageGroupKey: "everyday_life.practical_actions",
    categoryKey: "everyday_life.practical_actions.starting_and_finishing",
    confidence: "high" as const,
  };

  it("accepts only an approved complete hierarchy", () => {
    expect(TaxonomyAssignmentSchema.parse(valid)).toEqual(valid);
    expect(() =>
      TaxonomyAssignmentSchema.parse({ ...valid, domainKey: "invented" }),
    ).toThrow();
    expect(() =>
      TaxonomyAssignmentSchema.parse({
        ...valid,
        categoryKey: "invented.path",
      }),
    ).toThrow();
  });

  it("requires a reason for the low-confidence review path", () => {
    expect(() =>
      TaxonomyAssignmentSchema.parse({ ...valid, confidence: "low" }),
    ).toThrow();
    expect(
      TaxonomyAssignmentSchema.parse({
        ...valid,
        confidence: "low",
        reason: "The context supports two nearby practical categories.",
      }),
    ).toBeTruthy();
  });
});
