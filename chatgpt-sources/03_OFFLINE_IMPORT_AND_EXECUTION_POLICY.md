# English project: offline import and efficient execution policy

Effective: 13 November 2026 (Europe/Warsaw)
Repository: sivagr-14/english-learning-platform
Content delivery branch: chatgpt-content-inbox

## Authority and scope

Read this policy alongside 01-CHATGPT_CONTENT_PACK_WORKFLOW.md and 02-VOCABULARY_GENERATION_INSTRUCTIONS.md at the start of every relevant run. Revision: rolling-production-20261113-v2. This newer user-approved policy overrides conflicting catalogue orchestration rules in project sources, AGENTS.md, older execution policies and scheduler prompts. Screening may advance independently of delivery; candidate-level deferred review must not block unrelated valid work. Original 1,000-record groups remain accounting boundaries. Quality, provenance, ownership, immutable payloads and verified database outcomes remain mandatory.

This is an approved operating policy, not evidence of deployed functionality. Screening ahead and recording review work can begin immediately. Delivery of a resolved subset and later supplements requires explicit versioned contract, validator and importer support; implement and test missing support through the authorized PR workflow before using it. Never weaken an existing exhaustive manifest or add unsupported enum values to bypass it. Preserve legacy frozen manifests exactly.

## Objective and architecture

Maintain four independently resumable workstreams:

1. Screening: read new original records and record individual scope decisions, source evidence and discovered candidate senses; first reach original record 10,000 without restarting the first 3,503 or trusting stale counts.
2. Production: finish resolved candidates' semantic/coverage checks, freeze an explicitly scoped manifest, generate complete lessons, validate and deliver each batch as Import ready.
3. Local consumption: authenticated backend reconnects, fetches queued content, safely matches and imports, performs PostgreSQL read-back and records receipts.
4. Deferred review: retain difficult cases explicitly and resolve them in a final targeted sweep, producing linked supplements where eligible.

The laptop need not be online for screening, assessment, generation or delivery when required prepared inputs are available. Missing source, ownership or evidence is a specific dependency, never permission to invent data. GitHub transports content; only the local backend writes PostgreSQL.

## Rolling execution and source groups

- Preserve original hashes, record IDs/order, 100-record assessment assignments and 1,000-record parent groups. Do not repartition frozen requests.
- Alternate a bounded new screening block (50–100 originals) with a production block. Before a manifest is ready, the production block resolves specific missing fields or a necessary shared contract defect; afterwards it generates, validates and delivers the next planned batch. Do not wait for 10,000 screened to start delivery.
- Persist next screening record, next production action, deferred-review position and last-served workstream. If a run cannot finish both blocks, resume the unserved workstream first next run. Continue consecutive blocks until real capacity is reached, not merely one pair per invocation.
- At 10,000 screened, pause expansion and clear deliverable production for records 1–10,000; explicitly isolate remaining review items. Then resume rolling screening/production beyond 10,000 through all 42,200. Do not treat the interim target as final scope.
- Screening means an explicit per-record scope review, not file enumeration, rank-based filtering, full semantic completion or lesson generation. Independent expression recall and all required semantic checks remain separately tracked and mandatory before affected delivery.
- Parent accounting must cover every original record, occurrence, candidate and recall unit as pending, resolved, delivered or deferred, with exact non-overlapping dispositions at each accounting level. Distinguish record counts from sense counts. Deferred is tracked outstanding work, never missing work silently omitted or counted complete.

## Deferred review and supplemental delivery

