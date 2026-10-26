# Parallel catalogue scope assessment

This is the executable first-stage integration of the three-worker workflow.
It does not call an AI provider. ChatGPT launches three isolated assessment
agents after preparing their assignments. Only the coordinator writes the
assessment database. The existing semantic reconciliation, full manifest,
eight-section lesson, Tamil and local PostgreSQL read-back gates remain required.

## Coordinator run

1. Recover the latest versioned assessment and immutable preparation. Retain the
   Library version guard. Work on a private copy; never upload source data to GitHub.
2. Run:

   ```bash
   python3 scripts/catalogue-parallel-assessment.py --assessment /absolute/assessment.sqlite prepare /absolute/preparation.json /absolute/worker-inputs --coordinator <unique-run-id>
   ```

   The command verifies all source rows and the current B1–C2 selection policy,
   skips records with prior scope or meaning reviews, and exports up to three
   disjoint groups of at most 100 records. It retains original group/record IDs.
   Existing live assignments are re-exported only for the same coordinator run ID; another coordinator is rejected while leases remain live. Leases expire after
   one hour; expired results must not be force-applied.
   Save these assignments to the same durable assessment identity with its
   expected version before dispatch. If another run saved first, reload and
   reconcile ownership before launching any worker; never discard the guard.

3. Launch one ChatGPT assessment agent for each returned input path, concurrently.
   Each agent reads only its assigned bundle, assesses each record individually,
   and writes a separate JSON output. It must not edit the assessment database.
   Use the bundle requirements, original definition and current selection policy.
   Rank is not proof of level or usage. Record meaningful reasons; preserve
   non-obvious expressions made from basic words. Do not manufacture certainty.
4. Each output has this envelope:

   ```json
   {
     "assignmentId": "copied from input",
     "bundleHash": "copied from input",
     "recordReviews": []
   }
   ```

   Include exactly the assigned records. Copy each record's source hash, term
   and original meaning. Required review fields and allowed scope decisions are
   in the bundle. Use `scopeDecisionFinal: false`; do not write final semantic
   candidate decisions or claim exhaustive meaning coverage.
5. Inspect worker outputs for linguistic quality, then merge the round:

   ```bash
   python3 scripts/catalogue-parallel-assessment.py --assessment /absolute/assessment.sqlite merge /absolute/result-1.json /absolute/result-2.json /absolute/result-3.json
   ```

   The merge validates every binding and uses one SQLite transaction. Invalid
   output rolls back the supplied round. Identical replay is a no-op; changed
   replay, expired assignments, changed source/policy and records modified by
   another assessment are rejected. Previous reviews are never overwritten.
   A failing worker can be corrected independently; valid siblings may be merged
   separately without a global checkpoint conflict.
6. Reconcile new scope reviews into the broader editorial checkpoint with exact
   counts. Preserve meaning inventories, taxonomy and app-matching holds. Save
   the same Library assessment identity using its expected version; a version
   conflict means reload/reconcile, never drop the guard. Retain input/output
   artifacts and receipts in a durable private checkpoint. Start another round
   when capacity permits. Do not generate lessons before complete assessment.

## Scheduler behavior

The hourly invocation is a recovery trigger, not the worker launcher itself.
Its instruction must explicitly execute the coordinator flow and launch the
three available ChatGPT agents. If agents are unavailable, report the blocker
or explicitly label a sequential fallback; do not report parallel throughput.
Never create three independent hourly writers to the same checkpoint.

Each run must report substantive saved work or a concrete reason for no progress.
An empty or suppressed scheduled response is not proof of assessment progress.

## Verification

```bash
python3 -m unittest discover -s scripts -p 'test_catalogue*py'
```

The integration tests cover disjoint assignments, exact resume, legacy-review
skipping, atomic round rollback, idempotency/conflicting replay, concurrent-review
protection, sibling merges, expired leases and immutable source validation.
Scope screening is not full semantic reconciliation or app import verification.
