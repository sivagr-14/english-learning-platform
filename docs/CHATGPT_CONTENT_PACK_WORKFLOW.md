# ChatGPT-only vocabulary automation

This is the supported no-API-key flow for the personal local application.
ChatGPT performs language assessment and lesson generation. GitHub transports
structured content. Only the local backend owns PostgreSQL credentials and
writes database rows.

## End-to-end flow

1. The learner pastes text or attaches a PDF in ChatGPT.
2. ChatGPT reads every page and divides the source into traceable chunks.
3. ChatGPT creates an immutable assessment manifest on the private
   `chatgpt-content-inbox` branch.
4. The Mac fetches that branch automatically every five minutes, or immediately
   when **Sync ChatGPT content** is selected.
5. The learner claims the manifest in **ChatGPT Imports**, reviews exact counts
   and selects the candidates to approve.
6. ChatGPT generates complete lessons in batches of at most ten and writes each
   batch to the same inbox branch.
7. The local backend validates the manifest hash, planned batch membership,
   complete eight-section contract, CEFR, term-specific examples and account
   ownership.
8. Each valid batch is committed in one PostgreSQL transaction. Word, lesson,
   category, version, progress and flashcard rows either all succeed or all roll
   back.
9. The app reads every committed entry back from PostgreSQL before reporting a
   successful verification.
10. After verification succeeds, the local control service removes only that
    manifest folder from the active inbox branch and records the cleanup commit
    and timestamp in PostgreSQL. Git history and the local ledger remain the
    recovery and audit trail.

## Manifest guarantees

The manifest format is `chatgpt-vocabulary-manifest-v1`. It must include:

- a stable `manifestId`, source SHA-256, source type and creation time;
- `totalPages` and an ordered page ledger from page 1 through the last page;
- `totalChunks` and a unique ledger entry for every chunk;
- an explicit status for unreadable pages or chunks, including the error;
- every discovered vocabulary candidate with a permanent decision:
  `generate`, `existing`, `filtered` or `rejected`;
- a specific reason for every non-generated candidate;
- source page, chunk and sentence for every candidate occurrence;
- exact recomputable totals; and
- a numbered generation plan that partitions every `generate` candidate exactly
  once into batches of one to ten.

The app rejects a manifest when a page, chunk, candidate, count or planned batch
is missing, duplicated or inconsistent. An unreadable page is never silently
treated as assessed.

## Batch guarantees

The batch format is `chatgpt-vocabulary-batch-v1`. It must include:

- an immutable `batchId`;
- the manifest ID and exact manifest SHA-256;
- the planned batch number;
- exactly the candidate IDs assigned to that batch; and
- one complete entry per candidate.

Every entry contains pronunciation, word type, English meaning, useful Tamil
meaning, core idea and the complete `simplified-v2` lesson. The local quality
gate rejects empty values, placeholders, generic advice, missing term usage,
weak examples and incomplete Advanced Nuance.

Reusing the same manifest or batch ID with identical content is safe and has no
effect. Reusing it with changed content creates a conflict instead of modifying
already assessed or saved data.

## Large documents

- Assess the source before generating lessons.
- Prefer chunks of roughly 1,000–1,500 source words while preserving page and
  paragraph boundaries.
- Keep a small context overlap when an expression might cross a chunk boundary,
  but list each candidate once in the manifest.
- Record every page even when it yields no useful candidates.
- Mark scanned, corrupt or otherwise unreadable pages as `unreadable` with a
  reason. Do not finalize the import until replacement/OCR text has been
  assessed and the immutable manifest is replaced with a new manifest ID.
- Generate five to ten lessons per batch. A large import may resume across many
  ChatGPT turns because the manifest and received batch numbers are durable.

## Required ChatGPT behavior

When asked to process a source for this application, ChatGPT must:

1. inspect the complete source before proposing entries;
2. show the page/chunk coverage and exact decision counts;
3. wait for explicit approval before generating lessons;
4. use the manifest and batch runtime contracts in
   `packages/backend/src/services/content-pack-contract.ts`;
5. validate files with `yarn content-packs:validate <directory>` before writing
   them to the inbox branch;
6. never place an OpenAI API key, PostgreSQL credential or personal database
   export in GitHub; and
7. report any unreadable source area, rejected batch or missing planned batch.

## Completion rule

An import is complete only when all of these are true:

```text
declared pages = assessed pages + explicitly unreadable pages
declared chunks = assessed chunks + explicitly unreadable chunks
all candidates = generate + existing + filtered + rejected
all approved candidates = committed PostgreSQL entries
all planned batches = received and valid batches
missing or untracked items = 0
```

If any value is nonzero or inconsistent, the UI reports **Processing** or
**Attention required**, never **Completed**.

## Inbox cleanup rule

Cleanup is automatic during periodic or manual synchronization, but is allowed
only after the import is completed, every planned batch is present and valid,
the committed count matches the approved count, and every word, lesson,
progress and review row is read back successfully. A guarded Git push prevents
cleanup from overwriting a concurrently delivered pack. Failed cleanup is safe
to retry, and an already-absent folder is recorded without changing PostgreSQL
content.

