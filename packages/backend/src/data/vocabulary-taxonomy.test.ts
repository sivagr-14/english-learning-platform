import {
  DEFAULT_TAXONOMY_CATEGORY_KEY,
  LEGACY_TAXONOMY_VERSION,
  isValidTaxonomyPath,
  legacyTaxonomyPath,
  TAXONOMY_DOMAINS,
  TAXONOMY_SPECIFIC_CATEGORIES,
  TAXONOMY_USAGE_GROUPS,
  TAXONOMY_VERSION,
  taxonomyPathForCategoryKey,
} from "./vocabulary-taxonomy";

describe("three-level vocabulary taxonomy", () => {
  it("contains the controlled 22/88/440 hierarchy", () => {
    expect(TAXONOMY_DOMAINS).toHaveLength(22);
    expect(TAXONOMY_USAGE_GROUPS).toHaveLength(88);
    expect(TAXONOMY_SPECIFIC_CATEGORIES).toHaveLength(440);
    expect(
      new Set(TAXONOMY_SPECIFIC_CATEGORIES.map((item) => item.key)).size,
    ).toBe(440);
  });

  it("keeps 2026.1 paths valid without exposing 2026.2 additions", () => {
    const oldPath = taxonomyPathForCategoryKey(
      "travel.airports_and_flights.check_in_and_baggage",
      LEGACY_TAXONOMY_VERSION,
    );
    expect(isValidTaxonomyPath(oldPath!)).toBe(true);
    expect(
      taxonomyPathForCategoryKey(
        "science_engineering.scientific_method.hypotheses_experiments",
        LEGACY_TAXONOMY_VERSION,
      ),
    ).toBeNull();
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
