# First UI review version

This is the UI phase of the agreed sequence. PR #123 is not a production deployment or the finished WordUp catalogue. Keep main and learner data unchanged until the review version is accepted.

## Visual reference checked 21 October 2026

Authenticated wrdp.app in connected Chrome was inspected directly. Reference: centered 700px canvas, purple toolbar and drawer, vocabulary summary and review card, paired Discover/Learn entries, a focused meaning above a dense status grid, white rounded detail cards with pronunciation/Tamil/examples/notes and paired familiarity choices. WordUp settings groups learning/accent/translation/review controls.

| Screen | Review implementation | Intentional difference |
| --- | --- | --- |
| Home and drawer | Centered purple canvas, summary, due review, Discover/Learn, practice and collections | Own identity; no ads, coins or commercial promotions |
| Knowledge Map | Meaning card first; compact B1/B2/C1 tabs; dense status grid; search/status below grid; previous/next and lesson return state | Alphabetical positions, not unverified WordUp frequency ranks; earned proficiency separate from declared knowledge |
| Discover | Focused card, pronunciation, Tamil, primary learning choice left and known choice right | Original typographic artwork until assessed per-sense media is supplied |
| Word details | Meaning, pronunciation, Tamil, note, favourites, all eight sections and return context | Eight structured sections replace overlapping WordUp tips; no copied pictures or protected lesson assets |
| Review | Focused recall/reveal/answer flow with save failure recovery | Existing spaced review and mastery rules retained |
| Practice | Read/Recall/Listen/Write/Speak, saved lesson tasks, comparison, local recording and manual ChatGPT handoff | No live in-app AI, celebrity simulation or automatic pronunciation scoring |
| Collections and progress | Personal lists, favourites, topic exploration, goals and progress | Controlled taxonomy and existing progress history retained |
| Settings | Saved accent, Tamil visibility and theme with recovery from failed saves | Browser voices; reminders/push/native sync not implemented |

## Review checklist

1. Open Home, use the drawer, and enter Knowledge Map. Switch B1/B2/C1 and select a coloured cell.
2. Open its lesson, inspect all eight sections, save a note and favourite it, then return to the same map position.
3. Discover a word, choose known/learning, and review a scheduled entry.
4. Create a list; explore topics; check progress and guided writing/speaking practice.
5. Change accent, Tamil visibility and theme, reload, and repeat at phone width.

UI test fixtures are synthetic test entries, not the imported WordUp inventory. Backend integration checks are separate from mocked browser journeys. The 42,200-row assessment/import and original per-sense pictures remain the next phase. UI readiness requires newest-head CI and screenshot inspection; see the delivery checkpoint for that receipt.
