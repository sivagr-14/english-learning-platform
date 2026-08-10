# ChatGPT-only vocabulary automation

This is the supported no-API-key flow for the personal local application.
ChatGPT performs language assessment and lesson generation. GitHub transports
structured content. Only the local backend owns PostgreSQL credentials and
writes database rows.

## Sole supported generation path

This ChatGPT content-pack workflow is the only supported vocabulary discovery
and lesson-generation path. Its
manifest, candidate ledger, contextual-sense identity, source-evidence,
taxonomy, batch, lesson, validation, immutability and completion rules take
precedence over historical Gemini, Ollama or other local-AI implementation
artifacts. The application does not expose, start, call, resume or review an
in-app AI provider. Historical provider rows and migrations are retained only
for safe database upgrades and must not create active import work.

## End-to-end flow

1. The learner pastes text or attaches a PDF in ChatGPT.
2. ChatGPT reads every page and divides the source into traceable chunks.
3. ChatGPT creates an immutable assessment manifest on the private
   `chatgpt-content-inbox` branch.
4. The Mac fetches that branch automatically every five minutes. Loading any
   authenticated app page also starts synchronization immediately.
5. The backend atomically assigns each unowned manifest to the signed-in local
   account, schedules every eligible candidate and imports every available valid
   batch. No claim or approval action is shown to the learner.
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
    and timestamp in PostgreSQL. The completed import then disappears from the
    active import ledger; only actionable, failed or resumable work remains.

## Manifest guarantees

New exhaustive imports use `chatgpt-vocabulary-manifest-v4`.
`chatgpt-vocabulary-manifest-v1`, `chatgpt-vocabulary-manifest-v2` and
`chatgpt-vocabulary-manifest-v3` remain readable so immutable already-delivered
imports can finish. Version 4 must include:

- a stable `manifestId`, source SHA-256, source type and creation time;
- `totalPages` and an ordered page ledger from page 1 through the last page;
- `totalChunks` and a unique ledger entry for every chunk;
- an explicit status for unreadable pages or chunks, including the error;
- every discovered vocabulary candidate with a permanent decision:
  `generate`, `existing`, `filtered` or `rejected`;
- one contextual meaning, stable `senseKey`, `senseDecision` and source-backed
  `senseEvidence` for every candidate;
- one catalogue-valid `taxonomy` assignment for every generated candidate,
  containing the taxonomy version, domain key, usage-group key, specific
  category key and confidence;
- a specific reason for every non-generated candidate;
- source page, chunk and sentence for every candidate occurrence;
- exact recomputable totals; and
- a numbered generation plan that partitions every `generate` candidate exactly
  once into batches of one to ten.

The app rejects a manifest when a page, chunk, candidate, count or planned batch
is missing, duplicated or inconsistent. An unreadable page is never silently
treated as assessed.

Candidate identity is `normalized term + contextual sense`, not spelling alone.
Repeated occurrences with the same meaning are merged. Repeated spelling with
a genuinely different meaning remains a separate candidate. Ambiguous meanings
are held for attention instead of guessed.

## Batch guarantees

New batches use `chatgpt-vocabulary-batch-v4` and must match a version-4
manifest. Version-1, version-2 and version-3 batches remain compatible only
with the same manifest version. Each batch must include:

- an immutable `batchId`;
- the manifest ID and exact manifest SHA-256;
- the planned batch number;
- exactly the candidate IDs assigned to that batch; and
- one complete entry per candidate.

Every entry contains pronunciation, word type, English meaning, useful Tamil
meaning, core idea and the complete `simplified-v2` lesson. The local quality
gate rejects empty values, placeholders, generic advice, missing term usage,
weak examples and incomplete Advanced Nuance.

The batch must use the real unsuffixed term. ChatGPT never writes `(A)`, `(B)`,
`-B` or another display suffix into `word`. The assessed contextual meaning
must be copied exactly into the header and Meaning in Context section, and the
lesson source sentence must equal the recorded evidence sentence.

## Multiple meanings of the same term

For each occurrence, use the full sentence, surrounding paragraph or dialogue,
grammatical role, topic and situation to identify only the demonstrated
meaning. Do not add unrelated dictionary meanings.

```text
same term + same meaning       -> reuse the existing sense
same term + different meaning -> create the next permanent sense
uncertain meaning             -> attention required
```

The backend stores the real term plus a permanent rank. Rank 1 is internally A
but is always displayed without a suffix. Rank 2 is `(B)`, rank 3 is `(C)`,
rank 4 is `(D)`, rank 5 is `(E)`, continuing through `(Z)`, `(AA)` and beyond.
Ranks are never renumbered or reused after deletion.

Example:

```text
“She deposited the money at the bank.” -> bank
“They rested on the river bank.”        -> bank (B)
another financial occurrence           -> reuse bank
```

The suffix is derived only by the app. It is not part of pronunciation,
matching, examples, sorting identity or the generated lesson.

Reusing the same manifest or batch ID with identical content is safe and has no
effect. Reusing it with changed content creates a conflict instead of modifying
already assessed or saved data.

