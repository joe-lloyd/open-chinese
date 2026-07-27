## Context

The `pronunciation-assessment` capability has no working implementation and no infrastructure to run one on.

What exists: `client/src/components/PronunciationAssessor.tsx`, 97 lines, imported by nothing. It records with `MediaRecorder`, wraps the chunks in a `Blob` labelled `audio/wav` (line 31), and POSTs them to `http://localhost:3001/api/pronounce` (line 36) — a hardcoded absolute URL. Built and served from Netlify, that URL points at the visitor's own laptop, so the request cannot succeed for anyone. The receiving route, plus `server/src/lib/whisper.ts`, `whisper-cache.ts` and `tone-compare.ts`, was deleted in commit `8850661`.

What the deployment allows: `netlify.toml` contains a `[build]` block, one SPA redirect and two cache headers. Nothing else. There is no `functions` directory, no server workspace, and the whole point of the `firebase-netlify-architecture` change was to stop paying for and operating one. That change's own proposal already flagged this: *"Deferred: Whisper pronunciation assessment requires a Cloud Function or separate server; not in scope."*

The owner's decision, already made and not up for re-litigation here: rebuild the feature entirely in the browser on the Web Speech API. Free, zero infrastructure, no API key, and it fits the static-SPA envelope exactly.

The design problem is therefore not "how do we get speech recognition" — `SpeechRecognition` is a dozen lines. It is **how to describe honestly what that recognition can and cannot tell a Mandarin learner**, so the spec does not repeat the old one's mistake of promising a tone verdict the system was never able to produce.

## Goals / Non-Goals

**Goals:**
- A microphone affordance that is reachable in the study flow — mounted in `StudyPage.tsx`, which the original change never did
- Zero server, zero paid API, zero new deploy config; the feature must survive on Netlify static hosting
- Requirements that state the tone limitation in the requirement text itself, not buried in a design note
- Every browser path handled without a dead button: supported, unsupported, permission denied, silence, network failure, and Safari's missing `end` event
- Pronunciation results kept strictly out of the SRS write path

**Non-Goals:**
- Tone correctness. Explicitly out of scope — see D2.
- Tone-contour / F0 pitch analysis via `AudioWorklet`. Deferred; see "Deferred: tone-contour analysis".
- Any Whisper, Cloud Function, Netlify Function or other server-side transcription
- Per-syllable or per-phoneme scoring; the browser exposes neither
- Offline pronunciation assessment. Chrome streams audio to Google's servers; a network-dependent feature is accepted.
- Feeding pronunciation results into scheduling, retention stats or `dailyStats`

## Decisions

### D1: Web Speech API `SpeechRecognition`, not `MediaRecorder` plus a service

The recognizer owns the microphone. The page calls `start()`, the browser handles capture, endpointing and transcription, and fires `result` with an `N`-best list. No `getUserMedia`, no `MediaRecorder`, no `Blob`, no upload.

**Why**: It is the only speech-to-text path available to a static site with no backend and no API key. It also deletes the entire failure surface of the old component — no CORS, no origin-relative-vs-absolute URL bug, no multipart upload, no audio container mismatch.

**Note on the old requirement's "WAV/PCM audio stream"**: that was never true. `PronunciationAssessor.tsx:31` constructs `new Blob(chunks, { type: 'audio/wav' })`, but `MediaRecorder` does not emit WAV in any shipping browser — Chrome and Firefox produce WebM/Opus, Safari produces MP4/AAC. The `audio/wav` string was a mislabel on Opus data, and the server would have had to transcode regardless. Dropping the requirement loses nothing that existed.

**Alternative**: keep `MediaRecorder` and add a Netlify Function calling the OpenAI transcription API. Rejected — reintroduces a serverless backend and a metered API key, which is the exact cost and ops burden the architecture change removed.

### D2: The output is a word-identity check, not a tone check — and the spec says so

This is the load-bearing decision of the whole change.

`SpeechRecognition` with `lang='zh-CN'` returns `SpeechRecognitionAlternative.transcript` as a string of **Han characters**. It never returns pinyin, never returns tone marks or tone numbers, and exposes no phoneme segmentation, no pitch track and no per-syllable confidence. The only numeric field is `confidence`, a single opaque float for the whole utterance that Chrome populates inconsistently and Safari often leaves at `0`.

