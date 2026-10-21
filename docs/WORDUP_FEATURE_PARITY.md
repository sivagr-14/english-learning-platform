# WordUp-style delivery status

UI FIRST: finish and deliver UI for review before source assessment/import.

Status: in development. This branch is one consolidated review version, not the complete agreed app. No merge is authorized.

| Area | Implementation / customization | Verification / remaining work |
| --- | --- | --- |
| Learning home | Centered purple home, words summary, review and Discover/Learn cards | Desktop/mobile home/map journeys pass; direct reference comparison pending |
| Discovery | B1/B2/C1 contextual meanings, known/learning choices, pronunciation, lesson access | Failed-save recovery passes CI; full reference fidelity pending |
| Knowledge Map | Dense meaning grid, selected card, search/status/level filters and preserved lesson-return context | Grid journeys pass CI; new lesson-return journey awaiting newest CI |
| Word details | Existing contextual senses and eight-section lessons, personal familiarity and saved notes | Complete eight-section/notes/favourites journeys added; awaiting newest CI |
| Eight custom sections | Overview; Meaning in Context; Usage Guide; Patterns & Collocations; Natural Examples; Mistakes & Differences; Memory & Practice; Advanced Nuance | Preserve exactly eight simplified-v2 sections and existing Tamil; do not regenerate/import unvalidated content |
| Favorites / lists | Existing personal categories and default Favorite reused | Lists-first view and topic switching pass mobile CI; real persisted favourite journey being expanded |
| Pronunciation | British/American preference, normal/slow/stop browser speech | Synthetic voices, device-dependent availability; not licensed WordUp audio or pronunciation scoring |
| Notes / familiarity | Account-scoped note and known/learning choice | PostgreSQL isolation and review-preservation checks passed at ccfdac5 |
| Spaced review | Existing review queue, preserved reviews; self-declared known is separate from earned mastery | Backend checks and failed-save UI retry test passed at ccfdac5 |
| Guided reading/writing/speaking | Existing saved-lesson practice and local recording | Skill links, controls, explicit handoff and mobile dark journey pass CI |
| Goals / preferences / progress | Existing learning goals/history; new persistent settings for accent/Tamil/theme | Settings recovery/persistence tests pass; full lesson theme QA pending |
| Live AI tutor / celebrity roleplay | Custom alternative: guided saved lessons and ChatGPT handoff | No active in-app AI provider, in accordance with project rules; not equivalent to live AI roleplay |
| Picture-led meanings | Not yet implemented | Original or properly licensed per-sense media required; no copied WordUp assets |
| Source catalogue | Original 42,200 rows preserved; separate resumable assessment copy | Zero final semantic decisions. Identity/template flags do not establish CEFR or usage; reconcile eligible senses with existing app before lesson generation/import |
| Notifications / reminders | Not implemented | Browser notification permission, scheduling and offline behavior need explicit implementation and verification |
| Native/offline sync | Existing local web app and account PostgreSQL data | Native-app sync/offline parity not implemented; do not imply equivalence |

## Data and delivery boundaries

Use only validated B1/B2/C1 high/medium-usage senses in the WordUp scope. Rank alone is never CEFR or frequency evidence. Keep all original SQLite fields and excluded records for audit; never upload the private raw database to the repository. Immutable content-pack validators and the local PostgreSQL importer remain authoritative.

Review this file together with WORDUP_DELIVERY_CHECKPOINT.md. CI checks for a partial feature branch are not evidence that the complete catalogue, media or full product scope has been finished.