- After one substantive resolution attempt and one targeted retry, defer genuinely difficult candidate-specific ambiguity, eligibility, expression boundaries, taxonomy gaps, duplicate identity or lesson-quality issues. Reopen only for new evidence, a relevant fix or the final review sweep; do not repeat unchanged reviews every hour.
- Store stable review ID, original record/group/candidate links, source and evidence hashes, issue reason, missing fields, attempts and timestamps, next action, dependency, state and eventual resolution/manifest receipt. Preserve accepted decisions unless a concrete contradiction requires a guarded correction.
- Review deferred is a parent-ledger operational state, not a new decision value injected into existing manifests. It is not exclusion, import readiness or completion. Optional enhancements may wait, but required fields in delivered lessons may not.
- A versioned resolved-subset manifest must explicitly bind the parent source/group, ledger revision/hash, exact included resolved candidates, excluded/deferred membership accounting and coverage receipts. Its immutable generation plan partitions only its eligible included candidates. Never claim the subset exhaustively completes its parent group.
- Deferred candidates must not be assigned to an immutable batch before resolution. Resolve them later in NEW linked supplemental manifests with stable original candidate identities and new manifest/batch IDs. Never append to or rewrite a frozen generation plan.
- Keep base delivery ordered by original group. After versioned support is verified, tracked deferred candidates do not block later base groups. Supplements require their parent/base receipts, may arrive after later groups, and must not reset the base-group cursor. Validate global term-plus-sense uniqueness and preserve progress across bases and supplements.
- A quality failure found AFTER freezing a batch cannot be silently deferred out of that batch. Repair the affected lesson; otherwise keep that immutable batch blocked under the current contract. Do not mutate membership to manufacture success.
- Never bypass missing/fabricated evidence, invalid taxonomy in delivered lessons, incomplete sections, hash/ownership conflicts, unsafe writes or structural database failures. A shared defect must be fixed early if it blocks many candidates; independent screening continues safely.
- After straightforward production is delivered, review deferred items grouped by reason/dependency. Resolve and supplement, or record a justified permitted exclusion. Still-unresolvable items remain attention required with evidence and next action. Never claim everything complete while required reviews remain open.

## Required implementation gate

Before resolved-subset/supplemental delivery, verify a versioned contract and production tests for: parent coverage including deferred candidates; exact subset membership and immutable hashes; no duplicate/overlapping delivery; valid late supplements after later base groups; missing predecessor rejection; owner-scoped term-plus-sense matching; progress preservation; concurrent/repeated import idempotence; interrupted recovery; truthful counts and guarded cleanup. Run applicable PostgreSQL integration tests. A code merge is not local deployment verification.

Until this gate passes, continue screening ahead, complete reusable assessments and deliver only manifests valid under the current production contract. Make the narrow required compatibility fix a production priority, not an indefinite hold and not unrelated refactoring. Do not certify unsupported subset packs as Import ready.

## Efficient assessment without lowering quality

- Recover the latest durable checkpoint and remote receipts first. Preserve finalized decisions; reopen only when a concrete contradiction or failed validation requires correction.
- Reconcile saved proposals before requesting fresh reviews. Do not review the same unchanged candidate repeatedly.
- Process unresolved candidates in bounded semantic operations of 50–100. Determine eligibility, frequency, contextual sense, evidence, taxonomy and supported usage types together.
- Prioritize useful B2–C1 meanings. Exclude obvious/basic B1 meanings while retaining valuable B1 expressions under the approved selection policy. Do not broaden a familiar word into unrelated dictionary senses.
- Perform required single-word and independent expression-recall passes. Reuse valid immutable receipts; do not skip required coverage to meet a target count.
- Use the deferred-review attempt budget first. During final review, record ambiguous_context or taxonomy_unresolved only when genuinely justified under the governing contract. Never use exclusion codes to hide technical failures, missing work or quota exhaustion.
- Complete all required eight lesson sections, useful Tamil meaning and pronunciation representation. Use the approved supported-usage-type example rule: one example per supported literal, abstract or figurative usage type, maximum three per meaning. Do not invent additional types or meanings merely to fill examples. If the deployed validator conflicts with the approved rule, fix and test it rather than silently weakening content.
- Automate deterministic bookkeeping, hashes, reconciliation and validation. ChatGPT remains responsible for semantic assessment and lesson writing; do not introduce an unapproved external AI provider.

