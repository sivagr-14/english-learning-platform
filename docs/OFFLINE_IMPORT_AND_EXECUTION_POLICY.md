# English project: offline import and efficient execution policy

Effective: 13 November 2026 (Europe/Warsaw)
Repository: sivagr-14/english-learning-platform
Content delivery branch: chatgpt-content-inbox

## Authority and scope

Read this policy alongside 01-CHATGPT_CONTENT_PACK_WORKFLOW.md and 02-VOCABULARY_GENERATION_INSTRUCTIONS.md at the start of every relevant run. Revision: production-cycle-500-20261113-v3. This newer user-approved policy overrides conflicting catalogue orchestration rules in project sources, AGENTS.md, older execution policies and scheduler prompts. First deliver already finalized eligible entries, then complete each 500-record working cycle through Import ready before expanding screening; candidate-level deferred review must not block unrelated valid work under a supported subset contract. Original 1,000-record groups remain accounting boundaries. Quality, provenance, ownership, immutable payloads and verified database outcomes remain mandatory.

This is an approved operating policy, not evidence of deployed functionality. Existing finalized eligible entries are the first production priority. Recording review work is not lesson generation. Delivery of a resolved subset and later supplements requires explicit versioned contract, validator and importer support; implement and test missing support through the authorized PR workflow before using it. Never weaken an existing exhaustive manifest or add unsupported enum values to bypass it. Preserve legacy frozen manifests exactly.

## Objective and architecture

Maintain four independently resumable workstreams:

1. Screening: after clearing the existing deliverable backlog, read the next at most 500 original records per working cycle and record individual scope decisions, evidence and candidate senses. Reach 10,000 through completed production cycles, then continue all 42,200; never wait for 10,000 to generate lessons.
2. Production: finish resolved candidates' semantic/coverage checks, freeze an explicitly scoped manifest, generate complete lessons, validate and deliver each batch as Import ready.
3. Local consumption: authenticated backend reconnects, fetches queued content, safely matches and imports, performs PostgreSQL read-back and records receipts.
4. Deferred review: retain difficult cases explicitly and resolve them in a final targeted sweep, producing linked supplements where eligible.

The laptop need not be online for screening, assessment, generation or delivery when required prepared inputs are available. Missing source, ownership or evidence is a specific dependency, never permission to invent data. GitHub transports content; only the local backend writes PostgreSQL.

## Production-first execution and source groups

1. Recover the latest guarded checkpoint, frozen plans and delivery receipts. First drain missing batches of existing valid frozen plans; then generate lessons for already finalized eligible senses, completing only their missing delivery prerequisites. Finalized exclusions and existing matches are not new lessons. Do not re-screen accepted decisions.
2. Before opening new screening, clear the existing deliverable finalized backlog in original source order. Resolve the narrow shared delivery-contract blocker first if necessary. Candidate-specific difficult items follow the bounded deferred-review policy; missing implementation is not candidate ambiguity.
3. Then select the next contiguous working cycle of at most 500 original records, within original parent-group boundaries (a boundary or final remainder may be smaller). Internally use bounded 50–100-record assessment operations. Preserve original hashes, record IDs/order, 100-record assessment assignments and 1,000-record accounting groups. Never repartition frozen requests. Reuse previously screened records without repeating their work.
4. Finalize all ready eligible senses and account explicitly for exclusions, existing matches and deferred items. Complete required independent recall and source/meaning/taxonomy checks. Freeze only a production-valid manifest for its exact scope. A 500-record working cycle is not an existing manifest schema; subset delivery requires the tested versioned gate below. Never silently shrink an exhaustive legacy manifest.
5. Generate one complete planned lesson batch, production-validate and semantically review it, repair only failing lessons, deliver immediately and verify remote hashes and required CI. Plans above 100 use balanced 50–100-lesson batches; smaller complete plans use actual size. Never pad or discard candidates to reach a lesson count.
6. Drain ALL planned batches in this cycle through Import ready before screening the next cycle. A candidate list, frozen manifest, one batch of a multi-batch cycle, policy update or PR alone does not complete the cycle. Deferred candidates remain tracked for later linked supplements; they are not completion or exclusions.
7. Persist working-cycle record bounds, parent links, exact production stage, manifest/hash, first missing batch, valid partial authoring artifacts, deferred-review position and next action. If capacity ends mid-generation or validation, resume that exact production step next run before any new screening. Do not regenerate valid lessons or restart the cycle.
8. Continue cycles through 10,000 as an interim milestone, then through all 42,200. Do not enlarge to 1,000 or 5,000 working cycles without a later user instruction. Local import is independent and never gates new online cycles after their complete Import-ready delivery.

Parent accounting covers every record, occurrence, candidate and recall unit with exact non-overlapping dispositions at each level. Distinguish source-record, sense and lesson counts. A genuine external blocker that prevents production must be evidenced and reported; do not quietly replace the production action with another screening-only run. Preserve quality checks and use safe retries rather than promising zero errors.

## Deferred review and supplemental delivery

