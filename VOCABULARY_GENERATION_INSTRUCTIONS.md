# Vocabulary Lesson Generation Contract

For source assessment, page/chunk accounting, GitHub transport, automatic
selection and batch rules, first follow `docs/CHATGPT_CONTENT_PACK_WORKFLOW.md`.
This file defines the lesson payload inside each selected content-pack batch.

Use this contract for every vocabulary entry, whether it is new or an update.

The ChatGPT manifest and batch contract is the sole supported vocabulary
generation path. The local application validates, deduplicates, imports,
verifies and cleans content packs; it does not call Gemini, Ollama or another
local-AI provider for discovery or lesson generation.

## Default automatic selection

Generate every valid new heavy/high- and medium-frequency candidate
automatically. The authenticated backend assigns ownership and imports valid
batches without a learner claim or approval step.
Exclude low-frequency terms, proper names, extraction/OCR noise, malformed
tokens, exact duplicates and already-complete entries, and record a reason for
every exclusion. Retry ambiguous candidate-level material and quarantine it
with a reason after bounded retries; continue all other candidates. Stop on an
unreadable source unit because exhaustive coverage cannot be claimed.

Here, an exact duplicate means the same normalized term and the same contextual
sense. Same spelling with a different meaning is not a duplicate.

Candidate assessment uses bounded groups of 50–100 unresolved candidates.
Complete lesson generation uses adaptive batches of 5–10 entries, normally 8.
These are per-operation safety bounds, not limits on the total import. The
backend policy and stored import snapshot remain the source of truth.

These group sizes are processing bounds, not discovery targets or total caps.
For large pasted content or files, continue through every declared source unit
and chunk. Discovery must cover both single words and multi-word expressions,
and every discovered item must remain in the candidate ledger even when it is
later classified as existing, filtered or rejected. Genuinely ambiguous senses remain represented with `senseDecision: ambiguous`.
After bounded contextual retries, set the candidate decision to `filtered` with
reason code `ambiguous_context`, then continue automatically without user input.

Candidate totals must never be selected in advance. A result such as 40, 72,
100 or any other convenient total is valid only when it emerges from a complete
inventory-to-decision reconciliation. Previously generated cards are checked
as `existing`; they do not reduce how thoroughly the source is rescanned.

For each sentence, first account for every lexical token/lemma. Seed multi-word
units only from high-confidence phrase evidence; arbitrary adjacent word windows
are not semantic candidates. Then independently scan every immutable original
sentence recall unit and promote every missed B2-C2 word or useful expression
before lesson generation. Each lexical item and recall finding must link to a
candidate or have a specific exclusion code. Do not infer completeness from the
number of generated lessons or from the deterministic phrase seed.
This sentence-level rescan is the independent blind recall pass required for
exhaustive discovery.

If the learner supplies a word or expression list with the complete source,
treat those items as required seed candidates and use the source to resolve
their demonstrated contextual senses. Unless the learner explicitly says
**generate only these supplied items**, continue the complete discovery and
blind recall passes and add other eligible candidates. Supplied-items-only mode
is intentionally scoped and must never be reported as exhaustive source
discovery. Report any supplied item that is absent from the source or lacks
enough context rather than inventing a meaning.

For a large request whose manifest is not yet frozen, process one immutable
semantic group at a time (at most 100 proposed candidates), scan every sentence
recall unit assigned to it, validate and deliver its assessment checkpoint, then
immediately repeat remote discovery and process the next missing group in the
same invocation. Do not stop after a successful group or wait for a learner
message. A checkpoint is durable assessment evidence, not a lesson
batch and not permission to generate early. Freeze the complete manifest only
after every planned group and proposed candidate reconciles with zero untracked
items. A repeated spelling may produce multiple checkpoint decisions only when
each has a different contextual `senseKey`; every stored occurrence must belong
to exactly one of those decisions. At each checkpoint boundary, an in-chat scheduled task reads the durable receipts
and continues the next missing group automatically. Report `Continue assessment <requestId>` only as a manual recovery fallback.

