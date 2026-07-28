## Why

The study screen is the app's main surface and it is visually unstable. The giant hanzi jumps between cards and between reveal phases, because every region below it grows and shrinks with content and the card column is vertically centred — so a long definition, a missing example sentence, or a four-character word all move the character the learner is staring at. The same opacity-based reveal that hides answers also *animates them out*, so clicking quickly through cards leaks the previous card's answer over the next card's recall phase. And once a session is running there is no way out of it: the only exits are finishing every card or navigating away, which throws away the summary.

Separately, the example sentence shows hanzi and an English gloss but no pinyin, so a learner who can read the words but is unsure of a tone has nothing to check against.

## What Changes

- **Deterministic study card layout.** The card column becomes a fixed-height grid: HSK badge, hanzi, traditional, pinyin/assessor and definition regions each reserve their space unconditionally, and the grading button area is fixed height too. The hanzi renders in a fixed-height box with a character-count-driven font size so multi-character words never wrap. Net effect: the giant hanzi occupies identical pixels on every card and in every phase.
- **Example sentence pinyin.** Sentence pinyin is generated at word-DB build time into a new `sentence_pinyin` column and revealed on hover (mouse), tap (touch), or the `P` key. Its line is always reserved, so revealing it shifts nothing.
- **Instant hide on advance.** Reveal regions keep their fade-in but lose their fade-out: the opacity transition is only present while the region is visible, so hiding is a single frame with no animation. Applies to every advance path — grade buttons, keyboard shortcuts, the fail-reveal "Next card" path, and "Mark as fully known".
- **In-session menu.** A menu button opens a right-hand drawer during a session containing "End session now" (persists what was graded and shows the normal summary) and a TTS volume control, with room for further entries. Study keyboard shortcuts are suppressed while the drawer is open.
- **TTS volume.** `TTSSettings` gains `volume` (0–1, default 1.0), persisted per-device in the existing `tts-settings` localStorage key and applied to every utterance. Exposed in both the session drawer and the Settings page.

## Capabilities

### New Capabilities

None. All four items extend behaviour already owned by existing capabilities.

### Modified Capabilities

- `study-session`: adds requirements for a fixed study card layout with zero layout shift, instant (non-animated) hiding of revealed content on advance, an in-session menu drawer, and a graceful "End session now" action.
- `audio-playback`: adds a TTS volume setting alongside rate and pitch, and requires the example sentence to carry a revealable pinyin reading.
- `static-word-db`: adds the `sentence_pinyin` column, generated at build time from `sentence_zh`.

## Impact

- `client/src/pages/StudyPage.tsx` — layout rewrite of the card column, instant-hide reveal classes, drawer wiring, end-session action.
- New `client/src/components/StudySessionDrawer.tsx` — the in-session menu.
- New `client/src/components/ExampleSentence.tsx` — sentence + revealable pinyin.
- `client/src/lib/tts.ts`, `client/src/pages/SettingsPage.tsx` — volume setting.
- `client/src/lib/session.ts`, `client/src/lib/worddb.ts` — `sentencePinyin` / `sentence_pinyin` plumbing.
- `scripts/build-words-db.ts`, `scripts/package.json` — new `pinyin-pro` build-time dependency and `sentence_pinyin` column. `client/public/words.db` must be regenerated (`pnpm build:words-db`); it is gitignored and rebuilt in CI/deploy.
- No Firestore schema change, no server change, no SRS change.