## Manifest and batch delivery

- Freeze an immutable manifest only after production preflight succeeds for its explicit scope, with zero untracked items. Resolved subsets require the versioned implementation gate above; legacy full-group manifests retain their original exhaustive scope.
- New or changed content requires new identities according to the governing contract. Continuations preserve original manifest hashes, candidate IDs, planned batch membership and batch IDs; generate only missing batches.
- For plans above 100 lessons, use the fewest balanced 50–100-entry batches. A complete plan of 100 or fewer uses its actual size. Never force a lesson count to match source-record count.
- Validate each complete batch with the repository production validator, deliver it immediately, and confirm the remote payload/hash and required CI result. Do not wait for the rest of the group before delivering a ready batch.
- Keep operational status and receipts outside immutable lesson payloads. Update status records without rewriting delivered manifests or batches.
- Use connected GitHub App authorization for every remote GitHub operation. Never use PATs, SSH credentials, gh auth login or another fallback without explicit user authorization.

## Exact status meanings

| Status | Required evidence |
| --- | --- |
| Assessing | Current group has outstanding semantic or coverage work. |
| Review deferred | Parent-ledger item with evidence, attempted resolution and next action; not excluded or complete. |
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
3. Process groups in order and consecutive available batches within a group. Import available valid batches without waiting for the entire group to be delivered; do not import a later base group until its versioned predecessor requirements are satisfied. With tested supplemental support, deferred items do not block later bases; supplements follow their own parent dependencies without resetting base progress.
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
- The existing hourly continuation should read this policy and use the same rolling screening/production loop and deferred-review policy; lack of laptop access must not terminate useful online work. Update the existing schedule rather than creating duplicates when implementing this policy.
- A known structural or quality failure must be resolved, not hidden. Defer unrelated refactoring and optional enhancements until after usable delivery.

## Reporting and completion

Report absolute totals AND per-run deltas, separately: original records screened against the interim 10,000 target and full 42,200; fully assessed records; finalized/unresolved meanings; lessons generated; validated batches; remotely confirmed Import-ready batches/lessons; locally imported, reused, quarantined and read-back-verified counts; current screening position and production group; deferred items by reason and age; first missing batch; local receipt timestamp; exact blockers, capability-gate status and concrete next action. A run with zero new screening and zero new import-ready lessons must name the actual blocking step and next unblock action rather than present checkpoint increments as output.

Base delivery complete: all planned base batches validated and remotely confirmed; this is not full group completion while deferred items remain. Online group completion: all required assessment and deferred review reconciled, every required base and supplemental batch validated and remotely confirmed.
Local group completion: all planned batches processed, outcomes reconciled, required database read-back verified and cleanup status recorded. Quarantined items remain explicitly reported.
Overall completion: every source group meets both criteria, with zero untracked source units, candidates or batch memberships. Imported counts must come from real local receipts.

## Short project instruction to retain

Follow all three project instruction files. Revision rolling-production-20261113-v2 in 03_OFFLINE_IMPORT_AND_EXECUTION_POLICY.md overrides older catalogue sequencing rules. Screen ahead toward 10,000 while alternating complete lesson-production blocks; preserve original 1,000-record accounting groups. Reuse completed work and defer candidate-specific difficult cases after one attempt and one targeted retry with evidence and next action. Use resolved-subset and supplemental manifests only after versioned production-contract and importer tests pass; otherwise continue independent screening and implement the narrow missing support. Preserve immutable identities, full lesson quality and progress-safe deduplication. Queue validated delivered batches as Import ready while the laptop is offline. Review deferred items after straightforward production; never count them as complete. Report screening, finalized assessment, lessons, import readiness, deferred review and verified PostgreSQL imports separately. Continue without routine confirmation; use connected GitHub App authorization only.
