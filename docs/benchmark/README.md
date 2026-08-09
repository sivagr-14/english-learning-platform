# ChatGPT versus Gemini benchmark

Use the immutable BASE-01 gold sources and answers for both providers. Do not edit gold answers after seeing provider output. Copy `provider-results.template.json`, add each case's immutable source hash, gold answers, ChatGPT result and Gemini result, then run:

```bash
yarn benchmark:providers results.json report.json
```

Each provider run must declare `status: completed`; otherwise the rollout gate is blocked. Candidate identity is normalized `term|senseKey`. Each returned candidate records exact contextual meaning, same/new-sense decision, taxonomy, schema validity and eight-section semantic validity. The run also records blind 1–5 Tamil semantic and naturalness ratings, completion seconds, user-effort minutes and measured cost (`null` when unavailable or not applicable).

Use at least the complete BASE-01 corpus across TXT, PDF, DOCX, EPUB and SRT. Include polysemy, phrasal verbs, idioms, collocations, fixed expressions and difficult Tamil cases. Randomize provider labels before human Tamil and lesson scoring, and retain the blinded score sheet. Do not change gold answers or thresholds after seeing provider output.

The generated report contains per-case scores, provider aggregates and a machine-readable `rolloutGate`. Publish the input, report, exact model and prompt versions, and blinded review evidence together. Never commit credentials or personal source material.

Gemini remains experimental and review-required until every aggregate release threshold is agreed and met. Missing live provider credentials or an unexecuted case is a failed rollout gate, never a zero score or inferred pass.
