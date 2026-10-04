import { createHash } from "crypto";
import {
  contentPackHash,
  validateContentManifest,
} from "./content-pack-contract";

export const COLLECTION_POLICY = {
  version: "fluency-collection-2026.1",
  targetSenses: 40000,
  visiblePackTarget: 400,
  focus: "everyday and professional communication, not a technical glossary",
  selection: [
    "high-or-medium sense frequency",
    "practical communication value",
    "natural established expression",
    "clear contextual evidence",
    "distinct sense",
    "catalogue-valid category",
  ],
  exclusions: [
    "rare or obsolete senses",
    "noise",
    "proper names",
    "arbitrary word windows",
    "expert-only terminology",
    "same-sense duplicates",
    "unsupported frequency claims",
  ],
  quality: [
    "complete eight-section lesson",
    "natural short conversation",
    "reusable pattern",
    "specific contrast",
    "recall and production",
    "separate language and teaching review",
  ],
} as const;

/** Targets guide planning only; they never pad or limit accepted vocabulary. */
export function collectionPolicy(targetSenses: number) {
  if (
    !Number.isSafeInteger(targetSenses) ||
    targetSenses < 400 ||
    targetSenses > 200000
  )
    throw new Error(
      "Collection target must be a whole number between 400 and 200,000",
    );
  return {
    ...COLLECTION_POLICY,
    version: "fluency-collection-2026.2",
    targetSenses,
  };
}

/** Presentation grouping only. Original manifests, batch identities, evidence,
 * candidate membership and database transactions are never rewritten. */
export function createCollectionPlan(
  collectionId: string,
  manifests: unknown[],
  targetSenses?: number,
) {
  if (!/^[a-z0-9][a-z0-9._-]{2,119}$/.test(collectionId))
    throw new Error("Invalid collection ID");
  if (!manifests.length)
    throw new Error(
      "Supply at least one accepted manifest; targets are not candidate inventories",
    );
  const units: any[] = [];
  const manifestIds = new Set<string>();
  const senseIds = new Set<string>();
  for (const raw of manifests) {
    const validation = validateContentManifest(raw);
    if (!validation.valid || !validation.value)
      throw new Error(validation.issues.join("\n"));
    const manifest = validation.value;
    if (manifestIds.has(manifest.manifestId))
      throw new Error("Duplicate manifest identity");
    manifestIds.add(manifest.manifestId);
    for (const c of manifest.candidates.filter(
      (c) => c.decision === "generate",
    )) {
      if (!("senseKey" in c) || !c.senseKey)
        throw new Error(
          "A collection requires explicit contextual sense identity",
        );
      const key = `${c.term.toLowerCase().replace(/\s+/g, " ").trim()}::${c.senseKey}`;
      if (senseIds.has(key))
        throw new Error(`Duplicate contextual sense across collection: ${key}`);
      senseIds.add(key);
    }
    for (const batch of manifest.generationPlan.batches)
      units.push({
        manifestId: manifest.manifestId,
        manifestHash: contentPackHash(manifest),
        batchNumber: batch.batchNumber,
        candidateIds: [...batch.candidateIds],
      });
  }
  const packs: any[] = [];
  let members: any[] = [];
  let count = 0;
  const flush = () => {
    if (!members.length) return;
    packs.push({
      packId: `${collectionId}-pack-${String(packs.length + 1).padStart(3, "0")}`,
      entryCount: count,
      units: members,
    });
    members = [];
    count = 0;
  };
  for (const unit of units) {
    if (count + unit.candidateIds.length > COLLECTION_POLICY.visiblePackTarget)
      flush();
    members.push(unit);
    count += unit.candidateIds.length;
  }
  flush();
  const payload = {
    formatVersion: "chatgpt-fluency-collection-v1",
    collectionId,
    policy:
      targetSenses === undefined
        ? COLLECTION_POLICY
        : collectionPolicy(targetSenses),
    entryCount: senseIds.size,
    packs,
  };
  const hash = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
  return { ...payload, hash };
}

export function packDeliveryState(
  pack: {
    units: {
      manifestId: string;
      manifestHash: string;
      batchNumber: number;
      candidateIds: string[];
    }[];
  },
  receipts: {
    manifestId: string;
    manifestHash: string;
    batchNumber: number;
    databaseVerified: boolean;
    languageReviewed: boolean;
    selectionReviewed: boolean;
    committedCount: number;
  }[],
) {
  const missing = pack.units.filter(
    (unit) =>
      !receipts.some(
        (r) =>
          r.manifestId === unit.manifestId &&
          r.manifestHash === unit.manifestHash &&
          r.batchNumber === unit.batchNumber &&
          r.databaseVerified &&
          r.languageReviewed &&
          r.selectionReviewed &&
          r.committedCount === unit.candidateIds.length,
      ),
  );
  return {
    complete: missing.length === 0,
    missingUnits: missing.map(({ candidateIds: _ids, ...id }) => id),
  };
}
