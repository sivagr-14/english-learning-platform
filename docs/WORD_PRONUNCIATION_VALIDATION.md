# Word pronunciation playback

The vocabulary detail header reuses `PracticeAudio` with the raw `word.word`,
not the displayed sense label or pronunciation text. Normal and slow playback
therefore work for every loaded entry, including entries with no lesson or a
retired lesson format. The existing component labels its output as a synthetic
browser voice, handles unavailable speech support, and exposes Stop audio.

The component is keyed by the word ID. Moving to a different entry unmounts it,
so its existing cleanup cancels the previous speech. It does not request a
microphone because recording remains disabled.

## Verification

- The changed TSX was transpiled with TypeScript with no syntax diagnostics.
- Checked that the header is outside the simplified-lesson conditional and
  passes the unsuffixed raw term rather than `display_label` or IPA text.
- No generated lesson payload, taxonomy, vocabulary identity, progress or
  database row changes are included in this application change.

## Local browser acceptance

After installing this change, open an entry in the supported local app:

1. Choose Listen in Word pronunciation, then Listen slowly; check audible
   English pronunciation and the slower pace.
2. Check a second sense, such as an entry displayed with (B); the suffix must
   not be spoken.
3. Start a long expression, then navigate to another entry; old speech must stop.
4. Verify Stop audio and the existing unavailable-speech error on a browser
   without speech synthesis.
5. Check a noun/verb homograph in its intended sense. Browser voices may choose
   a different pronunciation for isolated words; this change is not a
   dictionary-verified recording service.

Actual audible playback on the learner's Mac and per-entry pronunciation
correctness remain unverified. This change does not establish that the 1,863
lesson replacements are import-ready.
