import {
  buildNavigation,
  cefrRange,
  normalizeCefrLevel,
} from "./vocabulary-browse.service";

describe("vocabulary browse helpers", () => {
  test("normalizes only supported CEFR levels", () => {
    expect(normalizeCefrLevel(" b2 ")).toBe("B2");
    expect(normalizeCefrLevel("C2")).toBe("C2");
    expect(normalizeCefrLevel("advanced")).toBeNull();
  });

  test("builds a learner-facing CEFR range from actual words", () => {
    expect(cefrRange(["C1", "b2", "B2", "unknown"])).toBe("B2\u2013C1");
    expect(cefrRange(["A2", "A2"])).toBe("A2");
    expect(cefrRange([])).toBeNull();
  });

  test("builds previous and next navigation with boundaries", () => {
    const rows = [{ id: "one" }, { id: "two" }, { id: "three" }];
    expect(buildNavigation(rows, "two")).toEqual({
      previous_id: "one",
      next_id: "three",
      position: 2,
      total: 3,
    });
    expect(buildNavigation(rows, "one")?.previous_id).toBeNull();
    expect(buildNavigation(rows, "three")?.next_id).toBeNull();
    expect(buildNavigation(rows, "missing")).toBeNull();
  });
});
