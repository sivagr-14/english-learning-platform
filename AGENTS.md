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
  allowed). Resolve all decisions in the selected scope before generation.
- Use existing queues and immutable receipts, owner-scoped matching and verified
  PostgreSQL read-back. Never overwrite existing senses, progress or private data.
- All remote GitHub operations use the connected GitHub App. Code changes require
  a PR; do not merge without current user authorization. Never commit private
  SQLite, source exports, credentials or learner progress.

## Offline queue policy

Always read docs/OFFLINE_IMPORT_AND_EXECUTION_POLICY.md with the workflow and
vocabulary contract. It overrides conflicting orchestration rules: advance
online after complete Import-ready group delivery, not after local import.
Keep production delivery and PostgreSQL verification counts separate.