- After one substantive resolution attempt and one targeted retry, defer genuinely difficult candidate-specific ambiguity, eligibility, expression boundaries, taxonomy gaps, duplicate identity or lesson-quality issues. Reopen only for new evidence, a relevant fix or the final review sweep; do not repeat unchanged reviews every hour.
- Store stable review ID, original record/group/candidate links, source and evidence hashes, issue reason, missing fields, attempts and timestamps, next action, dependency, state and eventual resolution/manifest receipt. Preserve accepted decisions unless a concrete contradiction requires a guarded correction.
- Review deferred is a parent-ledger operational state, not a new decision value injected into existing manifests. It is not exclusion, import readiness or completion. Optional enhancements may wait, but required fields in delivered lessons may not.
- A versioned resolved-subset manifest must explicitly bind the parent source/group, ledger revision/hash, exact included resolved candidates, excluded/deferred membership accounting and coverage receipts. Its immutable generation plan partitions only its eligible included candidates. Never claim the subset exhaustively completes its parent group.
- Deferred candidates must not be assigned to an immutable batch before resolution. Resolve them later in NEW linked supplemental manifests with stable original candidate identities and new manifest/batch IDs. Never append to or rewrite a frozen generation plan.
- Keep base delivery ordered by original group. After versioned support is verified, tracked deferred candidates do not block later base groups. Supplements require their parent/base receipts, may arrive after later groups, and must not reset the base-group cursor. Validate global term-plus-sense uniqueness and preserve progress across bases and supplements.
- A quality failure found AFTER freezing a batch cannot be silently deferred out of that batch. Repair the affected lesson; otherwise keep that immutable batch blocked under the current contract. Do not mutate membership to manufacture success.
- Never bypass missing/fabricated evidence, invalid taxonomy in delivered lessons, incomplete sections, hash/ownership conflicts, unsafe writes or structural database failures. A shared defect must be fixed early if it blocks many candidates; prioritize its narrow repair before expanding screening.
- After straightforward production is delivered, review deferred items grouped by reason/dependency. Resolve and supplement, or record a justified permitted exclusion. Still-unresolvable items remain attention required with evidence and next action. Never claim everything complete while required reviews remain open.

## Required implementation gate

Before resolved-subset/supplemental delivery, verify a versioned contract and production tests for: parent coverage including deferred candidates; exact subset membership and immutable hashes; no duplicate/overlapping delivery; valid late supplements after later base groups; missing predecessor rejection; owner-scoped term-plus-sense matching; progress preservation; concurrent/repeated import idempotence; interrupted recovery; truthful counts and guarded cleanup. Run applicable PostgreSQL integration tests. A code merge is not local deployment verification.

Until this gate passes, deliver any already-valid frozen batches and prioritize implementing the missing support for the finalized backlog. Do not expand screening as a substitute for this production work. Make the narrow required compatibility fix a production priority, not an indefinite hold and not unrelated refactoring. Do not certify unsupported subset packs as Import ready.

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
- The existing hourly continuation should read this policy and use the same production-first 500-record cycle and deferred-review policy; lack of laptop access must not terminate useful online work. Update the existing schedule rather than creating duplicates when implementing this policy.
- A known structural or quality failure must be resolved, not hidden. Defer unrelated refactoring and optional enhancements until after usable delivery.

## Reporting and completion

Report absolute totals AND per-run deltas, separately: original records screened against the interim 10,000 target and full 42,200; fully assessed records; finalized/unresolved meanings; lessons generated; validated batches; remotely confirmed Import-ready batches/lessons; locally imported, reused, quarantined and read-back-verified counts; current screening position and production group; deferred items by reason and age; first missing batch; local receipt timestamp; exact blockers, capability-gate status and concrete next action. Lead with lesson-written, validated and Import-ready totals and deltas. Whenever no lessons are written or no Import-ready growth occurs, name the production step attempted, concrete change, remaining blocker and exact next action; a screening increase alone is not production success.

Base delivery complete: all planned base batches validated and remotely confirmed; this is not full group completion while deferred items remain. Online group completion: all required assessment and deferred review reconciled, every required base and supplemental batch validated and remotely confirmed.
Local group completion: all planned batches processed, outcomes reconciled, required database read-back verified and cleanup status recorded. Quarantined items remain explicitly reported.
Overall completion: every source group meets both criteria, with zero untracked source units, candidates or batch memberships. Imported counts must come from real local receipts.

## Short project instruction to retain

Follow all three project files and revision production-cycle-500-20261113-v3. First generate, validate and deliver the existing finalized eligible backlog. Then use at most 500-original-record cycles: screen, finalize ready senses and deferred accounting, freeze a supported plan, generate complete lessons in planned 50–100-lesson batches, validate/repair and confirm all batches Import ready before screening the next cycle. Smaller complete lesson plans use actual size. Preserve original 100-record assessment and 1,000-record accounting identities. Resume unfinished production first across runs. Use only tested subset/supplement support; prioritize missing implementation rather than more screening. Preserve all eight sections, Tamil, evidence, taxonomy, usage examples, immutable identities, progress-safe matching and final deferred review. Local imports run independently; only actual receipts prove PostgreSQL verification. Continue without routine confirmations, using connected GitHub App authorization only.
