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

1. The learner pastes text or attaches a supported TXT, MD, PDF, DOCX, EPUB,
   HTML, SRT or VTT file in ChatGPT.
2. ChatGPT creates a byte-exact source snapshot, reads every source unit and
   divides the source into traceable chunks.
3. ChatGPT creates an immutable assessment manifest on the private
   `chatgpt-content-inbox` branch.
4. The Mac fetches that branch automatically every five minutes. Loading any
   authenticated app page also starts synchronization immediately.
5. The backend atomically assigns each unowned manifest to the signed-in local
   account, schedules every eligible candidate and imports every available valid
   batch. No claim or approval action is shown to the learner.
6. ChatGPT generates complete lessons in deterministic cycles of at most 100
   and writes each cycle to the same inbox branch. Plans above 100 use the
   fewest balanced 50–100-entry cycles, grouped into at most five automatic
   execution waves.
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

## App-first source preparation

Pasted text and supported files must be prepared in the app before a new
content-pack assessment begins. Do not ask ChatGPT to reconstruct deterministic
inventory from the original attachment alone.

1. Open **ChatGPT Imports** and paste text or select TXT, MD, PDF, DOCX, EPUB,
   HTML, SRT or VTT.
2. Select **Prepare for ChatGPT**.
3. The backend immediately creates a durable background preparation job, displays
   its current stage, and safely resumes queued or interrupted work. Only after the
   backend reports zero untracked readable units and words does it download one
   immutable `chatgpt-assessment-request-v1` JSON file.
4. Attach that JSON file in ChatGPT and write **Generate**.
5. ChatGPT uses the embedded source units, bounded chunks, inventory hash,
   taxonomy snapshot and existing-vocabulary matches. It fetches the current
   contract through the connected GitHub App and delivers the manifest and
   batches to `chatgpt-content-inbox`.
6. Repository CI validates the delivered pack. The local backend remains the
   only process that verifies PostgreSQL and writes learning rows.

For continuation, use the original request, manifest ID and missing-batch
identities. Never upload the original source again to rediscover a smaller
subset. The source request contains no PostgreSQL credential or database
export—only the minimum matching vocabulary fields required for deduplication.

## Manifest guarantees

New exhaustive imports use `chatgpt-vocabulary-manifest-v5`.
`chatgpt-vocabulary-manifest-v1`, `chatgpt-vocabulary-manifest-v2` and
`chatgpt-vocabulary-manifest-v3` remain readable so immutable already-delivered
imports can finish. Version 5 must include:

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
  once into cycles of one to 100.

The app rejects a manifest when a page, chunk, candidate, count or planned batch
is missing, duplicated or inconsistent. An unreadable page is never silently
treated as assessed.

Candidate identity is `normalized term + contextual sense`, not spelling alone.
Repeated occurrences with the same meaning are merged. Repeated spelling with
a genuinely different meaning remains a separate candidate. Ambiguous meanings are never guessed. After bounded contextual retries, they are recorded as `filtered` with reason code `ambiguous_context` and processing continues automatically.

## Batch guarantees

New batches use `chatgpt-vocabulary-batch-v5` and must match a version-5
manifest. Version-1 through version-4 batches remain compatible only
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

New manifests use taxonomy `2026.2`, containing 22 domains, 88 usage groups and 440 specific
learning categories. Existing `2026.1` manifests remain compatible with their
15 domains, 60 usage groups and 300 specific learning categories. ChatGPT must classify each generated contextual sense by
choosing one exact chain:

```text
domainKey -> usageGroupKey -> categoryKey
```

The backend rejects a v5 manifest when a key is unknown, inactive, belongs to a
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
- Pasted text is a first-class source. Feed its exact UTF-8 bytes to the
  deterministic inventory through standard input with source type `text` and a
  stable source name; never ask the learner to attach the same text as a TXT
  file merely to obtain a hash. Do not trim, reflow, repair punctuation or
  normalize line endings before hashing. File inputs are hashed from their
  original bytes before format-specific extraction.
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
- Before semantic filtering, deterministically enumerate every lexical token,
  lemma, high-confidence phrase and exact occurrence. Do not enumerate every
  adjacent 2-5-word window: arbitrary sliding windows are extraction evidence,
  not vocabulary candidates, and create mostly fragments.
- The deterministic inventory is the assessment input, not a suggestion. It
  must contain every non-noise lexical token after documented function-word
  removal. Expression discovery first uses curated patterns, particle patterns
  and repeated corpus evidence. It then independently scans every original
  sentence through an immutable expression-recall unit. A fixed phrase list or
  local heuristic is only a seed and can never define complete expression recall.
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
  stable reason for every decision other than `generate`. After bounded contextual retries, record genuinely ambiguous senses as
  `senseDecision: ambiguous` with candidate decision `filtered` and reason code
  `ambiguous_context`; do not invent a meaning or a new candidate-decision enum value.
