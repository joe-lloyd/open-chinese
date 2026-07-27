## ADDED Requirements

### Requirement: SpeechRecognition capability detection
The system SHALL feature-detect `window.SpeechRecognition ?? window.webkitSpeechRecognition` before offering any pronunciation affordance. Where the constructor is absent the system SHALL hide or disable the microphone control entirely, with an explanatory tooltip on the disabled control, and SHALL NOT show an error toast, error text, or any failure state — an unsupported browser is a permanent condition the user cannot remedy, so absence is the correct signal. Detection SHALL be performed once and its result reused; the system SHALL NOT attempt to construct a recognizer to test for support.

#### Scenario: Supported browser exposes the microphone control
- **WHEN** the study card renders in Chrome, Edge, or Opera, where `window.webkitSpeechRecognition` is defined
- **THEN** the microphone control SHALL be rendered and enabled

#### Scenario: Firefox receives no microphone control
- **WHEN** the study card renders in Firefox, where `SpeechRecognition` is disabled behind the `dom.webspeech.recognition.enable` preference and neither global is defined
- **THEN** the microphone control SHALL be absent or disabled with an explanatory tooltip
- **AND** no error toast, error message, or failure styling SHALL be shown
- **AND** the study session SHALL otherwise behave identically to a supported browser

#### Scenario: Unsupported browser does not block the study flow
- **WHEN** the pronunciation feature is unavailable
- **THEN** card reveal, self-assessment buttons, keyboard shortcuts, and SRS scheduling SHALL all continue to function unchanged

### Requirement: Speech capture via the Web Speech API
The system SHALL capture learner speech using a `SpeechRecognition` instance configured with `lang = 'zh-CN'`, `continuous = false`, `interimResults = false`, and `maxAlternatives = 5`. Push-to-talk SHALL map pressing the control to `start()` and releasing it to `stop()`. The system SHALL NOT use `MediaRecorder`, SHALL NOT construct an audio `Blob`, and SHALL NOT upload audio to any endpoint; the Web Speech API owns the microphone stream end to end.

The system SHALL handle the `no-speech`, `audio-capture`, `not-allowed`, `network`, and `aborted` error codes distinctly, and SHALL arm a client-side watchdog timeout on `start()` that is cleared by whichever of `result`, `error`, or `end` arrives first. On watchdog expiry the system SHALL call `abort()`, return the UI to idle, and settle the attempt as `unrecognized`. The watchdog is required because Safari does not reliably fire the terminal `end` event and can leave the UI pinned in a listening state.

#### Scenario: Push-to-talk starts and stops recognition
- **WHEN** the learner presses and holds the microphone control
- **THEN** the system SHALL call `start()` on a recognizer configured with `lang='zh-CN'`, `continuous=false`, `interimResults=false`, `maxAlternatives=5`
- **AND** a listening indicator SHALL be shown
- **AND** releasing the control SHALL call `stop()`

#### Scenario: Silence produces an unrecognized result
- **WHEN** the recognizer fires an `error` event with code `no-speech`
- **THEN** the attempt SHALL settle as `unrecognized`
- **AND** the system SHALL display "Didn't catch that — try again"

#### Scenario: Microphone permission denied
- **WHEN** the recognizer fires an `error` event with code `not-allowed`
- **THEN** the system SHALL display a persistent "Microphone permission denied" message rather than a transient toast
- **AND** the system SHALL NOT automatically retry recognition

#### Scenario: No microphone hardware available
- **WHEN** the recognizer fires an `error` event with code `audio-capture`
- **THEN** the system SHALL display "No microphone found"
- **AND** the listening indicator SHALL be cleared

#### Scenario: Network failure during recognition
- **WHEN** the recognizer fires an `error` event with code `network`
- **THEN** the system SHALL display a message stating that recognition requires an internet connection
- **AND** the study session SHALL continue without a pronunciation verdict

#### Scenario: Aborted recognition is silent
- **WHEN** the recognizer fires an `error` event with code `aborted`
- **THEN** the system SHALL return to idle without displaying an error message

#### Scenario: Watchdog recovers a hung recognizer
- **WHEN** the recognizer has been started and the watchdog interval elapses with no `result`, `error`, or `end` event, as occurs in Safari when the terminal `end` event is dropped
- **THEN** the system SHALL call `abort()`
- **AND** the listening indicator SHALL be cleared and the control SHALL return to idle
- **AND** the attempt SHALL settle as `unrecognized`

### Requirement: Word-identity assessment against the target
The system SHALL assess an attempt by comparing the recognized transcript and its alternatives against the study card's target simplified string, producing exactly one verdict: `match` when the target is the top-ranked alternative; `near-match` when the target appears among the remaining alternatives; `homophone` when a recognized alternative's TONELESS pinyin equals the target's toneless pinyin but the characters differ; `mismatch` when a transcript was returned and the target appears in no alternative; `unrecognized` when no transcript was produced.

