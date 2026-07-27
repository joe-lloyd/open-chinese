## 1. Ambient Types and Capability Detection

- [x] 1.1 Create `client/src/types/speech.d.ts` — ambient declarations for `SpeechRecognition`, `SpeechRecognitionEvent`, `SpeechRecognitionErrorEvent`, `SpeechRecognitionResultList` and `SpeechRecognitionAlternative`, plus `webkitSpeechRecognition` on `Window` (none are in TypeScript's DOM lib)
- [x] 1.2 Create `client/src/lib/speech.ts` — export `getSpeechRecognitionCtor()` resolving `window.SpeechRecognition ?? window.webkitSpeechRecognition`, evaluated once at module load and cached; return `null` when absent
- [x] 1.3 Export `isSpeechRecognitionSupported(): boolean` from `speech.ts` as a thin wrapper over 1.2; do not construct a recognizer to probe support
- [ ] 1.4 Verify in Firefox that `isSpeechRecognitionSupported()` returns `false` with `dom.webspeech.recognition.enable` at its default value

## 2. Recognition Engine

- [x] 2.1 In `client/src/lib/speech.ts` add `export type SpeechErrorCode = 'no-speech' | 'audio-capture' | 'not-allowed' | 'network' | 'aborted' | 'timeout' | 'unknown'` and `export interface RecognitionOutcome { alternatives: string[]; error: SpeechErrorCode | null }`
- [x] 2.2 Implement `startRecognition(): { stop: () => void; abort: () => void; done: Promise<RecognitionOutcome> }` in `speech.ts`, setting `lang='zh-CN'`, `continuous=false`, `interimResults=false`, `maxAlternatives=5` on the instance
- [x] 2.3 In `startRecognition`, map the `result` event's `SpeechRecognitionResultList[0]` to an ordered `alternatives: string[]` of up to 5 transcripts, trimmed of whitespace
- [x] 2.4 In `startRecognition`, attach an `error` handler that normalises `event.error` to `SpeechErrorCode` and settles `done` exactly once; ensure `result`, `error` and `end` are all idempotent settlers so no path resolves twice
- [x] 2.5 Arm a watchdog `setTimeout` on `start()` and clear it in whichever of `result`, `error` or `end` fires first; on expiry call `abort()` and settle `done` with `{ alternatives: [], error: 'timeout' }` (works around Safari dropping the terminal `end` event)
- [x] 2.6 Export `errorMessage(code: SpeechErrorCode): string | null` from `speech.ts` returning: `no-speech` → "Didn't catch that — try again", `audio-capture` → "No microphone found", `not-allowed` → "Microphone permission denied", `network` → "Recognition needs an internet connection", `aborted` → `null` (silent), `timeout` → `null`

## 3. Word-Identity Assessment

- [x] 3.1 Create `client/src/lib/pronunciation.ts` — export `export type Verdict = 'match' | 'near-match' | 'homophone' | 'mismatch' | 'unrecognized'` and `export interface Assessment { verdict: Verdict; heard: string | null }`
- [x] 3.2 Implement `toTonelessPinyin(pinyin: string): string` in `pronunciation.ts` — lowercase, `normalize('NFD')`, strip combining marks via `/[̀-ͯ]/g`, strip spaces and digits; must map `mǎi` and `mài` to `mai`, and `lǜ` to `lu`
- [x] 3.3 Implement `assess(alternatives: string[], target: string, lookup: (s: string) => Word | null): Assessment` in `pronunciation.ts` applying, in order: `alternatives[0] === target` → `match`; `alternatives.includes(target)` → `near-match`; any alternative whose `lookup(alt)?.pinyin` reduces to the target's toneless pinyin → `homophone`; non-empty alternatives → `mismatch`; empty → `unrecognized`
- [x] 3.4 Source the target's pinyin from the study card's existing `pinyin` field and the recognized alternative's pinyin from `getWord(alt)` returned by `loadDB()` in `client/src/lib/worddb.ts`; do not add a pinyin library to `client/package.json`
- [x] 3.5 Return `heard: alternatives[0] ?? null` on every assessment so the UI can always show what was recognized
- [x] 3.6 Confirm `assess` is a pure function with no imports from `client/src/lib/srs.ts` or `client/src/lib/firestore.ts`

## 4. Rewrite PronunciationAssessor

- [x] 4.1 Rewrite `client/src/components/PronunciationAssessor.tsx` — delete the `MediaRecorder`, `getUserMedia`, `chunksRef`, `Blob`/`FormData` and `fetch('http://localhost:3001/api/pronounce')` code entirely (current lines 19-56)
- [x] 4.2 Change the component props from `{ targetPinyin: string }` to `{ target: string; targetPinyin: string }` so the assessment can compare against the card's simplified string
- [x] 4.3 Return `null` from the component when `isSpeechRecognitionSupported()` is `false`, or render the control `disabled` with a `title` tooltip explaining the browser does not support speech recognition; render no error state in either case
- [x] 4.4 Wire push-to-talk: `onMouseDown`/`onTouchStart` call `startRecognition()`, `onMouseUp`/`onTouchEnd` call the returned `stop()`; add `onMouseLeave` to stop a drag that leaves the button
- [x] 4.5 Render a listening indicator while awaiting `done`, and clear it on every settle path including `timeout` and `aborted`
- [x] 4.6 Render the verdict using the existing utility classes backed by `--color-correct` / `--color-incorrect` / `--color-unrecognized` (`client/src/index.css:12-14`, `:28-30`): `match` and `near-match` → correct, `mismatch` → incorrect, `homophone` and `unrecognized` → unrecognized
- [x] 4.7 Render `assessment.heard` beside the verdict so the learner can compare what was recognized against the card's characters
- [x] 4.8 Render a persistent, non-dismissible caption stating that browser recognition checks which word was heard and does not verify tones; keep it visible after a `match` verdict
- [x] 4.9 Render `errorMessage(code)` when non-null; render `not-allowed` as persistent text rather than a transient toast, and add no automatic retry
- [x] 4.10 Reset verdict, heard text and error state whenever the `target` prop changes so results never carry across cards
- [x] 4.11 Abort any in-flight recognition in a `useEffect` cleanup on unmount and on `target` change

## 5. Mount in the Study Flow

- [x] 5.1 Import `PronunciationAssessor` into `client/src/pages/StudyPage.tsx` — the component currently has no import site anywhere in `client/src`
- [x] 5.2 Render `<PronunciationAssessor target={card.simplified} targetPinyin={card.pinyin} />` inside the pinyin block gated on the existing `pronVisible` (`StudyPage.tsx:312`, i.e. `phase !== 'pron-hidden'`), so the microphone never appears during the `pron-hidden` recall test
- [x] 5.3 Keep the pinyin container's reserved height stable (`StudyPage.tsx:365`, `h-14`) or extend it deliberately, so mounting the assessor introduces no layout shift between phases
- [x] 5.4 Verify the assessor's controls do not shadow the existing key handlers at `StudyPage.tsx:221` (`←` fail-and-reveal, `→`/Space advance, `↑`/`R` replay audio, `↓` speak sentence); the microphone stays pointer/tap-driven
- [x] 5.5 Verify the assessor unmounts or resets on card advance, where `setPhase('pron-hidden')` runs (`StudyPage.tsx:148`, `:194`)

## 6. Advisory-Only Guardrail

- [x] 6.1 Confirm `advance()` in `client/src/pages/StudyPage.tsx` still receives only `finalKnewPron` / `finalKnewMeaning` from the self-assessment buttons, with no argument derived from a pronunciation verdict
- [x] 6.2 Confirm `client/src/lib/srs.ts` is unmodified by this change and that `applyBinaryReview` takes no pronunciation-verdict parameter
- [x] 6.3 Confirm `client/src/lib/firestore.ts` is unmodified and that `setUserWord` and `upsertDailyStats` persist no verdict, transcript or attempt count
- [x] 6.4 Grep `client/src` to confirm neither `speech.ts` nor `pronunciation.ts` is imported by `srs.ts`, `firestore.ts` or `session.ts`

## 7. Documentation Cleanup

- [x] 7.1 Replace the "Whisper Pronunciation Assessment" section at `README.md:24-37` with a description of the browser-based `SpeechRecognition` feature, including its Chrome/Edge/Opera support, flaky Safari support, effectively-unsupported Firefox, and the fact that it does not verify tones; delete the `WHISPER_BACKEND` and `OPENAI_API_KEY` instructions and the reference to `server/.env`
- [x] 7.2 Delete the `WHISPER_BACKEND` and `OPENAI_API_KEY` rows from the environment variable table at `DEPLOY.md:232-233`
- [x] 7.3 Grep the repository for `WHISPER_BACKEND`, `OPENAI_API_KEY`, `whisper` and `/api/pronounce` and confirm no references remain outside `openspec/changes/archive/`

## 8. Verification

- [x] 8.1 Run `npx tsc -b` in `client/` and confirm a clean exit with the new ambient types in place
- [x] 8.2 Run `pnpm --filter client build` and confirm it completes with no TypeScript errors
- [ ] 8.3 Manually verify in Chrome: `match` on a correctly spoken target, `mismatch` on a deliberately wrong word, `unrecognized` on silence, and that the recognized text and tone disclaimer are both shown
- [ ] 8.4 Manually verify in Firefox that the microphone control is absent or disabled with a tooltip and that no error appears
- [ ] 8.5 Manually verify in Safari that a dropped `end` event is recovered by the watchdog and the listening indicator clears
- [ ] 8.6 Manually verify that denying microphone permission produces persistent "Microphone permission denied" text and no retry loop
- [ ] 8.7 Verify against Firestore that a session containing pronunciation attempts writes no verdict or transcript data under `users/{uid}`
- [x] 8.8 Run `npx openspec validate client-side-pronunciation-assessment --strict` and confirm it passes
