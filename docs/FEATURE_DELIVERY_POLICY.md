# Feature delivery and ChatGPT-source policy

A feature is not complete merely because code exists in a local checkout or a
pull-request branch. Report it as delivered only after all applicable evidence
below is available.

## Required delivery evidence

1. The feature implementation is in a GitHub pull request.
2. Its automated tests and relevant smoke tests pass on the PR head.
3. The PR is merged and the resulting commit is present on `main`.
4. A `.feature-delivery/*.json` record covers the changed product files and
   names the feature's validation paths.
5. The record declares whether ChatGPT instructions are affected.
6. When instructions are affected, every declared canonical instruction is
   updated together with its byte-identical file in `chatgpt-sources/` and the
   SHA-256 values in `chatgpt-sources/source-release.json`.
7. The current `main` workflow run passes and publishes
   `feature-delivery-evidence` for that commit.
8. Replacement of the actual ChatGPT Project sources is verified separately by
   their stable source identity, new version number, exact byte size and source
   hash. GitHub Actions cannot access or modify authenticated ChatGPT Project
   sources and must never be presented as proof that this external replacement
   occurred.

## Pull-request rule

Any PR changing product code under `packages/`, operational code under
`scripts/` or `launchd/`, or root runtime configuration must add or update at
least one `.feature-delivery/*.json` record. Each changed product path must be
covered by a record and at least one declared validation path must change.

For instruction-bearing features, the record must list the relevant canonical
instruction paths and stable text markers. CI requires all listed instructions,
their `chatgpt-sources/` mirrors, and the source-release manifest to change in
the same PR. If instructions are not relevant, the record must contain a
specific written rationale.

## Completion language

Use precise states:

- **Implemented locally** — changes exist only in a working checkout.
- **Published in PR** — a real GitHub PR exists, but `main` is unchanged.
- **CI passed on PR** — checks passed for the PR head; it may still be unmerged.
- **Merged to main** — GitHub reports the PR merged and the `main` delivery gate
  passed for the resulting commit.
- **ChatGPT sources replaced** — the existing Project-source identities show
  new versions whose bytes match `chatgpt-sources/source-release.json`.

Never collapse these states into a generic “done” or “implemented” statement.
