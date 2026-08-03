import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import SrtParser from "srt-parser-2";
import EPub from "epub2";
import { logger } from "../utils/logger";

export type SourceType = "text" | "pdf" | "srt" | "docx" | "epub";

/**
 * All non-text formats arrive as base64 (see routes/generation.ts and the
 * frontend upload page) since JSON has no native binary type. This decodes
 * once at the top so each format-specific branch just deals with a Buffer.
 */
function decodeBase64(content: string): Buffer {
  return Buffer.from(content, "base64");
}

async function extractPdf(base64Content: string): Promise<string> {
  const buffer = decodeBase64(base64Content);
  const data = await pdfParse(buffer);
  if (!data.text || data.text.trim().length < 20) {
    // A near-empty extraction almost always means a scanned/image PDF
    // rather than a digital-text one. Rather than silently returning
    // near-nothing (which would make the assess stage waste a call on
    // garbage), fail loudly so the caller knows OCR is needed.
    throw new Error(
      "This PDF produced almost no extractable text -- it's likely a scanned " +
        "or image-based PDF, which needs OCR (not yet wired into this build; " +
        "see PHASE_3_CHANGES.md for the recommended next step: Tesseract.js).",
    );
  }
  return data.text;
}

async function extractDocx(base64Content: string): Promise<string> {
  const buffer = decodeBase64(base64Content);
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * Groups subtitle cues into pseudo-paragraphs by timing gap rather than
 * word count -- a >3s gap between cues usually marks a scene/beat change,
 * which is a more meaningful chunk boundary for dialogue than an arbitrary
 * word count would be.
 */
async function extractSrt(base64Content: string): Promise<string> {
  const buffer = decodeBase64(base64Content);
  const parser = new SrtParser();
  const cues = parser.fromSrt(buffer.toString("utf-8"));

  const paragraphs: string[] = [];
  let current: string[] = [];
  let lastEndMs = 0;

  for (const cue of cues) {
    const startMs = timeToMs(cue.startTime);
    const endMs = timeToMs(cue.endTime);
    const text = cue.text.replace(/<[^>]+>/g, "").trim(); // strip formatting tags
    if (!text) continue;

    if (current.length > 0 && startMs - lastEndMs > 3000) {
      paragraphs.push(current.join(" "));
      current = [];
    }
    current.push(text);
    lastEndMs = endMs;
  }
  if (current.length > 0) paragraphs.push(current.join(" "));

  return paragraphs.join("\n\n");
}

function timeToMs(timestamp: string): number {
  // Format: HH:MM:SS,mmm
  const match = timestamp.match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  if (!match) return 0;
  const [, h, m, s, ms] = match;
  return (
    Number(h) * 3_600_000 + Number(m) * 60_000 + Number(s) * 1000 + Number(ms)
  );
}

async function extractEpub(base64Content: string): Promise<string> {
  const buffer = decodeBase64(base64Content);
  // epub2 reads from a file path, not a buffer directly -- stage to a temp
  // file for the duration of the parse.
  const { writeFile, unlink } = await import("fs/promises");
  const { tmpdir } = await import("os");
  const path = await import("path");
  const tempPath = path.join(tmpdir(), `upload-${Date.now()}.epub`);
  await writeFile(tempPath, buffer);

  try {
    const epub = await EPub.createAsync(tempPath);
    const chapterTexts: string[] = [];
    for (const chapter of epub.flow) {
      if (!chapter.id) continue;
      try {
        const html = await epub.getChapterAsync(chapter.id);
        chapterTexts.push(stripHtml(html));
      } catch (error) {
        logger.warn(`Skipping unreadable EPUB chapter ${chapter.id}`, error);
      }
    }
    return chapterTexts.join("\n\n");
  } finally {
    await unlink(tempPath).catch(() => undefined);
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Single entry point used by the extract worker stage. `content` is raw
 * text for source_type "text", and base64 for every binary format.
 */
export async function extractText(
  sourceType: SourceType,
  content: string,
): Promise<string> {
  switch (sourceType) {
    case "text":
      return content;
    case "pdf":
      return extractPdf(content);
    case "docx":
      return extractDocx(content);
    case "srt":
      return extractSrt(content);
    case "epub":
      return extractEpub(content);
    default:
      throw new Error(`Unsupported source type: ${sourceType}`);
  }
}
