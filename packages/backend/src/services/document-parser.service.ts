import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import SrtParser from "srt-parser-2";
import EPub from "epub2";
import {
  makeSegment,
  SourceLocator,
  SourceSegment,
} from "./extraction-foundation.service";

export type SourceType =
  "text" | "md" | "html" | "vtt" | "pdf" | "srt" | "docx" | "epub";
const decode = (content: string) => Buffer.from(content, "base64");

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>|<\/(p|div|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
function unitSegments(
  units: Array<{
    text: string;
    locator: Partial<SourceLocator>;
    error?: string;
  }>,
): SourceSegment[] {
  let offset = 0;
  return units.map((unit, index) => {
    const text = unit.text ?? "";
    const locator = {
      unit: "paragraph",
      unitIndex: index + 1,
      startOffset: offset,
      endOffset: offset + text.length,
      ...unit.locator,
    } as SourceLocator;
    offset += text.length + 2;
    return makeSegment({
      sequence: index + 1,
      originalText: text,
      locator,
      status: unit.error ? "unreadable" : "readable",
      error: unit.error,
    });
  });
}
function paragraphs(text: string, unit: SourceLocator["unit"] = "paragraph") {
  const parts = text.replace(/\r\n?/g, "\n").split("\n\n");
  return unitSegments(
    parts.map((value, index) => ({
      text: value,
      locator: { unit, unitIndex: index + 1, paragraph: index + 1 },
    })),
  );
}

async function parsePdf(content: string): Promise<SourceSegment[]> {
  const pages: string[] = [];
  const data = await pdfParse(decode(content), {
    pagerender: async (page: any) => {
      const tc = await page.getTextContent();
      const text = tc.items.map((i: any) => i.str).join(" ");
      pages.push(text);
      return text;
    },
  });
  const declared = Number(data.numpages || pages.length);
  if (!pages.length && data.text) pages.push(data.text);
  if (!pages.some((p) => p.trim().length >= 20))
    return unitSegments(
      Array.from({ length: Math.max(1, declared) }, (_, i) => ({
        text: pages[i] || "",
        locator: { unit: "page", unitIndex: i + 1, page: i + 1 },
        error:
          "SCANNED_PDF_OCR_REQUIRED: page has no reliable extractable text",
      })),
    );
  return unitSegments(
    Array.from({ length: declared }, (_, i) => ({
      text: pages[i] || "",
      locator: { unit: "page", unitIndex: i + 1, page: i + 1 },
      ...(pages[i]?.trim()
        ? {}
        : { error: "PDF_PAGE_UNREADABLE: no text extracted" }),
    })),
  );
}
async function parseDocx(content: string) {
  const result = await mammoth.extractRawText({ buffer: decode(content) });
  return paragraphs(result.value);
}
function timeToMs(timestamp: string) {
  const m = timestamp.match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  return m
    ? Number(m[1]) * 3600000 +
        Number(m[2]) * 60000 +
        Number(m[3]) * 1000 +
        Number(m[4].padEnd(3, "0").slice(0, 3))
    : 0;
}
function parseSrt(content: string) {
  const cues = new SrtParser().fromSrt(decode(content).toString("utf8"));
  return unitSegments(
    cues.map((cue: any, index: number) => ({
      text: stripHtml(cue.text).trim(),
      locator: {
        unit: "cue",
        unitIndex: index + 1,
        cue: index + 1,
        startTime: cue.startTime,
        endTime: cue.endTime,
        startOffset: timeToMs(cue.startTime),
        endOffset: timeToMs(cue.endTime),
      },
    })),
  );
}
function parseVtt(content: string) {
  const lines = content.replace(/^WEBVTT[^\n]*\n/i, "").split(/\n\s*\n/);
  return unitSegments(
    lines.map((block, index) => {
      const values = block.trim().split("\n");
      const timingIndex = values.findIndex((v) => v.includes("-->"));
      if (timingIndex < 0)
        return {
          text: "",
          locator: {
            unit: "cue" as const,
            unitIndex: index + 1,
            cue: index + 1,
          },
          error: "VTT_CUE_UNREADABLE: missing timing line",
        };
      const [startTime, endTime] = values[timingIndex]
        .split("-->")
        .map((v) => v.trim().split(/\s+/)[0]);
      return {
        text: stripHtml(values.slice(timingIndex + 1).join(" ")),
        locator: {
          unit: "cue" as const,
          unitIndex: index + 1,
          cue: index + 1,
          startTime,
          endTime,
          startOffset: timeToMs(startTime),
          endOffset: timeToMs(endTime),
        },
      };
    }),
  );
}
async function parseEpub(content: string) {
  const { writeFile, unlink } = await import("fs/promises");
  const path = await import("path");
  const { tmpdir } = await import("os");
  const temp = path.join(tmpdir(), `elp-${process.pid}-${Date.now()}.epub`);
  await writeFile(temp, decode(content));
  try {
    const epub = await EPub.createAsync(temp);
    const units = [];
    for (let i = 0; i < epub.flow.length; i++) {
      const chapter = epub.flow[i];
      try {
        units.push({
          text: stripHtml(await epub.getChapterAsync(chapter.id)),
          locator: {
            unit: "chapter" as const,
            unitIndex: i + 1,
            chapter: chapter.id,
          },
        });
      } catch (error) {
        units.push({
          text: "",
          locator: {
            unit: "chapter" as const,
            unitIndex: i + 1,
            chapter: chapter.id,
          },
          error: `EPUB_CHAPTER_UNREADABLE: ${(error as Error).message}`,
        });
      }
    }
    return unitSegments(units);
  } finally {
    await unlink(temp).catch(() => undefined);
  }
}

export async function parseSource(
  sourceType: SourceType,
  content: string,
): Promise<SourceSegment[]> {
  switch (sourceType) {
    case "text":
    case "md":
      return paragraphs(content);
    case "html":
      return paragraphs(stripHtml(content));
    case "pdf":
      return parsePdf(content);
    case "docx":
      return parseDocx(content);
    case "srt":
      return parseSrt(content);
    case "vtt":
      return parseVtt(content);
    case "epub":
      return parseEpub(content);
    default:
      throw new Error(`Unsupported source type: ${sourceType}`);
  }
}
export async function extractText(
  sourceType: SourceType,
  content: string,
): Promise<string> {
  const segments = await parseSource(sourceType, content);
  const blocked = segments.filter((s) => s.status === "unreadable");
  if (blocked.length)
    throw new Error(
      `Source requires attention: ${blocked.map((s) => `${s.locator.unit} ${s.locator.unitIndex}: ${s.error}`).join("; ")}`,
    );
  return segments.map((s) => s.originalText).join("\n\n");
}