## Controlled taxonomy guarantee

The system catalogue contains 15 domains, 60 usage groups and 300 specific
learning categories. ChatGPT must classify each generated contextual sense by
choosing one exact chain:

```text
domainKey -> usageGroupKey -> categoryKey
```

The backend rejects a v3 manifest when a key is unknown, inactive, belongs to a
different parent, or the free-text `categoryName` does not match the selected
specific category. Generation never creates system categories. A genuine
coverage gap is held for attention and proposed for catalogue review.

The database stores the required specific-category key on every vocabulary
word. Its foreign-key path determines the domain and usage group. Personal
categories are additive learner-owned links and do not satisfy or replace this
system classification.

## Large documents

- Apply this procedure to every source size and supported input type, including
  pasted text, TXT, MD, PDF, DOCX, EPUB, HTML, SRT and VTT. File size or model
  context limits may change processing group size but never reduce coverage.
- Create an immutable ordered source-unit ledger first (page, chapter,
  paragraph, subtitle cue or equivalent) with original text, stable location,
  reading order and readable/unreadable status.
- Split readable content into traceable chunks of roughly 1,000–1,500 source
  words while preserving source-unit and paragraph boundaries. Never assess an
  entire large source as one oversized chunk merely because it fits a model
  context window.
- Keep a small context overlap when an expression might cross a chunk boundary,
  preserve exact source spans, and deduplicate overlap candidates by normalized
  term plus contextual sense.
- Before semantic filtering, deterministically enumerate tokens, lemmas,
  useful n-grams and exact occurrences. This inventory prevents the model from
  silently replacing the source vocabulary with a short hand-selected list.
- The deterministic inventory is the assessment input, not a suggestion. It
  must contain every non-noise lexical token after documented function-word
  removal. Expression discovery must additionally scan every sentence with
  lexical and syntactic phrase detection; a fixed hand-written phrase list is
  only one detector and can never define the complete inventory.
- Give every inventory item a stable `inventoryId`. Store its source span and
  one final disposition: candidate ID, `basic_below_target`, `function_word`,
  `proper_name`, `low_frequency`, `noise`, or `subsumed_by_expression`. A broad
  explanation such as "not useful" is not sufficient.
- Assess every chunk in at least two passes:
  1. single-word B2, C1 and C2 vocabulary, including useful specialised terms;
  2. phrasal verbs, idioms, collocations, fixed expressions and useful
     conversational or professional patterns.
- Record every discovered candidate before filtering. Give each one exactly one
  contract decision: `generate`, `existing`, `filtered` or `rejected`, with a
  stable reason for every decision other than `generate`. Record genuinely
  ambiguous senses separately as attention-required; do not invent a new
  candidate-decision enum value.
- Run a per-chunk omission audit against the deterministic inventory and a final
  source-wide audit for missed advanced words, expressions, repeated spellings
  with different senses and candidates crossing chunk boundaries.
- A second independent recall pass must rescan the original sentences without
  seeing the first pass's chosen candidate list. Reconcile the union. Any item
  found only by the recall pass is added to the ledger before finalization.
- Lesson count is an output of the reconciled ledger. Never choose a desired
  count first and then select that many terms. Previous-import counts (for
  example 40 or 72) are deduplication inputs only, never discovery budgets.
- Do not impose a total candidate cap or stop at a convenient round number.
  Safety limits apply only to assessment groups and lesson batches. A suspicious
  round total must be supported by the complete ledger and omission audit.
- Record every page even when it yields no useful candidates.
- Mark scanned, corrupt or otherwise unreadable pages as `unreadable` with a
  reason. Do not finalize the import until replacement/OCR text has been
  assessed and the immutable manifest is replaced with a new manifest ID.
- Generate five to ten lessons per batch. A large import may resume across many
  ChatGPT turns because the manifest and received batch numbers are durable.
- Finalize the immutable manifest and its complete generation plan before
  generating the first lesson. Resume only from durable manifest and batch
  identities; never rediscover a smaller subset during continuation.

### Exact source-evidence rule

Every `senseEvidence.sentence` must be copied from one recorded canonical
occurrence, byte-for-byte after the contract's single documented normalization
step. Never paraphrase, reconstruct or independently normalize evidence. The
lesson `source_sentence` must copy that same stored value. Validation must prove
that each evidence sentence belongs to the candidate's `occurrences[]` and to
the declared source unit/chunk.

### Large-source reconciliation gate

Generation may start only when all of the following reconcile:

```text
declared source units = readable units + explicitly unreadable units
declared chunks = assessed chunks + explicitly unreadable chunks
enumerated candidates = generate + existing + filtered + rejected
deterministic inventory items = candidate-linked items + explicitly excluded items
contextual senses = resolved senses + explicitly held ambiguities
every candidate occurrence = exact source span in a declared unit and chunk
every generate candidate = exactly one planned batch membership
untracked units, chunks, candidates, occurrences or batch memberships = 0
untracked inventory items or recall-pass findings = 0
```

