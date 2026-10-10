# Mastery Skills: Overview review of 1,863 entries

The supplied current export contains exactly 1,863 unique word IDs and a complete
lesson-data object and source sentence for every entry. The source SHA-256 is
`5e698a384da15a9c8f0a19f43acd7f5a34e5eee0f958bb50e7ba4ce7f431d207`.

## Checkpoint

- Inventory and automated lesson checks: 1,863/1,863.
- Four-field semantic review processed: 200/1,863.
- Proposed profiles: 199; source/sense conflict quarantined: 1.
- Remaining semantic review: 1,663, starting at ordinal 201, group 003.
- Import-ready replacement batches: 0. Database updates verified: 0.

Read `REVIEWED-PROFILES-001-002.md` for the first results. `PROFILE-DRAFT-NNN.json`
stores before/after fields, exact word/sense IDs, expected entry versions and
hashes of the original lessons. These are editorial review records, **not app
import files**. Do not place them in `content-packs/inbox`.

The word **attributes** at ordinal 164 is quarantined: its stored noun meaning
is “measurable characteristics,” but its source uses the verb “attributes it to.”
No replacement profile is approved for that entry. Preserve its identity and
resolve the evidence conflict separately; do not silently turn the noun into
a different verb sense.

## Wider findings, outside the requested four fields

Exact-text and pattern triage found 962 generic tone fields, 955 unselected
meaning-type lists, 955 generic connotations and 955 register instructions.
Outside Overview, 963 entries have metalinguistic example boilerplate, 1,160
pronunciation strings equal the spelling wrapped in slashes, and 955 Tamil
fields contain the “Tamil explanation” prefix followed by English material.
These pattern matches are review flags, not completed linguistic diagnoses of
every field. They must not be represented as corrected by an Overview update.

The production lesson validator from the pinned commit in `STATUS.json` flags
97 existing lessons under ordinary validation, including source-term matching
issues. OCR spaces and grammatical variants account for some flags; verify the
original evidence rather than altering it or granting unverified trust.
Eight of the first 199 proposed full lessons retain automated flags outside
the changed profile. Automated acceptance does not certify teaching quality.

## Continuation instructions

1. Read current repository instructions and the approved four-field rules.
2. Re-read `STATUS.json`, `REVIEW-LEDGER.json` and existing group receipts from
   this remote folder. Do not restart completed work or trust conversational
   counts over durable records.
3. Read the next `source-context/group-NNN.json`. These contain only the minimum
   vocabulary context needed for this review, not the private database export.
4. Individually review each actual sense and sentence. Draft concise, specific
   explanations of meaning type, connotation, tone and register. Preserve valid
   wording. Do not use a word-class template or a blanket tone/register label.
   State the limits of truncated source fragments. Quarantine genuine source/
   sense conflicts and continue other entries.
5. Save immutable group results plus readable notes, update the ledger and
   status using a guarded GitHub App commit, remotely verify them, then continue
   immediately to the next missing group in the same run. A group boundary is
   not a reason to request approval or a manual resume.
6. Once all groups are reviewed, prepare complete same-sense replacement lessons
   through the existing versioned content-pack contract, preserving unrelated
   sections, exact evidence, taxonomy, sense ranks and learner progress. Retrieve
   complete original lessons from the supplied export in this conversation
   (`libfile_84e8bd2a70b48191a0e3afc9b94b2ba8`) when needed; do not reconstruct
   missing lesson sections from this minimal review context.
7. Run current production preflight and batch validation, plus semantic review.
   Do not publish replacements that retain forbidden generic material merely
   because the four fields were improved. Record any broader lesson-quality
   blocker explicitly. Never weaken validation or change immutable prior packs.
8. Deliver valid versioned corrections through `chatgpt-content-inbox`, separate
   from these review records, and report exact corrected/pending/quarantined
   counts. Only the local app can verify synchronization and PostgreSQL read-back.

An hourly recovery task may resume this authorized work if the conversation run
ends at a checkpoint. It must drain consecutive groups rather than intentionally
performing only one group per invocation, and disable itself when done or when
an unrecoverable blocker is reported. No automatic completion is claimed from
the existence of this checkpoint.
