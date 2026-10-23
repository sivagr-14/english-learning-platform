import { cataloguePackFixture } from "./catalogue-pack.fixture";
import { catalogueHash } from "./catalogue-contract";
import { contentPackHash, validateContentManifest, validateContentBatch } from "./content-pack-contract";

describe("catalogue packs", () => {
  it("accepts multiple separately assessed meanings from one original record", () => {
    const { manifest, batch } = cataloguePackFixture();
    expect(manifest.candidates).toHaveLength(3);
    expect(validateContentManifest(manifest).issues).toEqual([]);
    expect(validateContentBatch(batch, manifest).issues).toEqual([]);
  });

  it.each(["A1", "A2", "C2"])("rejects generated %s meanings without changing document policy", cefr => {
    const { manifest } = cataloguePackFixture();
    manifest.candidates[0].cefrLevel = cefr;
    expect(validateContentManifest(manifest).valid).toBe(false);
  });

  it.each(["missing-review", "duplicate-review", "changed-definition", "missing-reference", "changed-term", "missing-level", "missing-usage", "existing-without-id", "low-usage", "missing-group", "no-primary-decision", "ambiguous"])("rejects %s", mutation => {
    const { manifest } = cataloguePackFixture();
    const candidate = manifest.candidates[0];
    if (mutation === "missing-review") manifest.catalogueAudit.recordReviews = [];
    if (mutation === "duplicate-review") manifest.catalogueAudit.recordReviews.push(manifest.catalogueAudit.recordReviews[0]);
    if (mutation === "changed-definition") manifest.catalogueAudit.preparation.records[0].source.primaryMeaning = "A silently rewritten definition.";
    if (mutation === "missing-reference") manifest.candidates[1].catalogueEvidence.references = [];
    if (mutation === "changed-term") candidate.term = "charged";
    if (mutation === "missing-level") delete candidate.cefrLevel;
    if (mutation === "missing-usage") delete candidate.usageFrequency;
    if (mutation === "existing-without-id") { candidate.decision = "existing"; candidate.senseDecision = "same_sense"; candidate.reason = "An existing lesson is claimed without a verified ID."; }
    if (mutation === "low-usage") candidate.usageFrequency = "low";
    if (mutation === "missing-group") manifest.catalogueAudit.preparation.assessmentGroups = [];
    if (mutation === "no-primary-decision") candidate.catalogueEvidence.meaningOrigin = "additional_meaning";
    if (mutation === "ambiguous") candidate.senseDecision = "ambiguous";
    expect(validateContentManifest(manifest).valid).toBe(false);
  });

  it("retains a filtered primary meaning while generating other meanings", () => {
    const { manifest } = cataloguePackFixture();
    manifest.candidates[0].decision = "filtered";
    manifest.candidates[0].reason = "This supplied meaning is below the catalogue target level.";
    manifest.candidates[0].cefrLevel = "A2";
    manifest.counts.generate = 2;
    manifest.counts.filtered = 1;
    manifest.generationPlan.batches[0].candidateIds.shift();
    expect(validateContentManifest(manifest).issues).toEqual([]);
  });

  it("rejects missing or forged authored-example provenance", () => {
    const { manifest, batch } = cataloguePackFixture();
    delete batch.entries[0].lesson.meaning_in_context.example_origin;
    expect(validateContentBatch(batch, manifest).valid).toBe(false);
  });

  it("requires the authored sentence to actually demonstrate its term", () => {
    const { manifest, batch } = cataloguePackFixture();
    const unrelated = "There is a completely unrelated sentence here.";
    manifest.candidates[0].senseEvidence.sentence = unrelated;
    manifest.candidates[0].occurrences[0].sentence = unrelated;
    batch.entries[0].lesson.meaning_in_context.source_sentence = unrelated;
    batch.manifestHash = contentPackHash(manifest);
    expect(validateContentBatch(batch, manifest).valid).toBe(false);
  });

  it("prevents a catalogue batch from entering a document manifest", () => {
    const { manifest, batch } = cataloguePackFixture();
    manifest.formatVersion = "chatgpt-vocabulary-manifest-v3";
    batch.manifestHash = contentPackHash(manifest);
    expect(validateContentBatch(batch, manifest).valid).toBe(false);
  });

  it("detects untracked records even when the edited preparation is rehashed", () => {
    const { manifest } = cataloguePackFixture();
    const preparation = manifest.catalogueAudit.preparation;
    preparation.source.recordCount = 2;
    delete preparation.preparationHash;
    preparation.preparationHash = catalogueHash(preparation);
    expect(validateContentManifest(manifest).valid).toBe(false);
  });
});
