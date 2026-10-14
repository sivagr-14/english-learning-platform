const test = require("node:test");
const assert = require("node:assert/strict");
const { validatePack, classify, syncReviewedTamil } = require("./sync-reviewed-tamil.cjs");
const pack = require("../content-packs/tamil-updates/overview-review-1863-20261010.json");
const row = pack.entries.find((r) => r.before !== r.value);
const wordFor = (r) => ({
  id: r.wordId, word: r.word, sense_key: r.senseKey, sense_rank: r.senseRank,
  entry_version: r.expectedEntryVersion, tamil_meaning: r.before,
  pronunciation: "preserved", category_id: "preserved", owner_user_id: "preserved",
});

test("saved review accounts for all entries and 1019 actual corrections", () => {
  validatePack(pack);
  assert.equal(pack.entries.filter((r) => r.before !== r.value).length, 1019);
  const broken = structuredClone(pack);
  broken.entries[1].wordId = broken.entries[0].wordId;
  assert.throws(() => validatePack(broken));
});
test("guards identity and version, and allows idempotent repeats", () => {
  const word = wordFor(row);
  assert.equal(classify(row, word), "update");
  assert.equal(classify(row, null), "missing");
  assert.equal(classify(row, { ...word, sense_key: "another-sense" }), "identity_conflict");
  assert.equal(classify(row, { ...word, entry_version: 99 }), "changed_since_review");
  assert.equal(classify(row, { ...word, tamil_meaning: "new edit" }), "changed_since_review");
  assert.equal(classify(row, { ...word, tamil_meaning: row.value, entry_version: 99 }), "already_correct");
});

function fakeDatabase(failAudit = false) {
  const words = new Map(pack.entries.map((r) => [r.wordId, wordFor(r)]));
  const audits = [];
  return { words, audits, async transaction(run) {
    const before = structuredClone(words);
    const oldAudits = audits.length;
    const trx = (table) => {
      assert.ok(["vocabulary_words", "vocabulary_entry_versions"].includes(table));
      let where;
      const q = {
        where(value) { where = value; return q; },
        forUpdate() { return q; },
        async first() { return structuredClone(words.get(where.id)); },
        async update(value) {
          assert.deepEqual(Object.keys(value).sort(), ["entry_version", "tamil_meaning", "updated_at"]);
          const word = words.get(where.id);
          if (!Object.entries(where).every(([k, v]) => word[k] === v)) return 0;
          Object.assign(word, value); return 1;
        },
        async insert(value) {
          assert.equal(table, "vocabulary_entry_versions");
          if (failAudit) throw new Error("audit failure");
          audits.push(value);
        },
      };
      return q;
    };
    try { return await run(trx); } catch (error) {
      words.clear(); for (const [id, value] of before) words.set(id, value);
      audits.length = oldAudits; throw error;
    }
  }};
}
test("dry run writes nothing; apply changes only Tamil and audit metadata; repeat is a no-op", async () => {
  const db = fakeDatabase();
  const dry = await syncReviewedTamil(db, pack);
  assert.equal(dry.wouldUpdate, 1019);
  assert.equal(dry.alreadyCorrect, 822);
  assert.equal(db.audits.length, 0);
  const applied = await syncReviewedTamil(db, pack, true);
  assert.equal(applied.updated, 1019);
  assert.equal(db.audits.length, 1019);
  for (const word of db.words.values()) {
    assert.equal(word.pronunciation, "preserved");
    assert.equal(word.category_id, "preserved");
    assert.equal(word.owner_user_id, "preserved");
  }
  const repeated = await syncReviewedTamil(db, pack, true);
  assert.equal(repeated.updated, 0);
  assert.equal(repeated.alreadyCorrect, 1841);
});
test("conflicts are skipped, not overwritten", async () => {
  const db = fakeDatabase();
  db.words.get(row.wordId).entry_version = 99;
  const report = await syncReviewedTamil(db, pack, true);
  assert.equal(report.conflicts.length, 1);
  assert.equal(db.words.get(row.wordId).tamil_meaning, row.before);
  assert.equal(report.updated, 1018);
});
test("audit failure rolls back the transaction", async () => {
  const db = fakeDatabase(true);
  await assert.rejects(syncReviewedTamil(db, pack, true), /audit failure/);
  for (const r of pack.entries) assert.equal(db.words.get(r.wordId).tamil_meaning, r.before);
});
