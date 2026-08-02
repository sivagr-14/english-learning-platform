# Phase 1 changes (bug fixes + wiring up existing infra)

No new dependencies were needed for this phase — `redis` and
`express-rate-limit` were already in `package.json` but unused.

## What changed

1. **Fixed the flashcard N+1 query bug**
   `packages/backend/src/routes/flashcards.ts` — `ensureFlashcards()`
   previously ran two awaited queries *per word* in a sequential loop, so a
   2,000-word import meant ~4,000 Postgres round trips on every single call
   to `GET /categories` or `GET /due`. It's now three fixed batch queries
   regardless of vocabulary size.

2. **Added new-card daily pacing**
   Same function. Previously every imported word became "due" the instant
   it was committed, flooding the review queue on day one. Now only up to
   `NEW_CARDS_PER_DAY` (default 20, configurable via `.env.local`) new words
   are introduced per calendar day; the rest wait their turn. This matches
   standard SRS practice (Anki/SuperMemo).
   - New column: `user_progress.introduced_at` (migration `017`).

3. **Fixed the "again" rating in spaced repetition**
   `flashcards.ts` review handler — a missed card previously got pushed a
   full day out. It now comes back in 10 minutes (same-session relearning),
   which is the actual mechanism that fixes a miss.

4. **Wired up Redis** (`packages/backend/src/utils/redis.ts`, new file)
   Redis was provisioned in `docker-compose.yml` but never connected to
   from application code. It's now used to cache the taxonomy tree query
   (`GET /api/vocabulary/taxonomy`), a 3-way join with per-category word
   counts that was running fresh on every page load. Cache is invalidated
   automatically when new vocabulary commits
   (`content-pack.service.ts` → `cacheInvalidate`).
   Every Redis call degrades gracefully — if Redis is down or was never
   started, the app falls back to querying Postgres directly rather than
   failing the request.

5. **Added rate limiting to the public auth endpoints**
   `packages/backend/src/routes/auth.ts` — `express-rate-limit` was already
   a dependency and already applied to internal `/__control/*` endpoints,
   but `/api/auth/login`, `/api/auth/register`, and
   `/api/auth/magic-link/send` had none, leaving login open to
   brute-force/credential-stuffing attempts.

## To apply locally

```bash
# 1. Pull these files into your working tree (see below for how you're
#    receiving them), then:
npx --yes yarn@1.22.22 install --frozen-lockfile   # no new deps, but safe to re-run
npx --yes yarn@1.22.22 db:migrate                  # applies migration 017
```

Redis and Postgres both need to be running (`docker-compose up -d`) for the
new caching to activate — but again, the app will run fine without it if
Redis isn't up.

## Not included in this phase (next up)

- BullMQ job queue for async content generation (Redis is now connected,
  which is the prerequisite for this)
- In-app file ingestion: PDF/SRT/EPUB/DOCX parsers + OCR fallback
- Gemini API integration for the escalation-routed generation pipeline
  described earlier in this conversation
- Frontend import-progress UI to replace the manual ChatGPT-inbox polling

Recommend tackling those in Claude Code given they need to run against your
actual Docker/Postgres/Redis stack to verify as they're built, rather than
being written blind.
