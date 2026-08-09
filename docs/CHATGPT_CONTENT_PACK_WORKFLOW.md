# ChatGPT-only vocabulary automation

This is the supported no-API-key flow for the personal local application.
ChatGPT performs language assessment and lesson generation. GitHub transports
structured content. Only the local backend owns PostgreSQL credentials and
writes database rows.

## Authority and provider precedence

This ChatGPT content-pack workflow is the canonical import contract. Its
manifest, candidate ledger, contextual-sense identity, source-evidence,
taxonomy, batch, lesson, validation, immutability and completion rules take
precedence over Gemini, Ollama or any other local-AI implementation.

Other providers may produce data only through an adapter that emits and passes
this same contract. They must not weaken, omit, rename or reinterpret required
fields or validation rules. If provider output conflicts with this contract,
reject or adapt the provider output; never change or compromise the ChatGPT
format. Provider switching starts a new immutable job and must never combine or
mutate an existing ChatGPT manifest.

## End-to-end flow

1. The learner pastes text or attaches a PDF in ChatGPT.
2. ChatGPT reads every page and divides the source into traceable chunks.
3. ChatGPT creates an immutable assessment manifest on the private
   `chatgpt-content-inbox` branch.
4. The Mac fetches that branch automatically every five minutes, or immediately
   when **Sync ChatGPT content** is selected.
5. The learner claims the manifest in **ChatGPT Imports** to establish account
   ownership. The backend automatically schedules every eligible candidate; no
   separate approval step is required.
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

New imports use `chatgpt-vocabulary-manifest-v2`. Version 1 remains readable
only so already-started imports can finish. Version 2 must include:

- a stable `manifestId`, source SHA-256, source type and creation time;
- `totalPages` and an ordered page ledger from page 1 through the last page;
- `totalChunks` and a unique ledger entry for every chunk;
- an explicit status for unreadable pages or chunks, including the error;
- every discovered vocabulary candidate with a permanent decision:
  `generate`, `existing`, `filtered` or `rejected`;
- one contextual meaning, stable `senseKey`, `senseDecision` and source-backed
  `senseEvidence` for every candidate;
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

New batches use `chatgpt-vocabulary-batch-v2` and must match a version-2
manifest. Version-1 batches remain compatible only with version-1 manifests.
Each batch must include:

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
2. construct the source ledger, deterministic candidate inventory, two-pass
   chunk assessment and omission audits before lesson generation;
3. show page/source-unit/chunk coverage, inventory totals and exact decision
   counts, including exclusions and attention items;
4. generate all policy-eligible candidates without asking for approval after
   the learner has claimed the import; ask only for unresolved exceptions;
5. use the manifest and batch runtime contracts in
   `packages/backend/src/services/content-pack-contract.ts`;
6. preserve different contextual senses of the same spelling as separate
   candidates and merge only term-and-sense duplicates;
7. derive evidence only from recorded occurrences and validate files with
   `yarn content-packs:validate <directory>` before writing
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