- Run a per-chunk omission audit against the deterministic inventory and a final
  source-wide audit for missed advanced words, expressions, repeated spellings
  with different senses and candidates crossing chunk boundaries.
- A second independent recall pass must rescan every immutable sentence recall
  unit without seeing the first pass's chosen candidate list. Reconcile the
  union. Any item found only by the recall pass is promoted to a source-backed
  candidate before finalization; it may never be dropped because it was absent
  from the deterministic phrase seed.
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
- Use one immutable internal cycle for 1–100 lessons. Above 100, use the fewest
  balanced cycles possible, keeping every cycle between 50 and 100 without an
  undersized tail. Expose one to five deterministic execution waves. A wave
  drains all consecutive missing cycles in the same run without confirmation.
  Existing manifests retain their frozen cycle membership and receive only the
  wave overlay, without changing their manifest hash,
  candidate membership, or already received batches.
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

The immutable occurrence binding is authoritative even when the prepared PDF
text contains OCR fragmentation such as `p hysical intima cy`. Lesson-quality
validation must not require a second literal spelling check against that exact
source sentence after the manifest has established the candidate-to-occurrence
link. All generated patterns, examples, memory sentences and nuances still
have to demonstrate the assessed expression. Their matcher accepts documented
English morphology, grammatical person/possessive slots, and a bounded object
or manner phrase in a separable expression. Valid examples include
`bring me into contact with`, `get us back on track`, `shut the discussion down`,
or `worked it out`.
It must reject missing particles, reordered lexical words, negation substituted
for an expression word, unbounded gaps and lexical-prefix lookalikes.

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

For manifest v5 this proof is machine-enforced in `inventoryAudit`. The seed
must be produced first with `yarn content-packs:inventory <source-file>` and
store its source and inventory hashes. Every lexical occurrence must preserve
its detector, page, chunk, sentence and offsets. Each occurrence has exactly
one allow-listed disposition. `verified_existing` requires the PostgreSQL word
identity; `subsumed_by_expression` requires the selected expression candidate.
The blind recall pass stores every finding and links it back to a deterministic
occurrence. `counts.untracked` and unresolved findings must be zero before the
ledger is frozen. A hand-selected candidate list or self-declared empty audit
cannot satisfy v5.

Historical compatibility remains explicit: A v4 manifest without this proof is invalid.

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
- hold unreadable source material for attention; for an ambiguous candidate,
  retry with its stored sentence and surrounding context, then record it as
  `filtered` with reason code `ambiguous_context` and continue automatically;
- assess unresolved candidates in bounded groups of 50–100; this is a
  per-operation processing bound and never a total limit;
- generate 1–100 lessons in one cycle; for larger plans, use the fewest
  balanced 50–100-entry cycles and at most five contiguous execution waves;
- validate and durably deliver each cycle, then immediately continue through
  the next missing cycle and wave without confirmation; retry temporary
  failures up to three times and require PostgreSQL read-back verification.

## Required ChatGPT behavior

When asked to process a source for this application, ChatGPT must:

1. inspect the complete source and build the deterministic inventory before
   proposing entries;
2. show source-unit, page, chunk, occurrence, detector and decision counts;
3. generate all policy-eligible candidates without asking for claim or approval;
   automatically filter unresolved ambiguous candidates after bounded retries;
4. use the manifest and batch runtime contracts in
   `packages/backend/src/services/content-pack-contract.ts`;
5. preserve different contextual senses of the same spelling as separate
   candidates and merge only term-and-sense duplicates;
6. select one controlled domain, usage group and specific category for every
   generated contextual sense;
7. validate files with `yarn content-packs:validate <directory>` before writing
   them to the inbox branch;
8. build attachment inventories with
   `yarn content-packs:inventory <source-file> [source-type]`, or pipe exact
   pasted content to
   `yarn content-packs:inventory - text <stable-source-name>`;
9. never place an OpenAI API key, PostgreSQL credential or personal database
   export in GitHub; and
10. report unreadable source areas, aggregate ambiguous-context exclusions,
   rejected batches and missing planned batches without pausing for candidate-level ambiguity.

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

An ambiguity blocks completion only during its bounded retry window. If it remains
unresolved, it is deliberately excluded as `filtered` with reason code
`ambiguous_context`; that fully accounted exclusion does not block **Completed**.

## Inbox cleanup rule

Cleanup is automatic during periodic or manual synchronization, but is allowed
only after the import is completed, every planned batch is present and valid,
the committed count matches the approved count, and every word, lesson,
progress and review row is read back successfully. A guarded Git push prevents
cleanup from overwriting a concurrently delivered pack. Failed cleanup is safe
to retry, and an already-absent folder is recorded without changing PostgreSQL
content.

## Status and recovery guarantees

### Pre-manifest semantic assessment checkpoints

Large prepared requests must not attempt to decide the entire deterministic
inventory in one ChatGPT run. The assessment request contains an immutable
`assessmentPlan` that partitions proposed candidates into ordered groups of at
most 100 and assigns every sentence recall unit to exactly one group. This bound
controls one semantic operation; it never caps total coverage.

