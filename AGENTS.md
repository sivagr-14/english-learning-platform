# Agent Instructions

## GitHub Access

- This repository is connected to the ChatGPT GitHub connector under `sivagr-14/english-learning-platform`.
- When GitHub access is needed, prefer the GitHub connector for repository reads, pull request creation, issue/PR inspection, and review workflows.
- Do not treat a missing or unauthenticated local `gh` CLI session as a hard blocker when the GitHub connector is available for the same operation.
- Local `git` may be used for branch creation, commits, and pushes when repository credentials are available.
- Keep unrelated local files out of commits. In particular, only stage files that belong to the user-requested change.
- Default to creating a feature branch and draft pull request rather than pushing directly to `main`, unless the user explicitly asks for a direct main push.


## WordUp delivery groups

- Follow the canonical workflow and vocabulary instructions before processing.
- Versioned `wordup-delivery-groups-v1` manifests preserve the full immutable
  preparation and select ten original 100-record assessment groups (final remainder
  allowed). Legacy manifests resolve all decisions in the selected scope before generation.
  New resolved-subset/supplement behavior requires the versioned capability gate
  in the production-first policy below. Finish this gate before affected delivery.
- Use existing queues and immutable receipts, owner-scoped matching and verified
  PostgreSQL read-back. Never overwrite existing senses, progress or private data.
- All remote GitHub operations use the connected GitHub App. Code changes require
  a PR; do not merge without current user authorization. Never commit private
  SQLite, source exports, credentials or learner progress.

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


