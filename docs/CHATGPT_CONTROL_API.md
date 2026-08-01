# ChatGPT vocabulary control API

This API supports local assessment, approval, generation, and reconciliation.
PostgreSQL remains the system of record and enforces authentication, ownership,
validation, idempotency, and audit history.

## Automated local flow

`POST /api/control/assess-text` accepts a source name and pasted text. The local
backend calls the OpenAI Responses API with Structured Outputs and `store:
false`, reconciles exact term matches against account-scoped vocabulary, and
saves a non-mutating assessment.

After approval, the durable worker processes each pending item, retries one
invalid result, and then either:

- saves a complete entry, category link, review progress, flashcard and version
  record in one local PostgreSQL transaction; or
- marks the item for manual review without saving partial vocabulary.

Pending and processing jobs resume when the backend restarts.

## Non-mutating assessment

`POST /api/control/assessments`

The caller supplies a stable `operationId`, source identity, and every assessed
candidate. The server recalculates all counts from the candidates; it does not
accept a caller-provided total.

Candidate actions:

- `new`: create a vocabulary entry after approval and complete generation
- `update`: version and update the matched entry after approval
- `unchanged`: already present and requires no write
- `filtered`: intentionally excluded with a required reason

The response always states that no vocabulary entry was created or updated.
Repeating the same request with the same `operationId` is safe. Reusing the ID
with different content returns HTTP 409.

The count object contains:

- `candidatesIdentified`
- `alreadyPresentUnchanged`
- `existingEntriesToUpdate`
- `lowValueFilteredOut`
- `newEntriesProposed`
- `totalEntriesToProcess`
- `heavyUseSelections`
- `mediumUseSelections`

## Explicit approval

`POST /api/control/assessments/:id/approve`

An empty body approves all processable candidates. To approve a subset, send:

```json
{
  "candidateIds": ["4e4f8cc5-cdb4-4654-85f5-8ef7067242ea"]
}
```

Approval creates one resumable generation job and one pending job item for every
selected candidate. The local worker begins automatically. Repeating approval
returns the existing job.

## Generated lesson quality gate

Every completed generation item must provide the `simplified-v2` lesson format
defined in `VOCABULARY_GENERATION_INSTRUCTIONS.md`.

The server validates the complete replacement before any vocabulary write. It
requires all eight sections, rejects empty nested values and known filler
phrases, and checks that key examples, patterns, corrections and nuance
explicitly demonstrate the target term. A failed lesson must remain failed or
be held for manual review; partial content is never saved.

Updates replace all eight sections together while preserving review history and
recording a new entry version.

All API operations require an authenticated user. Successful generated writes
are recorded in `control_audit_events`; OpenAI never receives database
credentials or direct database access.
