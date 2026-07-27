## Why

The `pronunciation-assessment` capability is entirely fictional. Its spec describes a Whisper transcription backend, a pinyin tone comparator, and a result cache — none of which exist in the repository.

`client/src/components/PronunciationAssessor.tsx` is orphaned dead code. A repo-wide search finds no `import` of it and no JSX usage anywhere under `client/src`; the only other references are in the archived `2026-06-27-open-chinese` task list. It has not been rendered since the Firebase migration, so the app ships a microphone feature that no user can reach.

Even if it were mounted, it could not work. `PronunciationAssessor.tsx:36` posts to the absolute URL `http://localhost:3001/api/pronounce`. On Netlify that resolves to *the end user's own machine*, so the request always fails. The route it targets was deleted in commit `8850661` along with `server/src/routes/pronounce.ts`, `server/src/lib/whisper.ts`, `whisper-cache.ts` and `tone-compare.ts`. `netlify.toml` has only `[build]`, one SPA redirect and two cache headers — there is no server and no Netlify Function to restore it to.

No client-side pinyin or tone comparison logic exists anywhere. `pinyin` in `client/src` is only a display and search string (`client/src/lib/worddb.ts:7,69`), and no pinyin library is listed in `client/package.json`. `WHISPER_BACKEND` and `OPENAI_API_KEY` survive only in stale documentation (`README.md:26-34`, `DEPLOY.md:232-233`) that describes a `server/.env` file for a workspace that no longer exists.

The project owner's decision is to rebuild the capability **100% client-side using the Web Speech API's `SpeechRecognition`** — no server, no paid API, no recurring cost. That is achievable, but it buys a strictly weaker signal than the deleted spec promised, and the spec must say so.

## What Changes

- **BREAKING** Remove the `Whisper transcription backend` requirement. There is no server, no Netlify Function, and no `WHISPER_BACKEND` variable in shipping code.
- **BREAKING** Remove the `Pinyin tone comparison` requirement. `SpeechRecognition` with `lang='zh-CN'` returns a transcript of **Han characters only** — never pinyin, never tone marks, never tone numbers — and exposes no phoneme, pitch or confidence-per-syllable data. The requirement's inputs do not exist on this platform.
- **BREAKING** Remove the `Assessment result caching` requirement. It was keyed on an audio content hash; the Web Speech API never hands the page an audio buffer to hash, and recognition is free, so there is nothing to cache and no cost to avoid.
- **BREAKING** Remove the `Graceful degradation on backend unavailability` requirement. There is no backend to be unavailable. Unsupported browsers are handled by capability detection instead, and recognition errors are handled per-error-code.
- **BREAKING** Remove the `Audio capture via MediaRecorder` requirement. The Web Speech API owns the microphone stream end to end. The old requirement's "WAV/PCM audio stream" was never true anyway: `PronunciationAssessor.tsx:31` labels its `Blob` `audio/wav`, but `MediaRecorder` in Chrome and Firefox emits WebM/Opus and in Safari emits MP4/AAC — the label was a lie, not a format.
- **BREAKING** Remove the `Color-coded feedback display` requirement, whose text ("green for correct tone, red for incorrect tone") promises a tone verdict that browser recognition cannot produce.
- Add capability detection over `window.SpeechRecognition ?? window.webkitSpeechRecognition`, hiding the microphone affordance entirely where unsupported — no error toast for merely using Firefox.
- Add speech capture through `SpeechRecognition` at `lang='zh-CN'`, `continuous=false`, `interimResults=false`, `maxAlternatives=5`, with explicit handling for the `no-speech`, `audio-capture`, `not-allowed`, `network` and `aborted` error codes plus a client-side watchdog timeout.
- Add **word-identity** assessment: compare the returned transcript and alternatives against the card's target simplified string, yielding `match`, `near-match`, `homophone`, `mismatch` or `unrecognized`. This checks *which word* was recognized. It does **not** check tones.
- Add feedback display that shows the actual recognized text and carries a persistent disclaimer that browser recognition does not verify tones.
- Add a hard requirement that the pronunciation result is advisory only and never feeds the SRS grade in `client/src/lib/srs.ts` or the writes in `client/src/lib/firestore.ts`.
- Rewrite `client/src/components/PronunciationAssessor.tsx` and actually mount it in `client/src/pages/StudyPage.tsx`, which is the step the original change never completed.
- Correct the stale `WHISPER_BACKEND` / `OPENAI_API_KEY` documentation in `README.md` and `DEPLOY.md`.

## Capabilities

### New Capabilities

<!-- None. This change replaces the requirements of an existing capability. -->

### Modified Capabilities

- `pronunciation-assessment`: Re-founded on the browser's `SpeechRecognition` engine. Every server-dependent requirement is removed. The assessment's meaning narrows from "is this syllable's tone correct?" to "did the recognizer hear the target word?", and the capability is explicitly demoted to advisory — it informs the learner and never touches scheduling.

## Impact

- **Changed**: `client/src/components/PronunciationAssessor.tsx` — rewritten against `SpeechRecognition`; `MediaRecorder`, the `Blob`/`FormData` upload and the `http://localhost:3001` fetch are deleted
- **Changed**: `client/src/pages/StudyPage.tsx` — mounts the component for the first time, gated on `phase !== 'pron-hidden'` so the target is on screen before the learner is asked to say it
- **Added**: `client/src/lib/speech.ts` — capability detection, recognizer lifecycle, watchdog, error-code normalisation
- **Added**: `client/src/lib/pronunciation.ts` — transcript-to-verdict comparison including the toneless-pinyin homophone check
- **Added**: `client/src/types/speech.d.ts` — ambient types for `SpeechRecognition`, absent from TypeScript's DOM lib
- **Unchanged**: `client/src/index.css:12-14,28-30` — the `--color-correct` / `--color-incorrect` / `--color-unrecognized` tokens already exist in both themes and are reused verbatim
- **Unchanged**: `client/src/lib/srs.ts`, `client/src/lib/firestore.ts`, `netlify.toml` — no scheduling, storage or deploy changes; the feature stays inside the static-SPA envelope
- **Unchanged**: `client/public/words.db` schema — the homophone check reads the existing `pinyin` column via `getWord` (`client/src/lib/worddb.ts:46-50`)
- **Changed**: `README.md:24-37`, `DEPLOY.md:232-233` — delete the `WHISPER_BACKEND` / `OPENAI_API_KEY` instructions
- **Deferred**: tone-contour analysis (an `AudioWorklet` F0 tracker compared against a reference curve). It is the only browser-native way to actually judge tones, and it is out of scope here — see `design.md`.
