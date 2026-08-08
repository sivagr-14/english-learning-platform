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
import { parseSource } from "./document-parser.service";

describe("source-located parsers", () => {
  test("HTML preserves paragraph order and offsets", async () => {
    const segments = await parseSource(
      "html",
      "<h1>Title</h1><p>First paragraph.</p><p>Second paragraph.</p>",
    );
    expect(segments.map((s) => s.normalizedText)).toEqual([
      "Title\nFirst paragraph.\nSecond paragraph.",
    ]);
    expect(segments[0].locator.startOffset).toBe(0);
  });
  test("VTT preserves cue numbers, times and empty/unreadable units", async () => {
    const segments = await parseSource(
      "vtt",
      "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nLook into it.\n\ninvalid cue",
    );
    expect(segments[0]).toMatchObject({
      status: "readable",
      locator: { cue: 1, startTime: "00:00:01.000" },
    });
    expect(segments[1]).toMatchObject({
      status: "unreadable",
      error: expect.stringContaining("missing timing"),
    });
  });
  test("text records empty units explicitly", async () => {
    const segments = await parseSource("text", "one\n\n\n\ntwo");
    expect(segments.map((s) => s.status)).toEqual([
      "readable",
      "empty",
      "readable",
    ]);
  });
});
