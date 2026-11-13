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
  in the rolling policy below. Screening ahead is independent of this gate.
- Use existing queues and immutable receipts, owner-scoped matching and verified
  PostgreSQL read-back. Never overwrite existing senses, progress or private data.
- All remote GitHub operations use the connected GitHub App. Code changes require
  a PR; do not merge without current user authorization. Never commit private
  SQLite, source exports, credentials or learner progress.

## Offline production and rolling delivery (13 November 2026)

Read `docs/OFFLINE_IMPORT_AND_EXECUTION_POLICY.md`, revision
`rolling-production-20261113-v2`, as the newer catalogue orchestration authority.
Screen ahead toward 10,000 original records while alternating lesson-production
blocks; do not gate new screening on first-group delivery or local imports.
Preserve original 1,000-record accounting groups and full quality/provenance.
After one attempt and one targeted retry, track difficult candidate-specific
items as Review deferred with evidence and next action, never as completed.
Deliver resolved subsets and later linked supplements ONLY after the versioned
contract/validator/importer capability gate in that policy passes. Existing
frozen contracts retain their exact scope and immutable identities. Older
whole-group sequencing below documents the legacy contract, not a prohibition
on independent screening. Do not silently omit deferred items from exhaustive
manifests. Queue validated delivery as Import ready while offline; only actual
local PostgreSQL read-back proves import. Complete the final deferred-review
sweep before claiming full completion. Preserve ownership and learner progress.