Worse than merely absent: the signal is actively **biased toward false "correct" verdicts**. A production Mandarin ASR carries a strong language model whose job is to recover the intended word from imperfect acoustics. A learner who says *péngyou* with the wrong tone on either syllable will, in most contexts, still get 朋友 back — the language model silently repairs exactly the error the learner needs to be told about. The system therefore cannot distinguish "said it correctly" from "said it wrongly but recognisably". It fails toward praise.

There is a narrower true statement available: *the recognizer heard the target word*. That is genuinely useful — it catches wrong initials, wrong finals, wrong word entirely, and mumbling — and it is honestly checkable. So the assessment is redefined as word identity, and the tone limitation is written into the requirement text, the UI disclaimer and this document. The old `Pinyin tone comparison` requirement is removed outright rather than reworded, because its stated inputs (a pinyin transcription, tone numbers 1–5) do not exist on this platform and no rewording produces them.

**Alternative**: infer tone correctness from the confidence score. Rejected — confidence is per-utterance, not per-syllable, and is not calibrated to tone accuracy; it would be a fabricated verdict dressed as a measurement.

### D3: Five verdicts, derived from the N-best list

`maxAlternatives = 5` gives an ordered alternatives list. Against the card's target simplified string:

| Verdict | Condition | Colour token |
| --- | --- | --- |
| `match` | target is alternative index 0 | `--color-correct` |
| `near-match` | target appears at index 1..n | `--color-correct` |
| `homophone` | a recognized alternative's **toneless** pinyin equals the target's toneless pinyin | `--color-unrecognized` |
| `mismatch` | transcript returned, target absent from all alternatives | `--color-incorrect` |
| `unrecognized` | no result, or `no-speech` | `--color-unrecognized` |

`near-match` is treated as encouraging rather than failing: the recognizer's top pick being 是 when the learner said 试 is a routine homophone ranking artefact, not evidence of a mispronunciation.

The `homophone` verdict is the one place the existing dictionary earns its keep. `words.db` already carries a `pinyin` column (`client/src/lib/worddb.ts:7`), queried by `getWord(simplified)` (`worddb.ts:46-50`). Strip tone marks and diacritics from both the target's pinyin and the recognized string's pinyin; if the toneless forms match but the characters differ, the learner produced the right *syllables* and the ASR picked a different character. Reporting that as a plain `mismatch` would be actively misleading, so it gets its own verdict and its own amber colour. Note the honest reading: a `homophone` result means the syllables were right and **the tone is exactly what could not be checked** — 买 vs 卖 (mǎi/mài) is the canonical case.

**Why toneless**: comparing *with* tones would imply the pinyin came from the learner's audio. It did not. It came from the dictionary row of whatever character the ASR chose, so its tone marks describe the dictionary word, not the utterance. Comparing tone marks here would manufacture precisely the fake tone verdict D2 forbids.

**Alternative**: two verdicts, correct/incorrect. Rejected — it collapses the homophone case into a failure and gives the learner no way to self-diagnose.

### D4: Capability detection hides the feature; it never errors

Feature-detect `window.SpeechRecognition ?? window.webkitSpeechRecognition` once at module load. Absent means the microphone affordance is not rendered at all (or is rendered disabled with an explanatory tooltip). No toast, no error text, no red state.

Browser reality as of this change: Chrome, Edge and Opera implement it behind the `webkit` prefix. Safari 14.1+ and iOS Safari 14.5+ implement it but are flaky — see D5. **Firefox ships it disabled behind the `dom.webspeech.recognition.enable` pref**, so for every practical purpose Firefox is unsupported.

**Why silence rather than an error**: a Firefox user has not done anything wrong and has no remedy. An error toast on every card would be noise about a permanent condition. Absence is the correct signal for "your browser does not offer this"; errors are reserved for conditions the user can act on, such as a denied microphone permission.

### D5: A watchdog timeout, because Safari does not reliably fire `end`

The documented lifecycle is `start` → `audiostart` → `speechstart` → `result` → `speechend` → `end`. Safari frequently drops the terminal `end` event, and can fire `result` without ever firing `end`, leaving the UI pinned in "listening" with a dead stop button.

So the recognizer is wrapped in a timer armed on `start()` and cleared by whichever of `result`, `error` or `end` arrives first. On expiry the wrapper calls `abort()`, forces the UI back to idle and settles the verdict as `unrecognized`. Every path out of the listening state is owned by the wrapper, not by the browser's goodwill.

Error codes are normalised to user-facing copy in the same wrapper: `no-speech` → "Didn't catch that — try again"; `audio-capture` → "No microphone found"; `not-allowed` → "Microphone permission denied" (persistent, since a retry without a settings change will fail identically); `network` → "Recognition needs an internet connection"; `aborted` → silent, since it is usually the user's own cancel or the watchdog.

