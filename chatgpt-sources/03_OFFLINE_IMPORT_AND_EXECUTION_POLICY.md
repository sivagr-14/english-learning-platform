# English project: offline import and efficient execution policy

Effective: 12 November 2026 (Europe/Warsaw)
Repository: sivagr-14/english-learning-platform
Content delivery branch: chatgpt-content-inbox

## Authority and scope

Read this policy alongside 01-CHATGPT_CONTENT_PACK_WORKFLOW.md and 02-VOCABULARY_GENERATION_INSTRUCTIONS.md at the start of every relevant run. This policy records the user's newer instructions and overrides conflicting orchestration requirements: process ordered 1,000-source-record groups; complete each group's online delivery before advancing; do not require local import verification before online work on the next group. All provenance, quality, validation, ownership, immutability and database-verification requirements remain in force.

This document defines required behavior. Saving instructions does not prove that the application, repository or scheduled task implements them. Check actual capabilities and implement missing support through the authorized repository workflow. Do not claim deployment or successful import from documentation alone.

## Objective and architecture

Optimize for complete, validated, durably delivered lessons and eventual verified imports. Assessment checkpoints are recovery evidence, not imported learning content.

Use two independent execution loops:

1. Online production: recover -> assess current group -> freeze manifest -> generate -> validate -> deliver -> mark Import ready.
2. Local consumption: app/backend reconnects -> fetch queue -> validate and match against current account -> import in order -> PostgreSQL read-back -> record receipts -> guarded cleanup.

The laptop, local backend and PostgreSQL need not be accessible during online production. Do not repeatedly request laptop access or stop independent generation because the laptop is offline. GitHub is the durable transport queue, not the database. Only the local backend owns database credentials and writes learning data.

## Ordered source groups

- Partition the original source into stable, ordered groups of 1,000 original records; the final group may contain fewer. A source record is not a lesson or a contextual sense.
- Preserve original source hashes, record IDs, ordering, assessment-group assignments, occurrence bindings and accepted decisions. Respect existing immutable boundaries; do not silently repartition a frozen request.
- Within the current delivery group, reconcile every required record, occurrence, candidate, contextual sense and recall unit before freezing its complete manifest. A group manifest covers its entire declared scope, never a convenient subset.
- Preserve source-wide coverage through a parent ledger mapping every original record and assessment unit to exactly one delivery group. Cross-boundary evidence must retain its original provenance and explicit ownership.
- Finish generation, validation and durable delivery of every planned batch in the current group before online production advances to the next group.
- When all batches are Import ready, online production may advance without waiting for PostgreSQL. Local imports still proceed in group order.
- Do not claim the entire source completed until all source groups reconcile and all required local imports are verified, with permitted exclusions separately accounted for.

## Efficient assessment without lowering quality

- Recover the latest durable checkpoint and remote receipts first. Preserve finalized decisions; reopen only when a concrete contradiction or failed validation requires correction.
- Reconcile saved proposals before requesting fresh reviews. Do not review the same unchanged candidate repeatedly.
- Process unresolved candidates in bounded semantic operations of 50–100. Determine eligibility, frequency, contextual sense, evidence, taxonomy and supported usage types together.
- Prioritize useful B2–C1 meanings. Exclude obvious/basic B1 meanings while retaining valuable B1 expressions under the approved selection policy. Do not broaden a familiar word into unrelated dictionary senses.
- Perform required single-word and independent expression-recall passes. Reuse valid immutable receipts; do not skip required coverage to meet a target count.
- Use bounded contextual retries for genuine ambiguity; record the permitted ambiguous_context exclusion if unresolved. Record taxonomy_unresolved only for a genuine classification failure under the governing contract. Never use exclusion codes to hide technical failures, missing work or quota exhaustion.
- Complete all required eight lesson sections, useful Tamil meaning and pronunciation representation. Use the approved supported-usage-type example rule: one example per supported literal, abstract or figurative usage type, maximum three per meaning. Do not invent additional types or meanings merely to fill examples. If the deployed validator conflicts with the approved rule, fix and test it rather than silently weakening content.
- Automate deterministic bookkeeping, hashes, reconciliation and validation. ChatGPT remains responsible for semantic assessment and lesson writing; do not introduce an unapproved external AI provider.

## Manifest and batch delivery

- Freeze a complete, immutable manifest for the current delivery group only after exhaustive production preflight succeeds with zero untracked items.
- New or changed content requires new identities according to the governing contract. Continuations preserve original manifest hashes, candidate IDs, planned batch membership and batch IDs; generate only missing batches.
- For plans above 100 lessons, use the fewest balanced 50–100-entry batches. A complete plan of 100 or fewer uses its actual size. Never force a lesson count to match source-record count.
- Validate each complete batch with the repository production validator, deliver it immediately, and confirm the remote payload/hash and required CI result. Do not wait for the rest of the group before delivering a ready batch.
- Keep operational status and receipts outside immutable lesson payloads. Update status records without rewriting delivered manifests or batches.
- Use connected GitHub App authorization for every remote GitHub operation. Never use PATs, SSH credentials, gh auth login or another fallback without explicit user authorization.

## Exact status meanings