Toneless pinyin SHALL be derived from the existing `pinyin` column of `words.db`, looked up via `getWord(simplified)` in `client/src/lib/worddb.ts`, with tone diacritics stripped. Comparison SHALL be toneless because the pinyin is read from the dictionary row of whichever character the recognizer chose — it describes that dictionary word, not the learner's utterance — so comparing tone marks would manufacture a tone verdict from data that never came from the audio.

This assessment establishes only **which word the recognizer heard**. It SHALL NOT be described, in the UI or in derived data, as verifying tones. `SpeechRecognition` at `lang='zh-CN'` returns Han characters only; it returns no pinyin, no tone marks, no tone numbers, and no phoneme or pitch data. A Mandarin recognizer's language model additionally repairs tone errors, so a learner using the wrong tone will usually still have the target word returned. The signal is therefore biased toward false "correct" verdicts and is not a tone check.

#### Scenario: Target recognized as top alternative
- **WHEN** the target simplified string is 朋友 and the top-ranked alternative transcript is 朋友
- **THEN** the verdict SHALL be `match`

#### Scenario: Target recognized in a lower-ranked alternative
- **WHEN** the target is 朋友, the top-ranked alternative is 碰友, and 朋友 appears at a lower rank among the five alternatives
- **THEN** the verdict SHALL be `near-match`
- **AND** it SHALL be presented as an encouraging rather than a failing outcome

#### Scenario: Homophone recognized instead of the target
- **WHEN** the target is 买 and the recognizer returns 卖, whose dictionary pinyin `mài` reduces to the same toneless form `mai` as the target's `mǎi`
- **THEN** the verdict SHALL be `homophone`
- **AND** the feedback SHALL make clear that the syllables matched and the tone is precisely what could not be verified

#### Scenario: A different word entirely
- **WHEN** the target is 朋友 and no alternative among the five contains the target or a toneless-pinyin equivalent
- **THEN** the verdict SHALL be `mismatch`

#### Scenario: No transcript produced
- **WHEN** recognition ends with no `result` event, or the watchdog expires
- **THEN** the verdict SHALL be `unrecognized`

#### Scenario: Wrong tone is not detected
- **WHEN** the learner says the target 朋友 with an incorrect tone and the recognizer's language model still returns 朋友
- **THEN** the verdict SHALL be `match`
- **AND** the system SHALL NOT claim the tone was correct

### Requirement: Feedback display with tone-limitation disclaimer
The system SHALL display the verdict using the existing CSS custom properties `--color-correct`, `--color-incorrect`, and `--color-unrecognized` defined at `client/src/index.css:12-14` and `:28-30`: `--color-correct` for `match` and `near-match`, `--color-incorrect` for `mismatch`, `--color-unrecognized` for `homophone` and `unrecognized`. The system SHALL display the actual recognized text alongside the verdict so the learner can self-diagnose what was heard. The system SHALL display a persistent disclaimer, present whenever the pronunciation feature is available and not dismissible per-card, stating that browser speech recognition checks which word was heard and does not verify tones.

#### Scenario: Recognized text is shown to the learner
- **WHEN** any verdict other than `unrecognized` is produced
- **THEN** the recognized transcript SHALL be rendered next to the verdict
- **AND** the learner SHALL be able to compare it against the target character string on the card

#### Scenario: Verdict colours use existing tokens
- **WHEN** a `mismatch` verdict is rendered
- **THEN** it SHALL use the `--color-incorrect` token
- **AND** it SHALL render legibly in both the light and dark themes without new colour definitions

#### Scenario: Tone disclaimer is always visible
- **WHEN** the pronunciation control is available on a study card
- **THEN** a disclaimer stating that tones are not verified SHALL be visible
- **AND** it SHALL remain visible after a `match` verdict rather than being replaced by a success message

### Requirement: Pronunciation results are advisory and never affect SRS scheduling
The pronunciation verdict SHALL be advisory only. It SHALL NOT be passed to `applyBinaryReview` in `client/src/lib/srs.ts`, SHALL NOT alter the `knewPron` or `knewMeaning` booleans collected from the learner's self-assessment, and SHALL NOT be written through `setUserWord`, `upsertDailyStats`, or any other function in `client/src/lib/firestore.ts`. No interval, ease factor, status, leech counter, daily aggregate, or retention figure SHALL be derived from it. Because the verdict is biased toward false "correct" results, admitting it into scheduling would silently inflate intervals on exactly the words the learner is mispronouncing.