For a large frozen plan, generate one immutable batch of five to ten lessons at
a time. Validate, deliver and remotely verify that batch, then immediately
rediscover receipts and generate the next missing batch in the same invocation.
Treat the invocation as a drain loop: a successful batch never waits for
approval, confirmation or a `continue` message. When a ChatGPT run must end,
stop only at a batch boundary and report the manifest ID, planned, received and
missing batch numbers, and the exact next batch. A continuation must use the
original manifest hash, candidate IDs, batch number and batch ID; it must not
rediscover the source or regenerate already delivered batches.

At the start of every generation run, inspect the remote manifest folder and
derive the first missing planned batch from its immutable receipts. Preserve all
valid delivered batches, ignore superseded manifests, and process consecutive
missing batches without asking the learner for approval or confirmation. After
an interruption, repeat remote discovery instead of relying on the last batch
number remembered in the conversation. Do not generate any batch until the
remote manifest has passed the exact production validator and its accepted hash
matches the batch plan.

The assessed term remains in dictionary form while exact immutable evidence may
contain a grammatical inflection. A lesson is source-backed when the evidence
contains the same ordered expression with a valid inflection, for example
`grow up with`, `grew up with`, `growing up with` or `grown up with`. Never
rewrite the evidence sentence merely to insert the dictionary form.

## Contextual sense identity

Generate one entry for exactly one meaning demonstrated by the supplied
content. Determine that meaning from the complete source sentence, surrounding
paragraph or dialogue, grammatical role, topic and situation. Do not add other
dictionary meanings merely because the spelling can have them.

For every candidate, provide:

- `contextualMeaning`: the exact English meaning taught by the entry;
- `senseKey`: a short, stable semantic identity such as
  `financial-institution` or `land-beside-river`;
- `senseDecision`: `same_sense`, `new_sense` or `ambiguous`; and
- `senseEvidence.sentence` and `senseEvidence.explanation` showing why that
  meaning applies in the source.

### Exact evidence derivation

`senseEvidence.sentence` must be selected directly from the candidate's stored
source occurrences. Do not paraphrase or generate it separately. The lesson
`source_sentence` must copy the identical stored sentence.

Apply these rules:

- Same normalized term and same contextual meaning: merge the occurrences and
  reuse the existing sense.
- Same normalized term but genuinely different contextual meaning: keep a
  separate candidate; never filter it as a spelling duplicate.
- Uncertain meaning or uncertain distinction: retry using the stored sentence
  and surrounding context. If still unresolved, mark `ambiguous`, set decision
  `filtered` with reason code `ambiguous_context`, and continue; never guess.
- Frequency is assessed per sense. A common meaning and a rare meaning of the
  same word may receive different decisions.
- `englishMeaning` and `lesson.meaning_in_context.contextual_meaning` must equal
  the assessed `contextualMeaning`. The lesson source sentence must equal the
  recorded sense-evidence sentence.

Always put the real unsuffixed term in `term` and `word`, for example `bank`.
Never generate `bank (A)`, `bank (B)` or `bank-B`. The app stores a permanent
sense rank and derives the visible label:

```text
rank 1 -> bank
rank 2 -> bank (B)
rank 3 -> bank (C)
rank 4 -> bank (D)
rank 5 -> bank (E)
...
rank 26 -> bank (Z)
rank 27 -> bank (AA)
```

Existing unsuffixed entries are internally sense A/rank 1, but `(A)` is never
displayed. Later ranks are permanent: deleting `(B)` must not rename `(C)` or
permit the next sense to reuse B.

## Required three-level categorization

Categorize the assessed contextual sense, not the spelling alone. Every
generated candidate in a new import must select exactly one active path from
the application catalogue:

```text
Domain -> Usage group -> Specific category
```

Write all of these fields into the v5 manifest candidate:

- `taxonomy.taxonomyVersion`
- `taxonomy.domainKey`
- `taxonomy.usageGroupKey`
- `taxonomy.categoryKey`
- `taxonomy.confidence`: `high`, `medium` or `low`
- `taxonomy.reason` when confidence is low

`categoryName` must equal the selected specific category's catalogue name.
Use only stable keys from
`packages/backend/src/data/vocabulary-taxonomy.ts`. Never invent, rename or
silently approximate a system key. If no path fits after bounded retries, filter the candidate with reason code
`taxonomy_unresolved`, record the proposed catalogue addition separately, and
continue without learner intervention.

