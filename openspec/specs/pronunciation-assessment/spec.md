# pronunciation-assessment Specification

## Purpose
TBD - created by archiving change open-chinese. Update Purpose after archive.
## Requirements
### Requirement: Audio capture via MediaRecorder
The system SHALL capture user speech using the browser's `MediaRecorder` API producing a WAV/PCM audio stream. Recording SHALL start on button press and stop on button release (push-to-talk model).

#### Scenario: Push-to-talk captures audio
- **WHEN** user holds the microphone button
- **THEN** audio recording SHALL be active and a visual recording indicator SHALL be shown

#### Scenario: Release stops recording and triggers assessment
- **WHEN** user releases the microphone button
- **THEN** recording SHALL stop and the captured audio SHALL be sent for transcription

### Requirement: Whisper transcription backend
The system SHALL send captured audio to either the OpenAI Whisper API or a local `whisper.cpp` binary, controlled by the `WHISPER_BACKEND` environment variable (`api` | `local`). The transcription request SHALL force Chinese language detection.

#### Scenario: API backend transcribes audio
- **WHEN** `WHISPER_BACKEND=api` and audio is submitted
- **THEN** the system SHALL call the OpenAI Whisper API with `language=zh` parameter and return the pinyin transcription

#### Scenario: Local backend transcribes audio
- **WHEN** `WHISPER_BACKEND=local` and audio is submitted
- **THEN** the system SHALL invoke the local `whisper.cpp` binary with Chinese language forcing and return the transcription

### Requirement: Pinyin tone comparison
The system SHALL compare the Whisper-generated transcription against the card's target pinyin string, evaluating both base syllables and tone numbers (1–5, where 5 = neutral).

#### Scenario: Correct tone matches target
- **WHEN** transcription produces `péngyou` (peng2 you3) and target is `péngyou`
- **THEN** both characters SHALL be marked correct (green)

#### Scenario: Wrong tone flags character
- **WHEN** transcription produces `pengyou` with tone 1 but target is tone 2
- **THEN** the relevant character SHALL be marked incorrect (red) with correct tone displayed

### Requirement: Color-coded feedback display
The system SHALL render character-level color feedback after assessment: green for correct tone, red for incorrect tone, yellow for unrecognized syllable.

#### Scenario: Mixed result renders partial feedback
- **WHEN** first syllable is correct and second syllable tone is wrong
- **THEN** first character SHALL render green and second character SHALL render red

### Requirement: Assessment result caching
The system SHALL cache assessment results keyed by (audio content hash, target pinyin). Duplicate submissions SHALL return the cached result without re-calling Whisper.

#### Scenario: Repeated audio submission returns cached result
- **WHEN** same audio hash is submitted twice for the same card
- **THEN** the second request SHALL return the cached result instantly without calling the Whisper backend

### Requirement: Graceful degradation on backend unavailability
The system SHALL display a non-blocking error message if the Whisper backend is unreachable and allow the session to continue without pronunciation scoring.

#### Scenario: Whisper API timeout
- **WHEN** the Whisper API does not respond within 10 seconds
- **THEN** the system SHALL show an error toast and let the user continue reviewing without pronunciation feedback

