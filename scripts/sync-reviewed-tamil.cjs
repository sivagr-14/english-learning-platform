// One-time, field-scoped sync of the saved contextual Tamil review.
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");

function validatePack(pack) {
  if (pack.format !== "reviewed-tamil-patch-v1" ||
      pack.totalReviewed !== 1863 || pack.entries?.length !== 1841 ||
      pack.blocked?.length !== 22 ||
      !/^[a-f0-9]{40}$/.test(pack.sourceCommit || "")) {
    throw new Error("Invalid or incomplete saved Tamil review");
  }
  const ids = new Set();
  const ordinals = new Set();
  for (const row of [...pack.entries, ...pack.blocked]) {
    if (!/^[a-f0-9-]{36}$/.test(row.wordId || "") || ids.has(row.wordId) ||
        !Number.isInteger(row.ordinal) || row.ordinal < 1 || row.ordinal > 1863 ||
        ordinals.has(row.ordinal)) throw new Error("Duplicate or invalid review identity");
    ids.add(row.wordId);
    ordinals.add(row.ordinal);
  }
  for (const row of pack.entries) {
    if (typeof row.word !== "string" || !row.word ||
        !(row.senseKey === null || (typeof row.senseKey === "string" && row.senseKey)) ||
        !Number.isInteger(row.senseRank) || row.senseRank < 1 ||
        !Number.isInteger(row.expectedEntryVersion) || row.expectedEntryVersion < 1 ||
        typeof row.before !== "string" || typeof row.value !== "string" ||
        !row.value.trim() || !/[\u0B80-\u0BFF]/.test(row.value)) {
      throw new Error("Invalid Tamil translation or identity");
    }
  }
  return pack;
}

function classify(row, word) {
  if (!word) return "missing";
  if (word.word !== row.word || word.sense_key !== row.senseKey ||
      Number(word.sense_rank) !== row.senseRank) return "identity_conflict";
  if (word.tamil_meaning === row.value) return "already_correct";
  if (Number(word.entry_version) !== row.expectedEntryVersion ||
      word.tamil_meaning !== row.before) return "changed_since_review";
  return "update";
}

async function syncReviewedTamil(db, input, apply = false) {
  const pack = validatePack(input);
  return db.transaction(async (trx) => {
    const report = {
      reviewId: pack.reviewId, sourceCommit: pack.sourceCommit, applied: apply,
      accepted: pack.entries.length, unresolved: pack.blocked.length,
      updated: 0, wouldUpdate: 0, alreadyCorrect: 0, conflicts: [],
    };
    // Stable lock order prevents deadlocks between repeated invocations.
    for (const row of [...pack.entries].sort((a, b) => a.wordId.localeCompare(b.wordId))) {
      const word = await trx("vocabulary_words").where({ id: row.wordId }).forUpdate().first();
      const status = classify(row, word);
      if (status === "already_correct") { report.alreadyCorrect++; continue; }
      if (status !== "update") {
        report.conflicts.push({ wordId: row.wordId, ordinal: row.ordinal, reason: status });
        continue;
      }
      if (!apply) { report.wouldUpdate++; continue; }
      const version = Number(word.entry_version) + 1;
      const updated = await trx("vocabulary_words").where({
        id: row.wordId, entry_version: word.entry_version, tamil_meaning: row.before,
      }).update({ tamil_meaning: row.value, entry_version: version, updated_at: new Date() });
      if (updated !== 1) throw new Error("Tamil update lost its version guard");
      await trx("vocabulary_entry_versions").insert({
        word_id: row.wordId, changed_by_user_id: null, version_number: version,
        change_type: "update",
        change_reason: "Saved contextual Tamil review: " + pack.reviewId,
        snapshot: JSON.stringify({
          scope: "tamil_meaning_only", sourceCommit: pack.sourceCommit,
          before: word, after: { ...word, tamil_meaning: row.value, entry_version: version },
        }),
        created_at: new Date(),
      });
      const saved = await trx("vocabulary_words").where({ id: row.wordId }).first();
      if (saved.tamil_meaning !== row.value || Number(saved.entry_version) !== version) {
        throw new Error("Tamil read-back verification failed");
      }
      report.updated++;
    }
    return report;
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => !["--apply", "--dry-run"].includes(arg)) ||
      (args.includes("--apply") && args.includes("--dry-run"))) {
    throw new Error("Usage: node scripts/sync-reviewed-tamil.cjs [--dry-run | --apply]");
  }
  const root = path.resolve(__dirname, "..");
  const backendRequire = createRequire(path.join(root, "packages/backend/package.json"));
  const knex = backendRequire("knex");
  const config = require(path.join(root, "knexfile.js"));
  const environment = process.env.NODE_ENV || "development";
  if (!config[environment]) throw new Error("Unsupported database environment");
  const pack = JSON.parse(fs.readFileSync(path.join(root,
    "content-packs/tamil-updates/overview-review-1863-20261010.json"), "utf8"));
  validatePack(pack);
  const db = knex(config[environment]);
  try {
    const report = await syncReviewedTamil(db, pack, args.includes("--apply"));
    console.log(JSON.stringify(report, null, 2));
    if (report.conflicts.length) process.exitCode = 2;
  } finally { await db.destroy(); }
}

module.exports = { validatePack, classify, syncReviewedTamil };
if (require.main === module) main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
