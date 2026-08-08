# ChatGPT versus Gemini benchmark

Use the immutable BASE-01 gold sources and answers for both providers. Do not edit gold answers after seeing provider output. Copy `provider-results.template.json`, add each case's `gold`, `chatgpt` and `gemini` results, then run:

```bash
yarn benchmark:providers results.json report.json
```

Candidate identity is `term|senseKey`. Each provider result records candidates, schema validity, 1–5 Tamil semantic and naturalness ratings, completion seconds, user-effort minutes and actual Gemini cost. Reviewers must be blind to provider for Tamil scoring. Publish the input and generated report together.

Gemini remains experimental and review-required until every aggregate release threshold is agreed and met. Missing live provider credentials or an unexecuted case is a failed rollout gate, never a zero score or inferred pass.
