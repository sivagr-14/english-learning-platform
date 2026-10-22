# WordUp-style delivery status

UI FIRST: finish and deliver UI for review before source assessment/import.

Status: first UI version ready for review on 21 October 2026. Draft #123 remains unmerged; this is not the complete catalogue or full native WordUp product. No merge is authorized.

| Area | Implementation / customization | Verification / remaining work |
| --- | --- | --- |
| Learning home | Centered purple home, words summary, review and Discover/Learn cards | Desktop/mobile journeys and direct Chrome reference audit complete |
| Discovery | B1/B2/C1 contextual meanings, known/learning choices, pronunciation, lesson access | Failed-save recovery passes CI; reference card hierarchy compared directly |
| Knowledge Map | Dense meaning grid, selected card, search/status/level filters and preserved lesson-return context | 390/1280px grid and preserved-return journeys pass; corrected square-cell screenshots inspected |
| Word details | Existing contextual senses and eight-section lessons, personal familiarity and saved notes | Complete eight-section/notes/favourites and return journeys pass at e70dc2bf |
| Eight custom sections | Overview; Meaning in Context; Usage Guide; Patterns & Collocations; Natural Examples; Mistakes & Differences; Memory & Practice; Advanced Nuance | Preserve exactly eight simplified-v2 sections and existing Tamil; do not regenerate/import unvalidated content |
| Favorites / lists | Existing personal categories and default Favorite reused | Desktop/mobile list create/retry/read-back/reload and favourite payload journeys pass (mocked UI); backend category checks pass separately |
| Pronunciation | British/American preference, normal/slow/stop browser speech | Synthetic voices, device-dependent availability; not licensed WordUp audio or pronunciation scoring |
| Notes / familiarity | Account-scoped note and known/learning choice | PostgreSQL isolation and review-preservation checks passed at ccfdac5 |
| Spaced review | Existing review queue, preserved reviews; self-declared known is separate from earned mastery | Backend checks and failed-save UI retry test passed at ccfdac5 |
| Guided reading/writing/speaking | Existing saved-lesson practice and local recording | Skill links, controls, explicit handoff and mobile dark journey pass CI |
| Goals / preferences / progress | Existing learning goals/history; new persistent settings for accent/Tamil/theme | Settings recovery/persistence and lesson theme journeys pass; screenshots inspected |
| Live AI tutor / celebrity roleplay | Custom alternative: guided saved lessons and ChatGPT handoff | No active in-app AI provider, in accordance with project rules; not equivalent to live AI roleplay |
| Picture-led meanings | Not yet implemented | Original or properly licensed per-sense media required; no copied WordUp assets |
| Source catalogue | Original 42,200 rows preserved; separate resumable assessment copy | Zero final semantic decisions. Identity/template flags do not establish CEFR or usage; reconcile eligible senses with existing app before lesson generation/import |
| Notifications / reminders | Not implemented | Browser notification permission, scheduling and offline behavior need explicit implementation and verification |
| Native/offline sync | Existing local web app and account PostgreSQL data | Native-app sync/offline parity not implemented; do not imply equivalence |

## Data and delivery boundaries

Use only validated B1/B2/C1 high/medium-usage senses in the WordUp scope. Rank alone is never CEFR or frequency evidence. Keep all original SQLite fields and excluded records for audit; never upload the private raw database to the repository. Immutable content-pack validators and the local PostgreSQL importer remain authoritative.

Review this file together with WORDUP_DELIVERY_CHECKPOINT.md. CI checks for a partial feature branch are not evidence that the complete catalogue, media or full product scope has been finished.

Latest implementation evidence: e70dc2bf, all five CI checks passed, including 14 browser tests. See WORDUP_DELIVERY_CHECKPOINT.md for run links and WORDUP_UI_REVIEW.md for review steps. Notifications/native sync remain unimplemented product gaps, not completed or silently removed features. Media and catalogue remain deferred; the review milestone is limited to the implemented web UI.
