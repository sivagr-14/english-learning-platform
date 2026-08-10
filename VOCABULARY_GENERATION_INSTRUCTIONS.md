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
later classified as existing, filtered or rejected. Genuinely ambiguous senses
remain represented through the contract's attention-required sense state, not
through a provider-specific candidate-decision value.

Candidate totals must never be selected in advance. A result such as 40, 72,
100 or any other convenient total is valid only when it emerges from a complete
inventory-to-decision reconciliation. Previously generated cards are checked
as `existing`; they do not reduce how thoroughly the source is rescanned.

For each sentence, first account for every lexical token/lemma, then separately
discover multi-word units. Each inventory item must link to a candidate or have
a specific exclusion code. After both passes, perform an independent blind recall pass
over the original source and add every missed B2-C2 word or useful
expression before lesson generation. Do not infer completeness from the number
of generated lessons.

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
- Uncertain meaning or uncertain distinction: mark `ambiguous` and hold it for
  attention; never guess.
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
silently approximate a system key. If no path fits, hold the candidate for
attention and propose a catalogue addition separately.

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