### D6: Advisory only — the result never reaches `srs.ts` or `firestore.ts`

The study flow grades on two booleans, `knewPron` and `knewMeaning`, collected by the learner's own self-assessment buttons and passed to `applyBinaryReview` (`client/src/lib/srs.ts:72`) and then to `setUserWord` / `upsertDailyStats` (`client/src/lib/firestore.ts:87,143`). The pronunciation verdict is rendered beside that flow and enters none of it.

**Why this is a requirement and not a convention**: by D2 the signal is biased toward false positives. Wiring it into `intervalPinyin` would inflate intervals on words the learner is mispronouncing — the SRS would schedule *less* practice precisely where more is needed, and the damage would be silent and cumulative in the review history. An unreliable measurement is fine as advice and unacceptable as data. Making it a spec requirement with its own scenario means a future contributor wiring the two together has to knowingly delete a requirement rather than casually "improve" the integration.

### D7: Mounted once the pronunciation is revealed

`StudyPage.tsx:10` declares `Phase = 'pron-hidden' | 'pron-revealed' | 'meaning-hidden' | 'meaning-revealed'`, and the pinyin block is visible whenever `phase !== 'pron-hidden'` (`StudyPage.tsx:312`, `pronVisible`). The assessor mounts under the same condition.

**Why not at `pron-hidden`**: that phase is the recall test — the learner is being asked whether they know the pronunciation, and the pinyin is deliberately hidden. Offering a microphone there converts a retrieval exercise into a guess, and a `mismatch` verdict would leak the answer before the learner has committed. Once the pinyin is on screen the exercise is production practice, which is what this feature is for.

Existing keyboard bindings (`←` fail-and-reveal, `↑`/`R` replay audio, `↓` speak sentence, `→`/Space advance) are not to be shadowed; the microphone is pointer/tap-driven, and any future hotkey must avoid those.

## Risks / Trade-offs

- **False "correct" verdicts are the expected case, not an edge case** → The ASR language model repairs tone errors. Mitigated by D2's honest framing, by the persistent UI disclaimer, and structurally by D6 keeping the signal out of scheduling. Not fully solvable within the Web Speech API.
- **Chrome sends audio to Google's servers** → Recognition is not local and not private, and it fails offline. Accepted for a personal learning tool; the `network` error code is surfaced plainly so the failure is legible.
- **Effectively Chromium plus flaky Safari** → Firefox users get no feature at all (D4). Accepted: the alternative is a paid API, which the owner has ruled out.
- **Undirected recognition mishears short single-syllable words** → With no phrase-list biasing available, a bare 是 or 四 is a genuinely hard recognition target and will produce spurious `mismatch` results. Partly mitigated by `maxAlternatives = 5` and the `near-match` and `homophone` verdicts; residual noise is tolerable precisely because the result is advisory.
- **`SpeechRecognition` is absent from TypeScript's DOM lib** → Requires a hand-written ambient declaration in `client/src/types/speech.d.ts`. Small, static, and the only alternative is `any` casts scattered across the component.
- **Toneless-pinyin normalisation is hand-rolled** → No pinyin library is in `client/package.json` and none is being added. Stripping diacritics via `String.prototype.normalize('NFD')` and a combining-mark regex handles the standard tone-marked vowels including `ü`/`ǖǘǚǜ`; it is a narrow, testable function, not a general pinyin engine.

## Deferred: tone-contour analysis

The only way a browser can genuinely judge Mandarin tones is to analyse the audio itself: capture via `getUserMedia`, run an `AudioWorklet` doing autocorrelation or YIN pitch detection to extract an F0 track, normalise it per speaker, segment it by syllable, and compare each contour's shape against the expected tone class (high-flat, rising, dip-rise, falling, neutral).

That is a real signal-processing project. It needs per-speaker pitch-range calibration, voiced/unvoiced segmentation, syllable alignment without a forced aligner, and a tolerance model that does not punish natural sandhi — 三声 sandhi alone (3+3 → 2+3) means the "expected" contour depends on the neighbouring syllable. Getting it wrong produces confidently wrong tone verdicts, which is worse for a learner than the honest "tones not checked" this change ships.

It is therefore **explicitly deferred to a future change** and is not specified here. Nothing in this design blocks it: if it is built later, it becomes an additional signal alongside the word-identity verdict, and D6's advisory-only constraint should be re-examined at that point — but only then, and only with evidence that the contour verdict is accurate enough to schedule on.