#### Scenario: A match does not grade the card
- **WHEN** the learner records an attempt that produces a `match` verdict
- **THEN** no SRS state SHALL change
- **AND** the card SHALL still require the learner's own self-assessment button press to be graded and advanced

#### Scenario: A mismatch does not fail the card
- **WHEN** an attempt produces a `mismatch` verdict and the learner then presses "I knew it" for pronunciation
- **THEN** the review SHALL be recorded as `knewPron = true`
- **AND** the mismatch SHALL NOT reduce the interval, lower the ease factor, or increment the leech counter

#### Scenario: No pronunciation data reaches Firestore
- **WHEN** a study session containing pronunciation attempts completes
- **THEN** no verdict, transcript, or attempt count SHALL appear in any document under `users/{uid}`
- **AND** the daily aggregate SHALL count only self-assessed reviews

## REMOVED Requirements

### Requirement: Audio capture via MediaRecorder
**Reason**: The Web Speech API owns the microphone stream end to end, so `MediaRecorder`, `getUserMedia`, and the audio `Blob` are all unnecessary. The requirement's "WAV/PCM audio stream" was never accurate either: `client/src/components/PronunciationAssessor.tsx:31` labelled its `Blob` `audio/wav`, but `MediaRecorder` emits WebM/Opus in Chrome and Firefox and MP4/AAC in Safari — the WAV claim was a mislabel, not a format.
**Migration**: Superseded by "Speech capture via the Web Speech API". Push-to-talk is preserved, mapped to `SpeechRecognition.start()` / `stop()` instead of recorder start/stop.

### Requirement: Whisper transcription backend
**Reason**: There is no backend. `server/src/routes/pronounce.ts`, `server/src/lib/whisper.ts`, `whisper-cache.ts`, and `tone-compare.ts` were deleted in commit `8850661`, and the entire `server/` workspace was removed by the `firebase-netlify-architecture` change. The app deploys to Netlify as static files — `netlify.toml` declares only a `[build]` block, one SPA redirect, and two cache headers, with no functions directory. `WHISPER_BACKEND` and `OPENAI_API_KEY` exist only in stale documentation and have never appeared in shipping code.
**Migration**: All transcription runs in the browser via `SpeechRecognition`. No API key, no environment variable, and no server or serverless function is involved.

### Requirement: Pinyin tone comparison
**Reason**: Unachievable on this platform. `SpeechRecognition` with `lang='zh-CN'` returns a transcript of Han characters only — never pinyin, never tone marks, never tone numbers — and exposes no phoneme segmentation, pitch track, or per-syllable confidence, so the requirement's stated inputs (base syllables and tone numbers 1–5) do not exist. Furthermore a Mandarin recognizer's language model silently repairs tone errors, so recognizer output is biased toward false "correct" verdicts and cannot serve as a tone check at all.
**Migration**: Superseded by "Word-identity assessment against the target", which checks which word was recognized and states in its own text that it does not verify tones. Genuine tone assessment would require F0 contour analysis over raw audio and is explicitly deferred to a future change; see `design.md`.

### Requirement: Color-coded feedback display
**Reason**: Its semantics — "green for correct tone, red for incorrect tone, yellow for unrecognized syllable" — promise a per-syllable tone verdict the browser cannot produce, and it operates on syllables split from the target pinyin rather than on recognized words.
**Migration**: Superseded by "Feedback display with tone-limitation disclaimer". The same three CSS tokens (`--color-correct`, `--color-incorrect`, `--color-unrecognized` at `client/src/index.css:12-14` and `:28-30`) are reused, remapped from tone correctness to word-identity verdicts, and a persistent tone disclaimer is added.

### Requirement: Assessment result caching
**Reason**: The cache key was an audio content hash, but the Web Speech API never hands the page an audio buffer to hash. There is also nothing to save: recognition is free, runs in the browser, and has no per-call cost or rate limit to amortise. The server-side `whisper-cache.ts` that implemented this was deleted in commit `8850661`.
**Migration**: None. Each attempt runs a fresh recognition; repeated attempts on the same card are expected practice behaviour rather than waste.

### Requirement: Graceful degradation on backend unavailability
**Reason**: There is no backend that can be unavailable, so a 10-second Whisper API timeout has no meaning. The real failure modes are different in kind: an unsupported browser, a denied microphone permission, silence, or a lost network connection.
**Migration**: Replaced by two targeted requirements. "SpeechRecognition capability detection" covers permanent unavailability by hiding the feature silently rather than showing an error. "Speech capture via the Web Speech API" covers transient failures with explicit handling for the `no-speech`, `audio-capture`, `not-allowed`, `network`, and `aborted` error codes plus a watchdog timeout. The session continues without pronunciation feedback in every case.
