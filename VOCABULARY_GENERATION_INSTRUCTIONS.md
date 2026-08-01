# Vocabulary Lesson Generation Contract

For source assessment, page/chunk accounting, GitHub transport, approval and
batch rules, first follow `docs/CHATGPT_CONTENT_PACK_WORKFLOW.md`. This file
defines the lesson payload inside each approved content-pack batch.

Use this contract for every vocabulary entry, whether it is new or an update.

## Core rule

Generate exactly eight complete learning sections. Every value must teach
something specific about the target word or expression. The app must reject the
entry instead of saving partial, vague, generic, or placeholder content.

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
- `category`
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

Starter samples follow the same rules. Increasing the starter sample version
must cause already-loaded samples to refresh through this validation gate.
