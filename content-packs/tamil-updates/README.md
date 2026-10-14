# Saved Tamil translation sync

This one-time maintenance command applies only the accepted Tamil header review.
The eight lesson sections, pronunciation, categories, and learning progress are preserved.
The review covers 1,863 entries: 1,019 corrected translations, 822 retained translations,
and 22 unresolved meanings excluded from updates.

After checking out the branch containing this command on the machine running the app,
use the repository root and the app's normal database environment:

```sh
node scripts/sync-reviewed-tamil.cjs --dry-run
node scripts/sync-reviewed-tamil.cjs --apply
```

The command uses the existing knexfile database configuration. It defaults to a dry run.
Apply updates the Tamil field, entry version and timestamp, records an audit version,
and verifies every write inside one transaction. It never writes lesson rows.
Exact UUID, word and sense must match. A changed version or changed old translation
is reported as a conflict and left untouched. Already-correct translations are no-ops.
Repeated execution is safe.

The JSON report distinguishes updated, alreadyCorrect, unresolved and conflicts.
Exit code 2 means some entries were skipped as conflicts; other eligible updates
were committed. A database or audit failure rolls back the entire transaction.
This file is deliberately outside the normal inbox: it is not a full lesson replacement.
GitHub delivery alone does not update the local app database. Run the command locally
and keep its output as the sync receipt; refresh the app after successful execution.