For each group, ChatGPT performs the single-word pass, contextual-sense decision
and blind scan of every assigned sentence recall unit, then validates and
delivers one
`chatgpt-semantic-assessment-checkpoint-v1` file under the request's
`assessment-checkpoints/<requestId>/` path. A checkpoint is not an importable
manifest or lesson batch. It is a durable pre-manifest receipt tied to the
immutable request hash, planned group ID and exact proposed candidate IDs.

A continuation reads the existing checkpoint receipts, preserves their hashes
and assesses only missing groups. Reusing a checkpoint identity with changed
content is a conflict. The complete v5 manifest may be frozen only after:

```text
planned assessment groups = valid immutable checkpoints
planned proposed candidates = at least one contextual-sense decision each
every proposed occurrence = exactly one contextual-sense decision
planned sentence recall units = exactly one completed blind scan each
new recall findings = promoted source-backed candidates or explicit exclusions
unresolved recall findings = 0
missing groups, duplicate decisions and untracked candidates = 0
```

One invocation is a drain run, not a one-group run. After delivering a valid
checkpoint, immediately rediscover the remaining receipts and assess the next
missing group in the same invocation. Repeat without an approval, confirmation
or learner message until every group reconciles or the platform ends the run.
If the run ends before all groups finish, stop after the current checkpoint and
report received groups, missing groups and the exact next group. Use
`Continue assessment <requestId>` only as a manual recovery fallback. Do not
restart assessment from group 1, discard completed checkpoints, freeze a partial
manifest or begin lessons. After every checkpoint reconciles, merge the
decisions, run the source-wide audit, freeze the complete v5 manifest and, when
run capacity remains, continue directly into the lesson-batch drain loop.

### Manifest-first incremental delivery

For every large source, freeze, validate and deliver the complete manifest
before generating the first lesson batch. Each valid batch is a separate,
durable receipt and may be delivered in a later ChatGPT turn. Before a run
ends, finish and validate the current batch; never discard already delivered
batches or replace the manifest. The application derives the exact received
and missing batch numbers from immutable receipts and reports:

```text
Manifest: delivered
Planned batches: 84
Received batches: 19
Missing batches: 65
Next batch: 20
State: safely paused — no items lost
```

Continuation must preserve the original manifest ID, manifest hash, candidate
IDs, batch numbers and batch IDs. Generate only the missing planned batches;
never rescan the source, shrink the candidate ledger or create a replacement
manifest merely because a previous ChatGPT run ended. Before every continuation,
read the remote receipts and derive the first missing group or batch; never trust
a conversationally remembered number. Already delivered immutable receipts are
preserved and must not be regenerated.

For unattended no-API-key processing, an in-chat scheduled task returns to the
same conversation and starts one drain run. It reads the durable receipts,
claims the first missing unit, completes and remotely verifies it, then loops
immediately over every consecutive missing assessment group or lesson batch
that fits in that same invocation. A successful unit must never pause merely to
announce progress or await `continue`; progress summaries are non-blocking.
Only an unrecoverable integrity or authorization failure may stop the loop
before the platform boundary. If a run ends, the next scheduled run repeats
remote discovery and resumes from the first still-missing identity. Scheduled
continuation is an hourly recovery watchdog, not a one-unit-per-hour scheduler
or a three- or five-minute worker queue, and remains silent during normal
progress. The app's **Continue import** action is a manual recovery fallback,
not a routine requirement. A provider-backed backend worker is still required
for guaranteed immediate continuation across conversational run boundaries.

Generation must not begin until the exact production validator accepts the
remote manifest and records its hash. A rejected manifest has no valid planned
batches: correct it before generating lessons rather than emitting downstream
"manifest missing" failures. Structural contract failures, lost authorization,
database verification failures and wholly unreadable sources remain blocking
and must be reported.

The production manifest preflight is exhaustive and runs before Batch 1. It
returns all detected schema, provenance, reconciliation, duplicate-sense,
taxonomy, plan-membership and evidence-binding issues in one report. Never
start generation after a partial or fail-fast preflight, and never defer a
known candidate compatibility problem until that candidate's lesson batch.
After preflight records the accepted manifest hash, individual batch validation
must reuse the same source-evidence trust boundary and grammar-aware matcher.

### Learner-supplied vocabulary lists

When the learner supplies a word or expression list together with the complete
source, treat every supplied item as a required seed candidate and resolve only
the contextual sense demonstrated by that source. This improves speed and
reliability for the named items but does not prove source-wide completeness.
Unless the learner explicitly says **generate only these supplied items**, run
the normal deterministic inventory and independent recall pass and add every
other eligible source candidate. In supplied-items-only mode, record the scope
as intentionally restricted and do not claim exhaustive discovery of the
source. A supplied item absent from the source or lacking enough context must
be reported, not assigned an invented meaning.

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