| Status | Required evidence |
| --- | --- |
| Assessing | Current group has outstanding semantic or coverage work. |
| Generating | Group manifest accepted; planned lessons remain unwritten. |
| Validation pending | Content exists but validation or required CI is incomplete. |
| Import ready | Manifest and batch pass required validation; exact immutable files are confirmed on the inbox branch. Local import may not yet have occurred. |
| Waiting for local app | Import-ready content exists; no current local import receipt is available. Offline state is expected, not a content failure. |
| Importing | Local backend reports active processing. |
| Imported; verification pending | Local transaction committed but full read-back is not yet confirmed. |
| Imported and verified | Local receipt confirms committed results and required PostgreSQL read-back. |
| Failed / attention required | Specific validation, authorization, ownership, database or structural failure with a recorded next action. |

Track online delivery and local import separately. A batch may be Import ready with local status unknown. Never infer import failure from an offline laptop, or import success from branch delivery, CI, an empty inbox or missing files. Report last verified timestamps; do not present stale counts as live counts.

## Local automatic queue draining

When the user opens an authenticated app page and the local backend, PostgreSQL, network and GitHub connection are available, the backend must start synchronization automatically. Also resume at supported startup/reconnect events and on the existing periodic timer. Merely opening a page cannot import if its backend or database is stopped.

The backend must:

1. Discover all eligible queued manifests and batches from chatgpt-content-inbox.
2. Enforce authenticated account ownership and validate payload hashes and schema.
3. Process groups in order and consecutive available batches within a group. Import available valid batches without waiting for the entire group to be delivered; do not import a later group until predecessor requirements are satisfied.
4. Use resumable background work rather than one long browser request. Persist queue position and receipts so tab closure, restart or network interruption cannot lose work.
5. Match the normalized term plus contextual meaning against the current account. Reuse same-sense entries, retain genuinely different senses and preserve review/mastery history. The source's existing-vocabulary snapshot helps preparation but is not final authority over the current database.
6. Commit each valid batch transactionally and perform required read-back. Repeated fetches/retries must be idempotent; concurrent workers must not duplicate or overwrite senses.
7. Quarantine only genuine candidate-level identity conflicts when the contract permits it; report them explicitly and continue unaffected candidates. Do not quarantine invalid lessons or structural/database failures to simulate success.
8. Retry transient failures up to three times per attempt, preserve progress and automatically resume eligible work later. Do not repeatedly regenerate correct content to solve a local runtime failure.
9. Clean only the verified completed manifest folder with guarded GitHub writes. Never delete queued, unverified or concurrently delivered content. Preserve durable verification and cleanup receipts.

## Compatibility requirement for offline production

Check whether the deployed ordered-group pipeline requires a prior PostgreSQL import receipt merely to construct, validate or deliver a later group's manifest. If it does, implement and test a separation between:

- production ordering, proven by immutable predecessor manifests and complete delivery receipts; and
- local import ordering, proven by actual predecessor import receipts.

Never fabricate a database receipt or disable ordering to bypass this dependency. Preserve frozen payloads and backward compatibility. If current code blocks later-group delivery, report that exact implementation blocker and continue any independent work safely possible. Backend access is not a prerequisite for online assessment or generation when the required source, taxonomy and contracts are already available.

## Continuation, quota use and scheduling

- Each run recovers remote receipts and the latest checkpoint, then processes the next incomplete step. Do not restart the catalogue or repeat completed reviews.
- Continue automatically at routine group/batch boundaries without confirmation. A batch checkpoint is not a reason to end the run early.
- Before a quota/context/run limit, finish the current safe unit when possible and persist exact work, validation results, receipts and next action. Do not claim work continues outside an actual active run or scheduled execution.
- Avoid overlapping writers: use reservations or leases and compare expected source/checkpoint hashes before committing. Never overwrite concurrent progress.
- The existing hourly continuation should read this policy and use the same online delivery loop; lack of laptop access must not terminate useful online work. Update the existing schedule rather than creating duplicates when implementing this policy.
- A known structural or quality failure must be resolved, not hidden. Defer unrelated refactoring and optional enhancements until after usable delivery.

## Reporting and completion

Report, separately: source records assessed; finalized/unresolved meanings; lessons generated; validated batches; remotely confirmed Import-ready batches/lessons; locally imported, reused, quarantined and read-back-verified counts; current group; first missing batch; local receipt timestamp; concrete next action.

Online group completion: all required assessment reconciled, accepted manifest, every planned batch validated and remotely confirmed.
Local group completion: all planned batches processed, outcomes reconciled, required database read-back verified and cleanup status recorded. Quarantined items remain explicitly reported.
Overall completion: every source group meets both criteria, with zero untracked source units, candidates or batch memberships. Imported counts must come from real local receipts.

## Short project instruction to retain

Always read 03_OFFLINE_IMPORT_AND_EXECUTION_POLICY.md together with 01-CHATGPT_CONTENT_PACK_WORKFLOW.md and 02-VOCABULARY_GENERATION_INSTRUCTIONS.md. The newer offline policy overrides conflicting execution-order rules: finish each 1,000-source-record group's assessment and complete validated GitHub delivery, mark batches Import ready, then advance online even if the laptop is offline. The local backend drains queued groups in order when available and alone confirms PostgreSQL imports. Preserve lesson quality, source coverage, immutable identities, progress-safe deduplication and honest separate delivery/import counts. Resume automatically from durable receipts; use connected GitHub App authorization only.
