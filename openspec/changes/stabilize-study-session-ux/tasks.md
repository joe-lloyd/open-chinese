## 1. Sentence pinyin data

- [ ] 1.1 Add `pinyin-pro` as a devDependency of the `scripts` workspace
- [ ] 1.2 Add `sentence_pinyin TEXT` to the `words` table in `scripts/build-words-db.ts` and to its INSERT
- [ ] 1.3 Add an optional `sentencePinyin` field to the script's `HskWord` interface and use it in preference to generation
- [ ] 1.4 Generate the reading from `sentenceZh` with `pinyin-pro`, mapping CJK punctuation to ASCII and stripping the space that precedes it; `null` when there is no sentence
- [ ] 1.5 Run `pnpm build:words-db` and spot-check that polyphones (银行, 首都) and punctuation come out right
- [ ] 1.6 Add `sentence_pinyin` to the `Word` interface in `client/src/lib/worddb.ts`
- [ ] 1.7 Add `sentencePinyin` to `StudyCard` in `client/src/lib/session.ts` and map it in both `toCard` and `toNewCard`

## 2. TTS volume

- [ ] 2.1 Extend `TTSSettings` in `client/src/lib/tts.ts` with `volume`, default 1.0
- [ ] 2.2 Merge stored settings over the defaults in `getSettings()` so a pre-existing `{rate, pitch}` blob yields `volume: 1.0`
- [ ] 2.3 Apply `utt.volume` in `speak()`
- [ ] 2.4 Add a volume slider to `client/src/pages/SettingsPage.tsx` alongside rate and pitch

## 3. Example sentence component

- [ ] 3.1 Create `client/src/components/ExampleSentence.tsx` rendering the hanzi sentence, a reserved-height pinyin line, and the English gloss
- [ ] 3.2 Reveal the pinyin on mouse hover only (`pointerType === 'mouse'`), and toggle it on click/tap
- [ ] 3.3 Accept a controlled `pinned` toggle from the parent so the `P` shortcut drives the same state
- [ ] 3.4 Make the control a `<button>` with `tabIndex={-1}` so keyboard focus can never land on it
- [ ] 3.5 Render nothing revealable when the card has no `sentencePinyin`
- [ ] 3.6 Apply the fade-in / instant-hide transition classes to the pinyin line

## 4. Session drawer

- [ ] 4.1 Create `client/src/components/StudySessionDrawer.tsx`: right-anchored panel over a backdrop, `w-80 max-w-[85vw]`, sectioned so future entries slot in
- [ ] 4.2 Close on backdrop click and on the panel's own close control
- [ ] 4.3 Add the TTS volume slider, reading and writing `tts-settings` through `lib/tts.ts`
- [ ] 4.4 Add the "End session now" action with a short line explaining that graded cards are kept

## 5. StudyPage layout

- [ ] 5.1 Replace the card area's content-sized flex column with fixed-height regions per the design table (badge, hanzi, traditional, pinyin/assessor, definition)
- [ ] 5.2 Size the hanzi by character count and add `whitespace-nowrap`, centered in its fixed-height box
- [ ] 5.3 Give the definition panel a fixed height with internal `overflow-y-auto`, and swap its example block for `ExampleSentence`
- [ ] 5.4 Give the grading button area a fixed height that accommodates every phase, including the phases carrying the "Mark as fully known" link
- [ ] 5.5 Verify the layout at 390×844 and 1440×900 for 1-char and 4-char words, with and without traditional, sentence and HSK level

## 6. StudyPage behaviour

- [ ] 6.1 Change the pinyin block and definition panel to `transition-opacity duration-150` only while visible, `transition-none` while hidden
- [ ] 6.2 Add `showSentencePinyin` state, reset on every card advance alongside `phase` / `knewPron` / `revealedByFail`
- [ ] 6.3 Bind `P` to toggle it, guarded on `phase === 'meaning-revealed'` and the card having a `sentencePinyin`; add it to the help overlay
- [ ] 6.4 Add drawer open state and a menu button in the progress row
- [ ] 6.5 Make the `keydown` handler return early while the drawer is open, except for `Escape`, which closes it
- [ ] 6.6 Implement `endSession`: clear the timer interval, close the drawer, `setDone(true)`
- [ ] 6.7 Restart the timer correctly on "Study again" so a session ended early can be restarted

## 7. Verification

- [ ] 7.1 `pnpm --filter client build` passes with zero TypeScript errors
- [ ] 7.2 `pnpm --filter client lint` reports no new findings
- [ ] 7.3 Re-read the full diff, confirming the "Mark as fully known" controls are untouched for the parallel branch
