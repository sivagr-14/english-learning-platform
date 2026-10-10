# Overview profile review: 1,863 requested entries

## Scope and status

The learner approved specific, B1-friendly explanations for Meaning type,
Connotation, Tone and Register on 2026-10-10. The generation contract and its
downloadable mirror now contain those rules and four approved teaching examples.
This is an instruction update and preliminary content triage, not a completed
1,863-lesson correction or a database import receipt.

| Evidence available | Entries | Limitation |
| --- | ---: | --- |
| Original collection request | 1,363 | Matching words, IDs and definitions only; no complete lessons or source sentences |
| Original pilot, with Unit 003 revision taking precedence | 400 | Archived delivered lessons; current local edits/import status unverified |
| Pack 02, Unit 001 | 100 | Archived delivered lessons; current local edits/import status unverified |
| Requested total | 1,863 | Actual current account inventory still needs reconciliation |

The five local lesson payloads were checked against the Git blob hashes of the
remote archive on `chatgpt-content-inbox`. The 100 Unit 003 corrections replace
the original Unit 003 for this review; they are not 100 additional entries.

## Confirmed preliminary findings

An exact-text scan of the first 200 pilot entries found:

- 198 entries use “Measured and explanatory; suitable for discussing plans or judgments.” for Tone.
- 196 entries use “Neutral to professional; also usable in ordinary planning and discussion.” for Register.
- 180 entries use “Neutral in itself: the situation determines whether the result is welcome.” for Connotation.

These counts identify repeated explanations for individual review. They do not
prove that every repeated label is wrong. In the inspected rationale example,
the source is a question asking why a launch was postponed; a tone description
must discuss that question rather than assume the speaker is explaining a plan.
Unit 003, Unit 004 and Pack 02 contain more varied wording, but variation alone
does not certify accuracy. No entry has yet received a completed four-field
semantic-review receipt under the new rules.

## Required input to finish

Supply the current account's vocabulary-and-lessons JSON, including each word's
ID, unsuffixed term, permanent sense rank/key/gloss, English meaning, taxonomy,
complete lesson JSON and actual source sentence. Retain legacy lesson fields
where simplified-v2 data is absent. Do not upload database credentials, auth
tokens, account tables or a whole database backup. The ordinary Prepare
collection request export omits lesson content and is insufficient for this audit.

The following read-only export uses the owner of an entry in the original
request to select that learner's words and shared starter words. It does not
modify the database or export authentication tables. Run on the Mac while
Docker is running. The anchor is the original request's “a compelling argument”
entry; if it was deleted, replace the UUID with a current word ID from the same
learner account. An absent or ownerless anchor intentionally returns zero rows.

```sh
docker exec -i english_learning_postgres psql -U postgres -d english_learning -X -qAt -v ON_ERROR_STOP=1 > mastery-skills-lessons-review.json <<'SQL'
WITH target_owner AS (
  SELECT owner_user_id FROM vocabulary_words
  WHERE id = 'b7d85f97-6e7b-4a4d-b707-3faf2e041706'
    AND owner_user_id IS NOT NULL
), entries AS (
  SELECT jsonb_build_object(
    'word', to_jsonb(w) - 'owner_user_id',
    'lesson', to_jsonb(l),
    'category', jsonb_build_object('id', c.id, 'name', c.category_name)
  ) AS item, w.id
  FROM vocabulary_words w
  LEFT JOIN vocabulary_lessons l ON l.word_id = w.id
  LEFT JOIN vocabulary_categories c ON c.id = w.category_id
  WHERE EXISTS (
    SELECT 1 FROM target_owner t
    WHERE w.owner_user_id = t.owner_user_id OR w.owner_user_id IS NULL
  )
)
SELECT jsonb_build_object(
  'formatVersion', 'vocabulary-lesson-review-export-v1',
  'exportedAt', CURRENT_TIMESTAMP,
  'entryCount', count(*),
  'entries', COALESCE(jsonb_agg(item ORDER BY id), '[]'::jsonb)
) FROM entries;
SQL
```

Attach the resulting JSON in ChatGPT. This is a review input, not an import
payload. Its count must be checked against 1,863; a mismatch is reported and
investigated rather than silently padded or truncated. This command is derived
from the repository schema; it has not been executed against the learner's Mac.

## Correction delivery

For every entry, review all four fields and record retained/corrected/blocked
decisions with reasons. Preserve correct fields and all unrelated lesson
content. Do not invent source context. Use complete versioned replacement
lessons with new immutable pack identities, production validation, semantic
review and reconciliation; preserve original archives and learner history.
Confirm current source/version before delivery to avoid overwriting intervening
local edits. Local sync and database read-back are separate completion gates.

Current reconciliation: 1,863 requested; 500 complete archived lessons available;
1,363 full lessons missing; 0 completed semantic reviews; 0 corrected lessons
delivered under this new standard; 0 database updates verified.
