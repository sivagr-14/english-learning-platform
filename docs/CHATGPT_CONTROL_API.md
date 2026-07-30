# ChatGPT vocabulary control API

This API makes ChatGPT the only conversational controller for assessing and
approving vocabulary changes. The learning application remains the system of
record and enforces authentication, ownership, validation, idempotency, and
audit history.

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

Approval does not create vocabulary. It creates one resumable generation job
and one pending job item for every selected candidate. Repeating approval
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

## Planned MCP tool mapping

| ChatGPT tool               | API operation                               |
| -------------------------- | ------------------------------------------- |
| `create_assessment`        | `POST /api/control/assessments`             |
| `get_assessment`           | `GET /api/control/assessments/:id`          |
| `approve_assessment`       | `POST /api/control/assessments/:id/approve` |
| `get_generation_job`       | next implementation phase                   |
| `complete_generated_entry` | next implementation phase                   |
| `retry_generation_item`    | next implementation phase                   |

All write operations require an authenticated user and are recorded in
`control_audit_events`.