Examples:

```text
check in (airline baggage)
Travel -> Airports & Flights -> Check-in and baggage

check in (contact a manager)
Work -> Meetings & Collaboration -> Progress updates
```

Personal categories remain optional learner-managed links. They never replace
the required system taxonomy path.

## Core rule

Generate exactly eight complete learning sections. Every value must teach
something specific about the target word or expression. The app must reject the
entry instead of saving partial, vague, generic, or placeholder content.

Every section must remain inside the single assessed contextual sense. A short
contrast with another sense is allowed only under Mistakes & Differences when
it prevents confusion; it must not turn the lesson into a multi-meaning entry.

Never use filler such as:

- `TODO`, `TBD`, `placeholder`, `coming soon`, `not added`, `not set` or `N/A`
- “Use it when appropriate”
- “It depends on the context”
- “This is a useful/common word”
- “It can be used in many situations/various contexts”

Do not create facts merely to fill a field. Research or regenerate the lesson
when a section is weak.

## Required entry header

Keep these fields at the entry/header level:

- `word`
- `pronunciation`
- `word_type`
- `item_type`
- `cefr_level`
- `frequency`
- `domain`
- `usage_group`
- `specific_category`
- stable taxonomy keys and taxonomy version
- `english_meaning`
- `tamil_meaning`
- `core_idea`

## Required lesson format

Set `format_version` to `simplified-v2` and populate all eight sections:

1. **Overview**
   - `meaning_usage_profile.meaning_type`
   - `meaning_usage_profile.connotation`
   - `meaning_usage_profile.tone`
   - `meaning_usage_profile.register`
2. **Meaning in Context**
   - `source_sentence`
   - `contextual_meaning`
   - `simple_explanation`
3. **Usage Guide**
   - `when_to_use`
   - `when_not_to_use`
4. **Patterns & Collocations**
   - `main_pattern`
   - `common_collocations` with at least two useful items
5. **Natural Examples**
   - `examples` with at least two different natural contexts
   - `mini_conversation`
6. **Mistakes & Differences**
   - `common_mistake`
   - `correction`
   - `important_difference`
7. **Memory & Practice**
   - `memory_trigger`
   - `memory_sentence`
   - `recall_question`
   - `recognition_task`
   - `production_task`
8. **Advanced Nuance**
   - `advanced_nuance` with at least one genuine, term-specific distinction

The Overview profile must contain only Meaning type, Connotation, Tone and
Register. Do not recreate the older usage-zone, domain, word-nature or
frequency-by-context sections.

## Quality requirements

- All eight sections are mandatory, including Advanced Nuance.
- No string, list, object, or nested value may be empty.
- Every explanation must be concrete and specific to the target term.
- Every explanation, example, collocation, practice item and nuance must fit
  the one assessed contextual meaning.
- The source sentence, main pattern and memory sentence must use the term.
- At least two natural examples must use the term.
- The mistake or correction must demonstrate the term.
- Advanced Nuance must name and explain the term, not provide general advice.
- Examples must be natural and meaningfully different from one another.
- Tamil is selective: use it in the header meaning when it improves clarity.
- If a generated lesson fails any rule, regenerate or hold it for manual
  review. Never save the incomplete version.

## Meaning & Usage Profile

Use only these four items:

- **Meaning type:** literal, abstract, figurative, idiomatic, technical, or a
  useful combination
- **Connotation:** positive, negative, neutral, mixed, or context-dependent
- **Tone:** the speaker’s relevant attitude, such as serious, friendly, polite,
  critical, humorous, reflective or forceful
- **Register:** informal, neutral, formal, professional or academic as
  applicable

Do not list every possible label. State only the values that actually apply and
briefly explain important context.

## Update behavior

When an entry already exists:

1. Validate the complete replacement lesson against this contract.
2. Reject the update if any section is incomplete or generic.
3. Replace all eight lesson sections together in one transaction.
4. Preserve the learner’s review history and mastery progress.
5. Record a new entry version so the earlier lesson remains auditable.
6. Preserve or replace its taxonomy only with one complete, catalogue-valid
   domain, usage-group and specific-category path.

Starter samples follow the same rules. Increasing the starter sample version
must cause already-loaded samples to refresh through this validation gate.
