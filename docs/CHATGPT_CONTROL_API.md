# ChatGPT content-pack control API

The local API never calls an AI model. ChatGPT sends immutable manifests and
lesson batches through the private `chatgpt-content-inbox` Git branch. The Mac
launcher fetches that ref and runs the local synchronizer.

All routes below require the normal local account bearer token.

## Connection status

`GET /api/control/connection-status`

Returns the no-API-key transport mode and inbox branch.

## List and inspect imports

- `GET /api/control/content-packs`
- `GET /api/control/content-packs/:manifestId`

Unclaimed manifests are visible to local accounts until one account claims the
manifest. After claim, normal account isolation applies.

## Claim and approve

- `POST /api/control/content-packs/:manifestId/claim`
- `POST /api/control/content-packs/:manifestId/approve`

Approval accepts an optional exact list of external candidate IDs:

```json
{
  "candidateIds": ["candidate-001", "candidate-004"]
}
```

Non-selected proposed candidates are recorded as rejected. Approval is durable;
lesson batches that arrive later are committed automatically.

## Verify storage

`POST /api/control/content-packs/:manifestId/verify`

The endpoint reads every committed ID back through `vocabulary_words`,
`vocabulary_lessons`, `user_progress` and `flashcard_queue`. A missing related
row makes verification fail.

## Local folder synchronization

`POST /api/control/content-packs/sync` scans a checked-out
`content-packs/inbox` directory. Normal use goes through the launcher endpoint
`POST /__control/sync-content`, which first shallow-fetches the private inbox
branch and then imports its JSON files without switching branches.

## Idempotency and conflicts

- Identical manifest and batch retries are no-ops.
- Reusing an ID with different content creates a conflict.
- Batch candidate IDs must exactly match the immutable generation plan.
- Every approved batch writes all related vocabulary records in one transaction.
- Invalid or incomplete lesson content remains staged/invalid and never appears
  in Vocabulary or Review.
