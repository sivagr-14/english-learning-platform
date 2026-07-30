# Vocabulary Generation Instructions

Use this guide for every vocabulary deck, in any category.

## Core Rule

Generate like `cornerstone`: specific, native-sounding, category-aware, and useful for Tamil speakers. Do not fill sections with generic repeated sentences.

## Header Fields

Keep these at the card/header level only:

- `word`
- `word_type`
- `cefr_level`
- `frequency`
- `english_meaning`
- `extended_meaning`
- `tamil_meaning`
- `core_idea`

Do not repeat these as lesson sections. Do not include pronunciation.

## Required Sections

Use exactly these 17 sections:

1. English Meaning + Recall Meaning
2. Memory Mastery
3. Pattern Family
4. Notice
5. Word Nature
6. Tamil Usage Notes
7. Usage Profile
8. Word Usage Zone
9. Natural Domains
10. Domain Restrictions
11. Common Patterns / Grammar
12. When To Use
13. When NOT To Use
14. Confusion Zone
15. Alternatives & Synonyms
16. Common Mistakes
17. Paragraph-Based Real-Life Conversation / Story

Do not generate `Meaning Layers` or `Practice + Evaluation`.

## Quality Rules

- Every section must be word-specific.
- Do not reuse the same example across different sections unless it is intentionally being corrected.
- Avoid vague filler such as “use it in daily life when the context fits.”
- Write concrete examples tied to the selected category.
- The Tamil notes must explain a real Tamil-speaker mistake or translation trap.
- Common mistakes must include a wrong sentence, a corrected sentence, and a reason.
- Confusion Zone must compare the target word with genuinely similar words.
- Alternatives must be realistic: near synonyms, formal alternatives, and informal alternatives.
- The story must use the word naturally in a realistic situation and show why the word fits.

## Usage Profile Rule

Usage Profile must be a table-like array with this exact column order:

1. `usage_area`
2. `status`
3. `example_sentence`
4. `note`

Include these usage areas when meaningful:

- Literal
- Abstract
- Figurative
- Everyday
- Professional
- Technical
- Academic
- Business
- Formal
- Informal

Each row needs a different example sentence. Do not repeat the same sentence.

## Word Nature Rule

Word Nature must contain:

1. `primary_classification`
2. `reason`

Examples of classifications:

- Mostly Abstract
- Mostly Literal
- Figurative Idiom
- Action Phrasal Verb
- State Word
- Daily-Life Expression
- Practical Noun Phrase

## Tamil Usage Notes Rule

Tamil Usage Notes must contain:

- `correct_tamil_speaker_usage`
- `common_tamil_speaker_mistake`
- `correct_version`
- `translation_trap`
- `thinking_difference`

This section is mandatory and must not be generic.

## Category Awareness

Before generating, decide the category and domain. Examples must match that category.

For Daily Life, examples should involve home, family, routines, errands, money, time, food, cleaning, health, planning, or normal conversation.

For Work & Business, examples should involve meetings, clients, planning, strategy, tasks, deadlines, reporting, leadership, and communication.

For Academic English, examples should involve research, evidence, argument, writing, reading, analysis, and formal discussion.

## Duplicate Avoidance

Before importing, compare against existing words in the target category. Do not add the same word twice in the same category.

Use the app importer’s resolved category + normalized word behavior to update existing entries rather than creating duplicates.
