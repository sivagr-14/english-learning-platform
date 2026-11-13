# WordUp catalogue preparation

## Production-first 500-record cycles (13 November 2026)

Follow `docs/OFFLINE_IMPORT_AND_EXECUTION_POLICY.md`, revision
`production-cycle-500-20261113-v3`, for catalogue execution. First generate,
validate and deliver lessons for already finalized eligible entries; do not
restart assessment or screen new records while that deliverable backlog remains.
Then process at most 500 original records per working cycle: screen -> finalize
eligible senses and explicit deferred accounting -> freeze a supported manifest
-> generate complete lessons -> validate/repair -> deliver and confirm Import ready.
Drain every planned batch in that cycle before screening the next 500 records.
Use balanced 50–100-lesson batches for plans above 100; smaller complete plans
use their actual size. Source-record counts are never lesson targets.
Preserve original 100-record assessment IDs, 1,000-record accounting groups,
frozen manifests and batch identities. The 500-record cycle is an operational
overlay, not permission to repartition existing contracts. Resolved subsets and
later supplements require tested versioned contract/validator/importer support;
finish any narrow missing support before affected generation, without weakening
quality or hiding deferred items. Resume the exact unfinished production step
before new screening. Local imports run independently when available. Report
lessons written, validated and confirmed Import ready first; screening alone is
not production completion. Preserve all eight sections, Tamil, source evidence,
usage-type examples, ownership, learner progress and the final deferred sweep.


This is the preparation stage of the catalogue lesson path. It is **not an
importable content pack**, does not generate lessons, and never writes to the
local app or PostgreSQL. Document import contracts remain unchanged.

The learner selected catalogue lessons with newly authored teaching examples.
Keep `catalogue_definition` evidence separate from `authored_for_learning`
examples. A catalogue definition is not an original usage sentence. Do not
send this preparation to the content inbox or relabel it as a v5 document
assessment request. The runtime catalogue manifest/batch path is documented in
`CHATGPT_CONTENT_PACK_WORKFLOW.md`; preparation itself remains non-importable.

## Prepare the closed export

Requires Python 3.10 or newer with standard-library SQLite; no packages, API
keys or network calls. Work outside the repository so private catalogue files
are not committed.

```sh
python3 scripts/prepare-wordup-catalogue.py prepare /private/wordup.sqlite /private/wordup-preparation.json
python3 scripts/prepare-wordup-catalogue.py validate /private/wordup.sqlite /private/wordup-preparation.json
python3 -m unittest discover -s scripts -p 'test_prepare_wordup_catalogue.py'
```

Use a closed export without a WAL sidecar. The tool opens SQLite read-only,
checks integrity, hashes the complete original file, preserves every row's
term, definition, raw identifier, ranks, forms and phonetics, and checks the
file hash again after reading. Retain the original file as the byte-exact
snapshot. The prepared JSON deliberately excludes `learnStateInt`: its source
semantics are unknown and it must not overwrite the app's learning history.

Preparation is deterministic. Writing identical content to the same path is
safe; changed content is refused. Validation recomputes from the original
snapshot rather than trusting an edited JSON file's own hash.

## Ordered execution groups

Run `python3 scripts/prepare-wordup-catalogue.py plan /private/wordup.sqlite /private/wordup-preparation.json` to validate the original preparation and print ordered groups of up to 1,000 records. The planner keeps every original assessment assignment intact. Use the preparation hash and ordered assignment IDs to locate a group in the private assessment ledger. Group membership alone provides no evidence of editorial completion or import.

For a saved assessment, add `--assessment /path/to/assessment.sqlite` to `plan`. The optional `pendingMeaningWork` field locates the first execution group missing a supplied-meaning review or containing a recorded meaning without a final decision. It reports these counts separately and gives the next ID for each. A null group means these two queues are empty. Additional-sense coverage, source issues, signed-in matching and import verification still require separate checks.

## Assessment contract

- Every row receives a source-bound `recordId` and evidence hash, including
  malformed or empty rows. No rank cutoff, CEFR estimate or frequency claim is
  applied during preparation.
- Groups contain at most 100 records. Above 100 records, groups are balanced
  between 50 and 100. Every record appears exactly once; there is no total cap.
- Word and expression source ranks are separate ordering signals, not measured
  frequency. The catalogue scope is B1–C1 and heavy/medium usage; it does not
  change the app's B1–C2 document policy.
- Repeated spellings and reused source sense IDs are review flags, not
  deduplication decisions. Assess contextual sense identity independently.
  Equal definitions across different words can be legitimate synonyms; a
  shared-definition flag is not proof of an error.
- Preparation contains no semantic decisions. Review every term–definition
  pair and keep reasons and level/usage evidence. Missing or mismatched
  meanings must not be silently replaced with guessed meanings.
- Final `existing` decisions require owner-scoped matches from the local app.
  Spelling matches alone are insufficient. No existing lessons are presumed
  reusable from this SQLite file.

## Remaining delivery gates

1. Finish semantic review of every record in the manifest scope and reconcile
   final decisions. The versioned `wordup-delivery-groups-v1` workflow permits
   exact 1,000-record windows while retaining the full unchanged preparation;
   legacy catalogue manifests still require global reconciliation.
2. Use the dedicated catalogue manifest/batch contracts, binding
   each candidate to its original record and definition. Persist and visibly
   label authored-example provenance on the lesson screen. Keep document
   source-evidence checks intact.
3. Validate complete eight-section lessons, Tamil, level, frequency, taxonomy,
   exact meaning identity and each immutable batch's membership.
4. Use backend transactions, permanent sense ranks, existing-progress
   preservation and PostgreSQL read-back verification for import.

The preparation output reports `importReady: false` until those later stages
exist and pass. Do not describe 42,200 prepared records as 42,200 assessed or
approved lessons.



