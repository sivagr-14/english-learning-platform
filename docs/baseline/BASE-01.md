# BASE-01 reproducible baseline

This directory records the privacy-safe baseline required before provider-neutral or Gemini work starts. It does not alter application data.

## Prepare the gold corpus

```bash
node scripts/baseline/build-gold-corpus.js
node scripts/baseline/validate-gold-corpus.js
```

The builder creates deterministic TXT, PDF, DOCX, EPUB and SRT fixtures under `test/fixtures/gold-corpus/generated/`. Generated files contain only fictional text. The validator checks fixture hashes, locators, permanent candidate decisions, contextual senses and Tamil expectations against `expectations.json`.

## Target-Mac environment record

Run on the Mac that hosts the application:

```bash
node --version
npm --version
npx --yes yarn@1.22.22 --version
git rev-parse HEAD
docker version
docker compose version
npx --yes yarn@1.22.22 app:doctor
```

Copy `results.template.json` to an untracked working file named `results.local.json`. Record exact versions and one `pass`, `fail`, `blocked`, or `not_run` result for every flow. Never add credentials, personal content, database dumps, access tokens, or `results.local.json` to Git.

## Reproducible flow checks

Use a dedicated test account and the gold fixtures. Do not edit production rows to manufacture a pass.

1. Start: open `http://localhost:3000`, select **Validate and start app**, and record frontend/backend status.
2. Readiness: confirm `/health`, PostgreSQL, and Redis from `app:doctor`.
3. ChatGPT: sync a gold manifest, claim it in **ChatGPT Imports**, deliver its planned batch, verify the PostgreSQL read-back, and record the manifest/batch IDs (not credentials).
4. Upload: upload each generated fixture in the import page and record whether extraction/assessment reaches its expected terminal or attention state.
5. Worker: confirm a queued upload is processed by the worker and record queue state transitions.
6. Search: search for the imported test term and confirm the demonstrated contextual sense.
7. Categories: confirm the entry appears at its expected Domain → Usage Group → Specific Category path.
8. Flashcards: confirm a review card is readable and one test review persists after refresh.

Clean up only the dedicated test account/data through normal application behavior. Preserve failures exactly as observed.

## Baseline metrics

For each provider/run, record candidate precision/recall, multi-word recall, contextual-sense accuracy, Tamil semantic accuracy, schema compliance, completion time, user interventions and provider cost. `null` means not measured; it must never be presented as zero.

