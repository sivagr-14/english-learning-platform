import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { contentPackHash } from "../services/content-pack-contract";
import { parseSource, SourceType } from "../services/document-parser.service";
import { enumerateCandidates } from "../services/extraction-foundation.service";

const sourcePath = path.resolve(process.argv[2] || "");
if (!process.argv[2] || !fs.existsSync(sourcePath)) {
  throw new Error("Usage: yarn content-packs:inventory <source-file> [source-type]");
}

const extension = path.extname(sourcePath).slice(1).toLowerCase();
const requestedType = (process.argv[3] || extension || "text") as SourceType;
const binaryTypes = new Set<SourceType>(["pdf", "docx", "epub"]);
const bytes = fs.readFileSync(sourcePath);
const content = binaryTypes.has(requestedType)
  ? bytes.toString("base64")
  : bytes.toString("utf8");

async function main() {
  const segments = await parseSource(requestedType, content);
  const unreadable = segments.filter((segment) => segment.status === "unreadable");
  if (unreadable.length) {
    throw new Error(
      `Inventory blocked by unreadable source units: ${unreadable
        .map((segment) => `${segment.locator.unit}:${segment.locator.unitIndex}`)
        .join(", ")}`,
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
  const sourceHash = createHash("sha256").update(bytes).digest("hex");
  const inventory = {
    formatVersion: "chatgpt-deterministic-inventory-v1",
    generator: "backend-deterministic-inventory",
    generatorVersion: "1.0.0",
    source: {
      name: path.basename(sourcePath),
      type: requestedType,
      sourceHash,
      segmentCount: segments.length,
    },
    segments,
    occurrences,
    counts: {
      segments: segments.length,
      proposedCandidates: candidates.length,
      occurrences: occurrences.length,
    },
  };
  process.stdout.write(`${JSON.stringify({
    ...inventory,
    inventoryHash: contentPackHash(inventory),
  }, null, 2)}\n`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
