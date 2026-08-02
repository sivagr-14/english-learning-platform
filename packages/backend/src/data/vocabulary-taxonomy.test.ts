import {
  DEFAULT_TAXONOMY_CATEGORY_KEY,
  isValidTaxonomyPath,
  legacyTaxonomyPath,
  TAXONOMY_DOMAINS,
  TAXONOMY_SPECIFIC_CATEGORIES,
  TAXONOMY_USAGE_GROUPS,
  TAXONOMY_VERSION,
  taxonomyPathForCategoryKey,
} from "./vocabulary-taxonomy";

describe("three-level vocabulary taxonomy", () => {
  it("contains the required controlled 15/60/300 hierarchy", () => {
    expect(TAXONOMY_DOMAINS).toHaveLength(15);
    expect(TAXONOMY_USAGE_GROUPS).toHaveLength(60);
    expect(TAXONOMY_SPECIFIC_CATEGORIES).toHaveLength(300);
    expect(
      new Set(TAXONOMY_SPECIFIC_CATEGORIES.map((item) => item.key)).size,
    ).toBe(300);
  });

  it("resolves a specific category to exactly one complete path", () => {
    const path = taxonomyPathForCategoryKey(
      "travel.airports_and_flights.check_in_and_baggage",
    );
    expect(path).toEqual({
      taxonomyVersion: TAXONOMY_VERSION,
      domainKey: "travel",
      domainName: "Travel",
      usageGroupKey: "travel.airports_and_flights",
      usageGroupName: "Airports & Flights",
      categoryKey: "travel.airports_and_flights.check_in_and_baggage",
      categoryName: "Check-in and baggage",
    });
    expect(isValidTaxonomyPath(path!)).toBe(true);
    expect(isValidTaxonomyPath({ ...path!, domainKey: "work" })).toBe(false);
  });

  it("maps every legacy broad category and has a valid safe default", () => {
    for (const name of [
      "Daily Life",
      "Travel & Transport",
      "Work & Business",
      "Health & Body",
      "Academic English",
      "Specialized Fluency",
    ]) {
      expect(isValidTaxonomyPath(legacyTaxonomyPath(name))).toBe(true);
    }
    expect(legacyTaxonomyPath("Unknown").categoryKey).toBe(
      DEFAULT_TAXONOMY_CATEGORY_KEY,
    );
  });
});
