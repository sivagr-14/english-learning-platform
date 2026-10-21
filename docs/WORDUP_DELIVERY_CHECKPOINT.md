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

## Continuation 2026-10-20 — UI implementation
- Added /discover with one contextual entry, B1/B2/C1 selector, pronunciation playback, lesson link and saved known/learning choices. Successful saves advance; failures retain the entry and expose Retry.
- Added PersonalLearning on word detail: persisted familiarity and notes, preserving unsaved text on failures and separating notes-only writes from familiarity changes.
- Added Discover navigation, responsive focused-card styling and Knowledge Map search/status controls.
- Frontend TypeScript check passed after all UI edits. Production build passed for the discovery/personal-control changes; map search controls were added during that build, then separately typechecked. Rebuild final combined head before release.
- Added tests/playwright/discovery.spec.ts for failed-save recovery and persisted advancement. Browser test NOT RUN: Chromium download repeatedly returned an empty/corrupt archive; no system browser executable available. This is a recoverable validation gap, not task completion.
- Backend integration, delivery evidence, consolidated draft PR, settings/home redesign and other remaining checklist items are still pending. No merge or local user database update performed.

## Continuation — learning preferences and verification gates
- Reconciled main 0895c87186fb88ae4328ade4397e56b350f55017 and feature head 7218c469d7285d427b7ea5a75202f5d9a1e6b44d. Main is an ancestor; merged #120/#121 are not redone. Local backend changes matched remote apart from whitespace; remote flashcards route restored.
- Added /settings with persisted British/American accent, Tamil visibility and light/dark appearance. Account-scoped preference state ignores stale account responses. Failed loads disable writes; failed saves preserve edits and active settings for retry.
- Applied preferences to browser speech, Discover, map, word-detail Tamil blocks and spaced-review Tamil. Kept all source Tamil and exactly eight custom lesson sections. Updated home links to discovery and map.
- Extended existing smoke-fluency-postgres.ts CI gate with real HTTP/DB checks for account isolation, invalid input, notes-only familiarity preservation, known-before-queue, learning-after-known, unreviewed deferral, reviewed schedule preservation, map scope/status and preference persistence/validation.
- Added Playwright settings tests for failed load/save recovery, persistence after reload, selected speech voice/rate, Tamil visibility and mobile overflow. Added vocabulary-ui job to run discovery/map/settings tests and preserve artifacts.
- Frontend typecheck/build passed for settings/controller/audio before the final home/flashcard adjustments; final combined build rerun pending receipt below. Local Chromium and headless-shell installs both returned corrupt/empty archives, so local browser tests remain unrun; CI is the next verification source.
- Backend tests/integration have not been run locally (partial checkout, no local PostgreSQL service). CI results must be inspected; this is not a pass claim.
- Delivery record added. See docs/WORDUP_FEATURE_PARITY.md for remaining scope. Consolidated draft PR creation pending this checkpoint commit. Do not merge.

## Next continuation
1. Inspect CI for consolidated PR and repair genuine failures without weakening gates; record final head results.
2. Complete dense visual knowledge grid and focused word details, favorites/lists navigation and guided practice query parameters, with meaningful interaction tests.
3. Verify dark-theme contrast and all eight-section/custom-content flows in browser, not just compile.
4. Continue semantic WordUp catalogue assessment, per-sense original pictures/media and explicit parity dependencies. Data assessment remains zero final semantic decisions. Full completion must not be claimed.


## UI-first continuation — 2026-10-20 late-evening Europe/Warsaw
This section supersedes the older task order: COMPLETE UI and deliver for review BEFORE any 42,200-row data work.

Reconciliation: main f76369888298c401806892cc600c5a6e77df3a44 includes merged #120/#121/#122; feature branch was 75d1eafbd554ede0e206ede6d9c495efbc941389. No open PR found at run start. The local directory is a partial source tree, not a git checkout. Existing local UI edits were preserved and compared with main through GitHub App. New commit is based on the main tree, so merged test-selector fixes and backend contracts remain intact.

Saved UI implementation:
- Centered 700px responsive purple canvas, toolbar, modal drawer with keyboard focus restoration and backdrop dismissal; replaces desktop sidebar.
- Home vocabulary summary, due-review card, Discover/Learn cards, practice and collection links.
- Dense contextual Knowledge Map with level tabs, search/status filters, selected meaning, pronunciation, previous/next selection, saved familiarity and explicit status legend. Position numbers are not frequency rank.
- Word detail includes prominent contextual meaning/Tamil and return links to map/discovery, preserving exactly eight lesson sections and personal state.
- Practice accepts reading/writing/speaking links (reading maps to recognition). Existing guided practice and ChatGPT handoff remain the custom alternative to live AI.
- Added mobile 390px and desktop 1280px journey tests in existing knowledge-map.spec.ts, covered by the existing CI workflow. They exercise drawer/Escape/focus, layout bounds, map selection, next meaning, lesson link and overflow, saving screenshots.

Verification: frontend TypeScript and production build run locally. Local Chromium installation still returns empty/corrupt archives, so browser tests must run in CI. Connected Chrome tool currently returns Unknown tool; this is a transient access limitation. Do not claim visual reference fidelity or full UI completion based on compilation.

