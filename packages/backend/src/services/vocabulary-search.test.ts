import { escapeSearchPattern, wordSearchPatterns } from "./vocabulary-search";

it("treats percent, underscore and backslash as literal search text", () => {
  expect(escapeSearchPattern("50%_\\")).toBe("50\\%\\_\\\\");
});
it("supports expression fragments without requiring their original order", () => {
  expect(wordSearchPatterns("road bump road", "tokens")).toEqual([
    "%road%",
    "%bump%",
  ]);
});
it.each([
  ["prefix", "trade%"],
  ["suffix", "%trade"],
  ["contains", "%trade%"],
  ["exact", "trade"],
] as const)("constructs a literal %s match", (mode, expected) => {
  expect(wordSearchPatterns("trade", mode)).toEqual([expected]);
});
