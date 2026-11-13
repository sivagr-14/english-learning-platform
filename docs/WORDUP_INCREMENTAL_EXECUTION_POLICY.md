# WordUp catalogue: incremental execution and eligibility contract

Status: **versioned implementation; deploy the validated runtime before using delivery groups**. The canonical workflow defines `wordup-delivery-groups-v1` and `catalogue-usage-types-v1`. Existing immutable manifests, receipts, learner progress and valid finalized decisions take precedence. Legacy catalogue manifests retain global reconciliation. Group-mode implementation and synthetic integration tests are not evidence that real WordUp lessons were generated, delivered or imported. Verify actual local PostgreSQL receipts separately.


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


## Goal and source accounting

Account for all 42,200 original WordUp records (34,004 words, 8,196 expressions), every source occurrence, eligible contextual sense and final disposition. Recover the latest durable checkpoint, not a stale reported count. A prior recovery baseline was checkpoint 77: 3,503 screened, 1,069 finalized meaning decisions, 637 provisional, 104 source holds, zero completed groups and zero imported lessons. Never reset, duplicate or overwrite existing progress. Do not equate scope screening with final semantic assessment.

## Eligibility

Prioritize high/medium real-world usage B2–C1 meanings, and useful C2 meanings. Exclude obvious, predictable, already-known B1 vocabulary and basic combinations, while retaining valuable B1 phrasal verbs, idioms, collocations and non-obvious contextual meanings. Evaluate at the meaning level; neither rank nor spelling alone determines CEFR or eligibility. Exclude archaic, obsolete, exceptionally rare or unjustifiably specialist meanings. Source records outside eligibility remain accounted for, with evidence and reason. Examples illustrating the standard (not automatic inclusion): reluctant, deteriorate, feasible, discrepancy, constraint, trade-off, undermine, compelling, aftermath, nevertheless; carry out, draw up, rule out, fed up, raise concerns, reach a compromise, bring up, given that, having said that. Preserve source provenance, owner-scoped app matches, Tamil contextual translation and taxonomy.

## Usage-type examples — mandatory

For each eligible meaning, identify supported usage types: literal, abstract, figurative. Supply **one natural example for each genuinely supported distinct usage type**, capped at **three examples per meaning**; two when only two types apply, one when only one applies. Label each example with its type. Never manufacture a type, force a figurative interpretation, or repeat the same usage type to fill a quota. Examples must illustrate the same assessed contextual sense; if the types require different senses, represent them as distinct senses rather than conflating them. E.g., *grasp the handle* (literal) and *grasp the concept* (abstract) may be separate senses; *grasp at an opportunity* is a different construction and must not be mislabeled as the same meaning. Enforce the rule through generation instructions, schema/validator and tests without deleting required examples in other lesson sections unless the canonical schema is explicitly revised.

## Versioned incremental pipeline

Process ordered groups of up to 1,000 original records, reusing original 100-record assessment IDs. Per group: (1) reconcile previous decisions and receipts; (2) screen unresolved records with up to three real parallel workers, at most 100 originals per assignment; (3) finalize source-backed contextual senses, CEFR, usage, taxonomy, deduplication and holds; (4) freeze a **new** immutable group manifest only when its complete group reconciliation and cross-group identity safeguards pass; (5) generate all planned eight-section simplified-v2 lessons in immutable batches of at most 100, typically 50–100; (6) production-validate, retry recoverable failures, deliver to chatgpt-content-inbox via the connected GitHub App, verify byte-for-byte; (7) confirm every planned batch is Import ready and advance online automatically, even while the laptop is offline; (8) independently let the authenticated local backend import queued groups in order, verify PostgreSQL read-back and reconcile local completion. Global deduplication and immutable source evidence remain mandatory. Do not rewrite an existing manifest or valid batch. For legacy manifests retain these delivery gates. For current work use the production-first 500-record working cycles above, with supported subsets only; do not reinterpret this legacy contract as subset support.

## Execution and authority

No routine human confirmations between internal batches, groups, waves or recoverable retries. Persist durable checkpoints, ownership locks and resumable first-missing-work pointers; coordinate with the existing hourly continuation automation instead of creating competing queues. Only the connected GitHub App may perform remote GitHub operations; no PAT, SSH or gh login fallback. Code changes go through feature branch/PR, and **must not be merged to main without user authorization**. Only the local backend may use private assessment databases and PostgreSQL; never commit secrets or private SQLite files. A ChatGPT session cannot guarantee indefinite execution or direct local import without access. Report access/integrity blockers precisely and do not claim imported lessons based only on GitHub delivery.

## Acceptance and reporting

Implement and test incremental manifest/group semantics, safe global deduplication, concurrency/recovery, schema and validator example-type constraints, full eight-section lesson generation, remote receipts and backend import reconciliation. Use the versioned exception in AGENTS.md and the canonical workflow only on a runtime that passes the contract and PostgreSQL integration tests. Preserve the legacy all-catalogue freeze rule for manifests without the new policy. The existing continuation prompt must read these current instructions; never create a second schedule or queue. Each run must report screened/42,200, finalized/provisional/held, eligible senses, generated/validated/delivered/imported lessons, completed groups, missing/conflicts and next automatic action. Final success requires all 42,200 accounted for, all eligible meanings generated, all batches validated and remotely verified, all lessons PostgreSQL-readback verified, zero missing batches and zero unresolved recoverable errors.



