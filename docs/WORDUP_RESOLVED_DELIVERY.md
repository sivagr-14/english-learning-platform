# Versioned resolved catalogue delivery

Contract: `catalogueAudit.resolvedDelivery.policyId = wordup-resolved-delivery-v1`.
This contract implements production-cycle-500-20261113-v3 without changing legacy manifests.
Use it only after the PR's contract and PostgreSQL integration checks pass.

## Scope and evidence

`cycleNumber` selects the next five original 100-record assessment groups (final remainder allowed). Preserve the full preparation. The parent `groupNumber` remains `ceil(cycleNumber / 2)` and deliveryGroup.assessmentGroupIds is exactly the selected original group list. Do not repartition source records. Legacy manifests without resolvedDelivery still select ten groups and retain exhaustive rules.

Embed a strict `wordup-parent-ledger-v1` snapshot and its canonical SHA-256 in `selection.parentHash`. Account for every original record in the cycle, every candidate and every recall unit with reciprocal links. Empty/noise records require explicit permitted rejection reasons. Included candidates require completed source recall. Deferred candidates require a substantive attempt, targeted retry, evidence hashes, timestamps, reason and next action; they are not exclusions or completed lessons.

Each parent candidate retains term, senseKey, contextualMeaning and meaningOrigin, including the exact supplied definition. Each non-rejected record requires independent single_word and expression recall units.

Parent candidate `evidenceHash` is the canonical hash of the complete manifest candidate. `senseIdentity` is normalized term + `|` + normalized senseKey (NFKC, lowercase, trimmed/collapsed whitespace). Delivered candidate source record IDs and disposition must match the parent. Resolved decisions are generate/existing; excluded decisions are filtered/rejected. All usual source, taxonomy, meaning, eight-section lesson and usage-type validators remain active.

## Base cycle

Set kind `base`, baseManifest and previousSupplement to null. Cycle 1 has previousBase null; subsequent cycles reference the preceding base's immutable manifest ID/hash. selection partitions the full parent into included, excluded and deferred. candidateIds and manifest candidates contain exactly included + excluded, while generationPlan contains only generate decisions. Record reviews and coverage chunks link only delivered candidates. Full parent accounting retains deferred links.

Generate balanced 50–100-lesson batches for plans above 100; smaller complete plans use their actual size. Deliver every validated batch immediately and finish the entire plan before new screening. An empty plan can close an entirely excluded cycle without fabricating lessons.

## Late supplement

Use a NEW manifest ID/batch ID with kind `supplement`, the original cycleNumber and previousBase, and a baseManifest ID/hash. Link previousSupplement to the latest supplement for that base, or null for the first. Increase the parent revision and preserve record accounting and accepted candidate/recall decisions. Resolve only previously deferred candidates; include every newly resolved candidate in this supplement. Keep previously delivered candidates in the parent snapshot but out of the new manifest candidates, batch plan and chunk memberships.

Supplements may arrive after later base cycles and do not advance or reset the base cursor. Parent revisions cannot silently omit candidates or invent new identities. Newly discovered candidates outside a frozen parent require a future explicitly supported contract rather than modifying a frozen pack.

## Local import and verification

The existing owner/source transaction lock protects claims. The backend requires actual completed PostgreSQL read-back receipts for referenced dependencies; online authoring and delivery do not require those receipts. Missing local dependencies wait in the queue. Wrong hashes, ownership, duplicate delivery and altered accepted decisions fail explicitly. Existing term-plus-meaning matches use the established progress-preserving importer. Retries and cleanup retain existing per-manifest hashes and verification gates.

Report delivery kind, cycleNumber and deferredCandidates separately. Completion of one subset never claims full source completion. Track full source reconciliation in the parent ledger, including the final deferred review sweep and verified local receipts.
