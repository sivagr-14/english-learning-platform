jest.mock("pdf-parse", () => ({
  __esModule: true,
  default: jest.fn(),
}));
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
import pdfParse from "pdf-parse";
import { parseSource } from "./document-parser.service";

const mockedPdfParse = pdfParse as jest.MockedFunction<typeof pdfParse>;

function mockPdfPages(pages: string[]) {
  mockedPdfParse.mockImplementationOnce(async (_buffer: Buffer, options: any) => {
    for (const text of pages) {
      await options.pagerender({
        getTextContent: async () => ({
          items: text ? text.split(" ").map((str) => ({ str })) : [],
        }),
      });
    }
    return {
      numpages: pages.length,
      text: pages.join("\n"),
    } as any;
  });
}

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
  test("mixed PDFs retain textless pages as empty units and continue", async () => {
    mockPdfPages([
      "Readable vocabulary appears on this page.",
      "",
      "Another readable page contains dependable context.",
    ]);
    const segments = await parseSource(
      "pdf",
      Buffer.from("mixed-pdf").toString("base64"),
    );
    expect(segments.map((segment) => segment.status)).toEqual([
      "readable",
      "empty",
      "readable",
    ]);
    expect(segments[1]).toMatchObject({
      locator: { unit: "page", unitIndex: 2, page: 2 },
      originalText: "",
    });
  });

  test("fully textless PDFs still require OCR instead of being silently skipped", async () => {
    mockPdfPages(["", ""]);
    const segments = await parseSource(
      "pdf",
      Buffer.from("scanned-pdf").toString("base64"),
    );
    expect(segments).toHaveLength(2);
    expect(segments.every((segment) => segment.status === "unreadable")).toBe(
      true,
    );
    expect(segments[0].error).toContain("OCR_REQUIRED");
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
