# Vocabulary workflows and operations runbook

This runbook covers the two supported workflows. Changing language rules remain in [ChatGPT content-pack workflow](CHATGPT_CONTENT_PACK_WORKFLOW.md) and `chatgpt-sources/02-VOCABULARY_GENERATION_INSTRUCTIONS.md`; this document links to them instead of duplicating them.

## Initial setup

1. Install Docker Desktop and Node.js 20 or newer.
2. On `main`, run `npx --yes yarn@1.22.22 app:install` once. Open `http://localhost:3000` and select **Update from GitHub & start**.
3. The control process creates `.env.local` from `.env.example` and generates a local JWT secret. Never commit `.env.local`, API keys, database dumps or personal source files.
4. Create or sign in to the local learner account. **Update & restart** verifies PostgreSQL, Redis, migrations, backend, frontend and worker.

## Choose one of exactly two workflows

Open **Import content**.

### ChatGPT content pack

- Cost: the ChatGPT conversation workflow needs no API key in this app.
- Privacy: GitHub transports validated JSON on private `chatgpt-content-inbox`; PostgreSQL credentials and exports never leave the Mac.
- Use: follow the governing workflow, open **ChatGPT Imports**, and select **Sync ChatGPT content** once. The app claims, imports, verifies and cleans up automatically. Only failed, incomplete or resumable work remains in the active ledger. Search the saved word and open Flashcards after the sync succeeds.
- Cleanup happens only after every batch and database row reconciles. Git history and the local ledger remain the audit trail.

### Gemini API

- Cost: requests are metered; warning/hard budgets apply per job.
- Privacy: source segments and prompts go to configured Gemini models.
- Setup: set `GEMINI_ENABLED=true` and `GEMINI_API_KEY=...` (or `PRIMARY_AI_API_KEY`) in `.env.local`, restart, then use **Test connection**.
- Paste text or upload TXT, MD, HTML, VTT, PDF, SRT, DOCX or EPUB (25 MB maximum). Resolve unreadable/ambiguous items in **Candidate review**, then **Resume generation**.
- Roll back by setting `GEMINI_ENABLED=false` and restarting. ChatGPT stays usable. An existing job retains its immutable provider; switching starts a new job.

## Retry, resume and completion

- Temporary timeouts, 429 and 5xx errors retry at most three times with stored attempts. Authentication and contract failures need correction.
- Cancellation does not delete committed entries. Refresh/restart reconstructs work from durable ledgers.
- **Completed/Done** requires all source units, candidates, senses, batches and read-back rows to reconcile with no unresolved attention item.

## Update and Restart

Check out clean `main`, then select **Update & restart**. It fetches `origin/main` with safe fast-forward only, verifies PostgreSQL/Redis, backs up PostgreSQL before code changes, installs locked dependencies, stops services, applies/verifies migrations, synchronizes content, restarts backend/frontend/worker and verifies readiness.

On failure, the control page names the exact stage and safe recovery. It performs no destructive rollback. Fix the stage, keep `main` clean and choose **Retry update & start**. Active durable jobs resume when the worker reconnects.

## Backups and logs

- Update backups are local `backups/english-learning-<timestamp>.dump` files.
- Restore only after stopping the app and making another backup: `docker exec -i english_learning_postgres pg_restore -U postgres -d english_learning --clean --if-exists < backup.dump`. This is destructive; verify the exact file first.
- Use **Startup details**, `docker compose ps --all`, and `docker compose logs --no-color --tail 100 postgres redis`.
- Migration state: `npx --yes yarn@1.22.22 db:status`.

## Validation and release evidence

```bash
npx --yes yarn@1.22.22 validate
npx --yes yarn@1.22.22 test:phase4
npx --yes yarn@1.22.22 test:e2e
```

Full Playwright release runs use real PostgreSQL/Redis, a disposable learner and sanitized fixtures. Screenshots, traces and HTML reports go under `test-results/`. Follow `docs/benchmark/README.md`; Gemini stays experimental/review-required until published live results meet agreed quality, Tamil and cost thresholds.

## Recovery map

| Symptom | Safe action |
|---|---|
| PostgreSQL/Redis unavailable | Start Docker Desktop, inspect container logs, retry. |
| Worker unavailable | Use **Restart current**; queued work remains durable. |
| Gemini disabled/key missing | Correct `.env.local`, restart, then **Test connection**. |
| Attention required | Resolve every candidate and resume. |
| Duplicate delivery | Identical content is a no-op; changed immutable content needs a new ID/job. |
| Update cannot fast-forward | Do not force/reset. Preserve local commits separately, return to clean `main`, retry. |
| Migration failure | Preserve backup/logs and correct the migration before retrying. |
