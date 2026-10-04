# First 400-entry pilot — Mastery Skills

Status: generation plan, not a generated or imported collection. The current account's collection request is required before final selection and sense allocation. No learner baseline was supplied with this change.

## Scope and allocation

One visible pack contains 400 distinct, useful senses, delivered through four independently validated units of 100 (or eight of 50 if editorial complexity warrants it). These are provisional allocations, not permission to pad categories. Replace rejected candidates with independently qualified alternatives before freezing the manifest. If fewer than 400 qualify, report the shortfall and expand assessment; never lower the bar.

| Communication need | Planned entries | Example selection anchors, subject to deduplication |
| --- | ---: | --- |
| Decisions, reasoning and prioritisation | 50 | trade-off, rationale, principle, weigh up, take precedence |
| Strategy, planning and alignment | 50 | strategy, align on, scope, in the long run, way forward |
| Progress, setbacks and responsibility | 50 | on track, bump in the road, follow through, take ownership, fall behind |
| Meetings, clarification and tactful disagreement | 50 | walk through, to clarify, raise a concern, fair point, push back |
| Official writing, requests and follow-up | 50 | with regard to, for your reference, subject to, follow up, at your earliest convenience |
| Linking, qualification and emphasis | 50 | nevertheless, given that, even so, in particular, provided that |
| Everyday conversation and relationships | 50 | catch up, make sense, count on, get along, come across |
| Natural reactions, useful idioms and phrasal verbs | 50 | a relief, turn out, take it in stride, on the same page, figure out |
| **Total** | **400** | **A sense is counted once even when assigned to several categories.** |

The first five groups provide 250 entries in workplace communication. Technical nouns such as API are not the focus. All entry types are eligible: individual words, phrases, phrasal verbs, idioms, expressions and connectors. Map them to the existing 500-category catalogue; these eight planning groups do not replace it. The pilot cannot cover every category. Subsequent packs follow the measured coverage gaps.

## Selection and identity

1. Export Coverage & Collection → Prepare collection request for ChatGPT from the actual account. Review the existing-sense inventory and category keys. Treat existing entries needing correction separately from 400 new senses.
2. Assess each proposed sense for practical reuse, naturalness, contemporary use, contextual distinctness, register, level and suitability for conversation or useful writing. The current contract supports B1–C2. Foundational A1–A2 coverage requires a separate contract expansion; do not relabel easy senses to force them into this pilot.
3. Use high/medium-frequency senses with defensible evidence. A generated dialogue demonstrates usage, not corpus frequency. Record uncertainty and hold doubtful candidates for review. Exclude archaic/rare senses, arbitrary word sequences, obscure regional idioms, duplicates, proper names and specialist-only jargon. Label common regional alternatives explicitly.
4. Keep another meaning of the same word as a separate entry with a stable sense key and permanent sense rank. Same meaning in another setting is an example or category assignment, not an extra counted entry. Never renumber existing senses.
5. Complete the topic coverage assessment, record exclusions, validate and freeze the manifest before lesson generation. Preserve immutable candidate membership and evidence provenance throughout retries.

## Every lesson must pass all eight sections

| Section | Acceptance requirement |
| --- | --- |
| Overview | Accurate meaning type, connotation, tone and register for this sense |
| Meaning in Context | Honest source/scenario provenance, precise meaning and plain-English explanation; accurate Tamil support |
| Usage Guide | Specific situations to use it and realistic situations where it sounds wrong or too formal |
| Patterns & Collocations | One reusable grammatical frame and at least two natural collocations; correct prepositions and complements |
| Natural Examples | At least two distinct contexts and a short conversation whose response makes the intended meaning clear |
| Mistakes & Differences | A plausible error, its correction and a precise comparison with a confusable alternative |
| Memory & Practice | A brief retrieval cue, contextual memory sentence, recall prompt, meaningful recognition task and personal production task |
| Advanced Nuance | A genuine distinction in implication, politeness, grammar or register without mixing separate senses |

Keep the quick lesson immediately understandable, with deeper detail available in the full lesson. Avoid repetitive boilerplate, circular definitions and recognition questions that reveal their own answer. Use concise explanations rather than removing sections to fit output limits.

## Retention and release

Use the existing spaced review and five-skill practice flow: retrieve the meaning before revealing it, choose between plausible usages, complete a reusable pattern, say a new response aloud and reuse the sense in a later mixed-context session. Self-recording and synthetic audio are practice aids; do not present them as certified pronunciation assessment. Space learning across days; a 400-entry delivery is not a one-day learning assignment.

For every unit: validate structure and taxonomy, inspect sense overlap, review English/Tamil accuracy and teaching usefulness, repair failed entries, then import idempotently and verify database read-back. Require per-candidate editorial records for all 400, not just a sampled subset. Cross-check all four units for repetition before marking the pack complete. Structural tests cannot certify naturalness or frequency.

## Scaling after the pilot

At 400 entries per visible pack, 40,000 senses is approximately 100 packs and 80,000 approximately 200. New requests accept a configurable 400–200,000 planning target; vocabulary storage has no matching quota. The upper input bound is a planning guardrail, not a proven capacity guarantee. Existing accepted entries reduce new work only after audit. Preserve the pilot's quality gates for every subsequent pack.

Search runs on the server with bounded result pages and existing PostgreSQL trigram indexes; the browser does not download the collection. Live search waits 250 ms after typing and cancels obsolete responses. Matching options distinguish meaning/category search from prefix, suffix, substring, exact and all-parts expression search. SQL wildcard characters are literal input. The expanded database smoke check uses 80,000 synthetic entries; it is a functional capacity check, not a production latency benchmark. Measure real query plans and p95 latency before promising speed under concurrent workloads, especially short queries and deep pages.

Generate a new versioned collection index with `yarn collection:plan <collection-id> <output.json> <manifest.json> --target-senses=80000`. Omitting the flag preserves the old policy for existing callers and immutable hashes. Targets never manufacture candidates or truncate valid assessed manifests.