For manifest v4 this proof is machine-enforced in `inventoryAudit`. Every item
must include its stable inventory ID, exact source sentence and chunk, surface
and normalized form, and either a linked manifest candidate ID or a stable
exclusion code with a specific reason. `counts.untracked` must be zero and the
independent `recallPass` must be completed with no unresolved IDs or missed
findings. A v4 manifest without this proof is invalid, even when its selected
candidate and batch totals reconcile internally.

## Default automatic policy

The backend policy in `packages/backend/src/config/import-policy.ts` is the
source of truth. Every assessment stores an immutable policy snapshot so an
interrupted import resumes with the rules it started with.

- automatically generate every valid, new heavy/high- or medium-frequency
  candidate;
- include words, phrasal verbs, idioms, collocations, fixed expressions and
  useful specialised terms when their usage frequency is heavy/high or medium;
- filter low-frequency terms, proper names, OCR/extraction noise, malformed
  tokens, exact duplicates and already-complete entries, recording a specific
  reason for every exclusion;
- define an exact duplicate as the same normalized term and same contextual
  sense; never exclude a different meaning merely because spelling repeats;
- hold unreadable or ambiguous source material for attention instead of
  silently skipping it;
- assess in bounded groups of 50 candidates up to 500 total candidates, then
  100 candidates per group; these are processing bounds, not total limits;
- generate complete lessons in adaptive batches of 5–10, normally 8, never
  50–100 detailed lessons in one model response;
- process one generation batch at a time, retry temporary failures up to three
  times, and require PostgreSQL read-back verification before completion.

## Required ChatGPT behavior

When asked to process a source for this application, ChatGPT must:

1. inspect the complete source before proposing entries;
2. show the page/chunk coverage and exact decision counts;
3. generate all policy-eligible candidates without asking for claim or approval;
   ask only for unresolved exceptions;
4. use the manifest and batch runtime contracts in
   `packages/backend/src/services/content-pack-contract.ts`;
5. preserve different contextual senses of the same spelling as separate
   candidates and merge only term-and-sense duplicates;
6. select one controlled domain, usage group and specific category for every
   generated contextual sense;
7. validate files with `yarn content-packs:validate <directory>` before writing
   them to the inbox branch;
8. never place an OpenAI API key, PostgreSQL credential or personal database
   export in GitHub; and
9. report any unreadable source area, ambiguous sense, rejected batch or
   missing planned batch.

## Completion rule

An import is complete only when all of these are true:

```text
declared pages = assessed pages + explicitly unreadable pages
declared chunks = assessed chunks + explicitly unreadable chunks
all candidates = generate + existing + filtered + rejected
all contextual senses = resolved same/new senses + explicitly held ambiguities
all generated senses = valid domain + usage group + specific category
all approved candidates = committed PostgreSQL entries
all planned batches = received and valid batches
missing or untracked items = 0
```

If any value is nonzero or inconsistent, the UI reports **Processing** or
**Attention required**, never **Completed**.

An explicitly held ambiguity is accounted for but still blocks **Completed**
until it is resolved or deliberately excluded with a recorded reason.

## Inbox cleanup rule

Cleanup is automatic during periodic or manual synchronization, but is allowed
only after the import is completed, every planned batch is present and valid,
the committed count matches the approved count, and every word, lesson,
progress and review row is read back successfully. A guarded Git push prevents
cleanup from overwriting a concurrently delivered pack. Failed cleanup is safe
to retry, and an already-absent folder is recorded without changing PostgreSQL
content.

## Status and recovery guarantees

The local recovery ledger records the exact private inbox branch, fetched commit,
last synchronization time, database verification report, cleanup attempts and
cleanup commit while an import needs action or recovery. Completed, verified
and inbox-cleaned imports are omitted from the active ledger. Manual
synchronization and the five-minute timer must read only
`chatgpt-content-inbox`. Revalidation may recompute contract and PostgreSQL
read-back status, but must never mutate the immutable manifest or batch payload.
The UI must show a specific next action for missing batches, invalid batches,
attention items, failed read-back and retryable cleanup instead of reporting an
inconsistent import as Completed. A user-triggered synchronization claims no
manual action: the authenticated backend automatically assigns unowned packs to
the signed-in local account, applies the no-approval policy,
saves available batches, verifies PostgreSQL read-back and retries guarded
inbox cleanup as one operation. Imports left in the retired
`awaiting_approval` state are automatically promoted and resumed on the next
synchronization; they never require learner intervention. A clear
source-backed `new_sense` decision is not converted into manual review merely
because its wording overlaps moderately with an existing sense.

If one otherwise valid generated candidate develops an irreconcilable
term/sense identity conflict against the learner's current database, quarantine
only that candidate with its exact reason. Continue every remaining planned
batch automatically, verify all saved entries, clean the completed pack from
the active ledger, and report the skipped term(s) together after processing.
Candidate-level sense conflicts must not leave the manifest in an attention or
approval state. Structural pack errors, unreadable source areas, database
failures and invalid lessons remain blocking failures and must never be hidden
as skipped vocabulary.