Exact next work:
1. Check successor draft PR's full CI, fix legitimate failures without weakening assertions/gates. Inspect desktop/mobile screenshot artifacts.
2. Reconnect Chrome WordUp reference for direct visual comparison; finish coherent review, practice, collections, progress and settings layouts beyond shared shell styling.
3. Verify complete desktop/mobile journeys: discovery to detail and all eight sections, notes/favorites persistence, review save/retry, practice handoff and goals, dark-theme contrast. Add missing journey coverage.
4. Improve return-to-map state retention (level/search/page/selected meaning); current return link reopens default map.
5. Confirm no outstanding UI gaps, then deliver UI for review and stop continuation. Do not merge. Do not begin deferred data assessment/import during UI phase.

### Further UI work and verified CI receipt
Successor draft PR: #123. First redesign commit 2f3bea457ea0999556a84b46da8a0a7841cc270e passed Vocabulary learning UI (including 390/1280px journeys), feature delivery, content-pack and gold-corpus gates. Full integration run was still running at inspection.

Follow-up implementation: collections now opens personal lists first with a separate Explore topics view; progress uses a two-column summary with compact category bars and review/practice links; practice offers Read/Recall/Listen/Write/Speak controls and collapsible session filters; review has a focused card, pronunciation and Tamil visibility hooks. Added the actual preview/copy/manual-open ChatGPT handoff (the earlier UI description claimed it but practice had no link). No data is sent automatically. Added mobile dark-theme collections/progress/practice journey coverage.

Continue direct visual comparison and full eight-section/notes/favorites/review save-retry journeys. These changes are still in development, not ready for final UI review.

Visual QA of first CI artifacts: inspected map-390.png and map-1280.png downloaded from run 39502959833. Dense grid and selected-card layout render without horizontal overflow. Found an inherited mobile toolbar rule that made the account group full width and wrapped the brand; corrected it and added a one-line brand assertion. Screenshots now reset to scroll top before capture so sticky bars are not misleadingly positioned midway through full-page artifacts. Added home screenshots and a real review failed-save/retry test checking the request identity and hidden Tamil.

## Continuation — 2026-10-21: lesson journeys and return context
Baseline unchanged: main f7636988; draft #123 head ccfdac575f427e468701ddc2d908c51ea5673eb7. All five checks at that head passed, including the full application/backend integration checklist and nine browser tests. Inspected CI screenshots of mobile home and dark practice. Chrome reference tool still returns Unknown tool; direct reference comparison remains pending.

Implemented next:
- Map-to-lesson return now preserves level, search, status, page and selected meaning using whitelisted, bounded URL state; no arbitrary return URLs.
- Fixed an API contract bug: from=map/from=discover were forwarded to the word-detail endpoint, whose enum only accepts category/search. UI return state is now separate from API query context; existing category/search context is preserved.
- New 390px dark / 1280px light complete-lesson journeys assert exactly eight sections, jump-link focus, Tamil, note failed-save recovery and persistence, unchanged learning choice, favourite-add payload and return to the same map selection/page/filters. Mocks explicitly require API detail requests without UI-only parameters.
- Fixed blank home Learn-card grid illustration (empty cells were centered at zero height); new dimension assertion covers it. Adjusted quick/full lesson panels and semantic callouts to the purple light/dark surface palette.

Next: inspect the newest CI and full lesson screenshots, repair any genuine issues; verify discover-to-detail with the real strict API boundary; then direct WordUp reference comparison and remaining visual gaps. Do not merge or start source assessment. The UI is still in development; browser journeys alone do not establish complete visual fidelity.

### Verification and visual QA receipt (2026-10-21)
Commit df571a124ea25f55997d1f779eb7e78cc6abdd0b saved the interrupted local changes to draft #123. Local frontend typecheck/build passed. Its 11 browser tests passed, including complete 390px dark and 1280px light lesson/note/favourite/map-return journeys. Inspected both full-lesson screenshots: readable theme surfaces, intact eight sections, no horizontal overflow. Found mobile section-number wrapping; corrected flex shrink/white space. Aligned the category picker with purple list styling and limited recording disclosure to recording-enabled audio controls. Extended the same journey to navigate Discover → detail → Discover while respecting the strict API query boundary; newest CI must verify this addition.

Chrome reference still unavailable (connector Unknown tool), so direct WordUp comparison is an open verification dependency. Do not call the UI complete. Latest remaining priorities: inspect newest CI/screenshots after the small QA fixes, recover reference access and compare all principal screens, resolve any verified visual gaps. Data remains deferred; no merge.

### Discover return-link repair (2026-10-21)
Latest main remains f7636988 and draft #123 head was 10653b31. Its integration, content-pack, gold-corpus and delivery checks passed; browser CI passed 9 tests and failed both new Discover return journeys. Trace showed navigation to the bare detail URL and “Back to vocabulary”. The local Discover link already included from=discover, but that file had been omitted from the remote checkpoint. Compared the complete local file with remote: this one href is the only difference. Publish it without overwriting local work. Strengthened both viewport journeys to assert the href and resulting URL before the existing return-link assertion; no gates or coverage removed.

Next: inspect CI for this repair, view Discover and updated lesson artifacts, then resume direct WordUp reference comparison when Chrome connector recovers. Full visual fidelity remains unverified, UI is not yet delivered for review, and data work remains deferred.
