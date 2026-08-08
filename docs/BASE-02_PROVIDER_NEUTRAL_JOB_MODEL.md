# BASE-02 — Provider-neutral durable job model

## Identity and compatibility

`generation_jobs` remains the common parent row, so existing ChatGPT assessments,
content-pack manifests, vocabulary entries, progress, and flashcards are preserved.
Migration `022_provider_neutral_generation_model` extends it in place and backfills
legacy rows as `chatgpt` or `gemini` according to their existing operation ID.

Manifest identity is SHA-256 over source hash, prompt version, contract version,
and the immutable import-policy snapshot. Provider and model are intentionally not
included. Changing ChatGPT to Gemini therefore cannot change candidate identity,
batch membership, or validation rules for an existing job.

## Durable aggregate

| State | Durable location |
|---|---|
| Provider, model, versions, policy, source hash, token/cost totals | `generation_jobs` |
| Immutable source/segment ledger and locators | `generation_job_segments` |
| Candidate decisions and sense snapshots | `generation_candidate_decisions` |
| All source occurrences | `generation_candidate_occurrences` |
| Immutable batches and exact membership | `generation_plan_batches`, `generation_plan_members` |
| Provider calls, retry outcome, tokens and cost | `generation_attempts` |
| Schema-valid generated entries | `generation_results` |
| Validation diagnostics and resolution | `generation_validation_failures` |
| Append-only lifecycle history | `generation_job_events` |

`ProviderNeutralJobRepository.reconstruct(jobId)` loads the aggregate required to
resume or audit a stopped job. Later reliability phases can add stricter transition
and retry policies without another data-model fork.

## Queue contract

BullMQ messages contain only `generationJobId` and `userId`. The API transaction
stores the submitted source in the durable segment ledger before enqueueing. Each
stage reloads its inputs from PostgreSQL and uses a deterministic stage job ID.
Redis therefore never acts as the only copy of a file, extracted text, manifest,
generation plan, or lesson.

## Backward-compatible ChatGPT mapping

Existing content-pack tables remain the transport/read model. When a ChatGPT
manifest is approved, its generation job records `provider=chatgpt`, the content
source hash and policy snapshot, and links `manifest_id`. Existing rows receive
safe `legacy` version markers without rewriting vocabulary or learner state.

## Rollout and rollback

Run `yarn db:migrate`. The migration is additive and does not delete or rewrite
entries, lessons, progress, or flashcards. Its rollback removes only the BASE-02
tables and columns; it does not remove pre-existing job or content-pack records.
