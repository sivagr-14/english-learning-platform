import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { contentPackHash } from "../services/content-pack-contract";
import { parseSource, SourceType } from "../services/document-parser.service";
import { enumerateCandidates } from "../services/extraction-foundation.service";
import { buildSourceChunkPlan } from "../services/source-chunking.service";

const binaryTypes = new Set<SourceType>(["pdf", "docx", "epub"]);
const supportedTypes = new Set<SourceType>([
  "text",
  "md",
  "html",
  "vtt",
  "pdf",
  "srt",
  "docx",
  "epub",
]);
const extensionTypes: Record<string, SourceType> = {
  txt: "text",
  text: "text",
  md: "md",
  markdown: "md",
  htm: "html",
  html: "html",
  vtt: "vtt",
  pdf: "pdf",
  srt: "srt",
  docx: "docx",
  epub: "epub",
};

export function resolveSourceType(
  inputName: string,
  requestedType?: string,
): SourceType {
  const normalizedRequested = requestedType?.trim().toLowerCase();
  const inferred =
    extensionTypes[path.extname(inputName).slice(1).toLowerCase()];
  const resolved = (normalizedRequested || inferred || "text") as SourceType;
  if (!supportedTypes.has(resolved)) {
    throw new Error(
      `Unsupported source type "${resolved}". Supported types: text, txt, md, html, vtt, pdf, srt, docx and epub.`,
    );
  }
  return resolved;
}

export async function buildInventory(input: {
  bytes: Buffer;
  sourceName: string;
  sourceType: SourceType;
}) {
  const content = binaryTypes.has(input.sourceType)
    ? input.bytes.toString("base64")
    : input.bytes.toString("utf8");
  const segments = await parseSource(input.sourceType, content);

  const unreadable = segments.filter(
    (segment) => segment.status === "unreadable",
  );
  if (unreadable.length) {
    throw new Error(
      `Inventory blocked by unreadable source units: ${unreadable
        .map(
          (segment) => `${segment.locator.unit}:${segment.locator.unitIndex}`,
        )
        .join(", ")}`,
    );
  }

  const chunkPlan = buildSourceChunkPlan(segments);
  if (
    chunkPlan.reconciliation.untrackedReadableUnits !== 0 ||
    chunkPlan.reconciliation.untrackedReadableWords !== 0
  ) {
    throw new Error(
      "Source chunk planning did not reconcile every readable unit and word: " +
        `${chunkPlan.reconciliation.untrackedReadableUnits} untracked readable unit(s), ` +
        `${chunkPlan.reconciliation.untrackedReadableWords} untracked readable word(s).`,
    );
  }

  const candidates = enumerateCandidates(segments);
  const occurrences = candidates.flatMap((candidate) =>
    candidate.occurrences.map((occurrence, index) => ({
      occurrenceId: `${candidate.candidateId}:${String(index + 1).padStart(4, "0")}`,
      proposedCandidateId: candidate.candidateId,
      normalizedTerm: candidate.normalizedTerm,
      baseForm: candidate.baseForm,
      itemType: candidate.itemType,
      detectors: candidate.detection,
      ...occurrence,
    })),
  );
  const sourceHash = createHash("sha256").update(input.bytes).digest("hex");
  const inventory = {
    formatVersion: "chatgpt-deterministic-inventory-v1",
    generator: "backend-deterministic-inventory",
    generatorVersion: "1.0.0",
    source: {
      name: input.sourceName,
      type: input.sourceType,
      sourceHash,
      segmentCount: segments.length,
      processingChunkCount: chunkPlan.chunkCount,
      readableWordCount: chunkPlan.readableWordCount,
    },
    segments,
    sourceUnits: segments,
    processingChunks: chunkPlan.chunks,
    chunkReconciliation: chunkPlan.reconciliation,
    occurrences,
    counts: {
      segments: segments.length,
      processingChunks: chunkPlan.chunkCount,
      readableWords: chunkPlan.readableWordCount,
      proposedCandidates: candidates.length,
      occurrences: occurrences.length,
    },
  };
  return {
    ...inventory,
    inventoryHash: contentPackHash(inventory),
  };
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error(
      "Usage: yarn content-packs:inventory <source-file|-> [source-type] [source-name]",
    );
  }

  const fromStdin = inputPath === "-";
  const sourcePath = fromStdin ? undefined : path.resolve(inputPath);
  if (sourcePath && !fs.existsSync(sourcePath)) {
    throw new Error(`Source file does not exist: ${sourcePath}`);
  }

  const sourceName =
    process.argv[4] ||
    (sourcePath ? path.basename(sourcePath) : "pasted-text.txt");
  const sourceType = resolveSourceType(sourceName, process.argv[3]);
  const bytes = fs.readFileSync(sourcePath || 0);
  if (!bytes.length) throw new Error("Source is empty.");

  const inventory = await buildInventory({ bytes, sourceName, sourceType });
  process.stdout.write(`${JSON.stringify(inventory, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
