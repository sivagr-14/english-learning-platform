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

  it.each(["A1", "A2"])("rejects generated %s meanings without changing document policy", cefr => {
    const { manifest } = cataloguePackFixture();
    manifest.candidates[0].cefrLevel = cefr;
    expect(validateContentManifest(manifest).valid).toBe(false);
  });

  it.each(["B1", "B2", "C1", "C2"])("accepts useful non-obvious %s without changing preparation", cefr => {
    const { manifest } = cataloguePackFixture();
    const before = JSON.stringify(manifest.catalogueAudit.preparation);
    manifest.candidates[0].cefrLevel = cefr;
    expect(validateContentManifest(manifest).issues).toEqual([]);
    expect(JSON.stringify(manifest.catalogueAudit.preparation)).toBe(before);
  });

  it.each(["basic_obvious", "predictable_combination", "rare_specialist"])("rejects generated %s even at C2", value => {
    const { manifest } = cataloguePackFixture();
    manifest.candidates[0].cefrLevel = "C2";
    manifest.candidates[0].catalogueEvidence.learningValue = value;
    expect(validateContentManifest(manifest).valid).toBe(false);
  });

  it("requires current policy and individual learning-value reasons", () => {
    const { manifest } = cataloguePackFixture();
    delete manifest.catalogueAudit.selectionPolicy;
    expect(validateContentManifest(manifest).valid).toBe(false);
    const other = cataloguePackFixture().manifest;
    delete other.candidates[0].catalogueEvidence.learningValueReason;
    expect(validateContentManifest(other).valid).toBe(false);
  });

  it("retains scoped basic records without pretending to expand them", () => {
    const { manifest } = cataloguePackFixture();
    const review = manifest.catalogueAudit.recordReviews[0];
    review.status = "scope_excluded";
    review.scopeExclusionCode = "basic_obvious";
    review.additionalMeaningsReviewed = false;
    for (const candidate of manifest.candidates) {
      candidate.decision = "filtered";
      candidate.reason = "Obvious basic meaning intentionally excluded by learner policy.";
      candidate.catalogueEvidence.learningValue = "basic_obvious";
    }
    manifest.counts.generate = 0;
    manifest.counts.filtered = 3;
    manifest.generationPlan.batches = [];
    expect(validateContentManifest(manifest).issues).toEqual([]);
    review.additionalMeaningsReviewed = true;
    expect(validateContentManifest(manifest).valid).toBe(false);
    review.additionalMeaningsReviewed = false;
    manifest.candidates[0].catalogueEvidence.learningValue = "non_obvious";
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

