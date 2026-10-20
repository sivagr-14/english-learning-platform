# WordUp learning experience checkpoint

Updated 2026-10-20. Status: IN DEVELOPMENT, not complete or release-ready.

## Scope and baseline
PRs #120 and #121 merged. Continue feature/wordup-learning-experience, checking current main first. Deliver one cohesive review PR, not small increments described as a complete app. Follow AGENTS.md and delivery evidence gate. Never weaken checks.

Preserve eight simplified-v2 sections: Overview; Meaning in Context; Usage Guide; Patterns & Collocations; Natural Examples; Mistakes & Differences; Memory & Practice; Advanced Nuance.
WordUp scope: B1/B2/C1 high/medium usage by contextual sense. Rank is not CEFR evidence. Existing global content policy must not be silently changed. Preserve Tamil and original data. No active in-app AI provider; guided practice and ChatGPT handoff are custom alternatives.

## Implemented foundation, verification pending
- Migration 10004: account-scoped vocabulary_learner_state and vocabulary_preferences.
- Personal familiarity, general note, accent/Tamil/theme preferences endpoints.
- Knowledge Map search, status filters, separate known and reviewed proficiency counts.
- Starting learning creates a due card while preserving reviewed schedules.
- Known familiarity does not invent correct reviews; unreviewed known items are excluded from automatic introduction.

## Next work (all pending)
1. Inspect/typecheck backend changes; add integration checks for account isolation, notes-only update preservation, known-before-queue, learning-after-known, reviewed schedule preservation, map filters and preference validation.
2. Build cohesive responsive learning home, focused Discover flow, dense knowledge grid and searchable filtered map.
3. Integrate personal controls and notes into word detail, with all eight custom sections discoverable and readable.
4. Add settings UI, apply pronunciation accent/Tamil/theme; reuse existing goals, favorites/categories and progress.
5. Connect guided reading/writing/speaking practice and query parameters; explicitly explain synthetic audio and no automated pronunciation scoring.
6. Run frontend type/build, meaningful Playwright flows and backend PostgreSQL smoke/CI checks. Record actual outcomes; unrun is not pass.
7. Add delivery evidence with changed validation paths, a feature parity/customization/gap matrix and consolidated draft PR.
8. Complete remaining agreed features and data work before claiming full delivery. Do not silently defer missing features merely to close the checklist.

## Data status
Original SQLite 42,200 rows: 34,004 words and 8,196 expressions. No CEFR or verified usage frequency, full lessons or media assets. 277 records need identity review; 226 template/numeric expressions flagged. Assessment copy has source-preserving tables but ZERO final semantic decisions; it is not the first app version.
Original Library ID: libfile_9bfe041b74c8819188c546daa0cb6b73.
Assessment copy: libfile_fb0dacc499688191a0b139358e2f7764.
Do not upload raw private databases to the repo. Use canonical immutable content-pack workflow; local backend owns PostgreSQL writes.
Resolve remaining parity items explicitly: per-sense pictures/media, source semantic catalogue, reminders/push, native sync and AI conversation alternatives.

## Resume
Local partial source: /workspace/scratch/b87cf1243614/app-work. Frontend dependencies installed locally; no full backend checkout. Local route flashcards.ts may predate remote change: read branch version before editing. Local source database: /workspace/scratch/b87cf1243614/upload/wordup_database.sqlite.
Hourly automation Complete WordUp app continues substantive work, checkpoints to this branch and stops on verified completion or reported unrecoverable blocker. Capacity exhaustion is resumable. Reconcile remote receipts; do not overwrite concurrent work.
