# audio-playback Specification

## Purpose
TBD - created by archiving change open-chinese. Update Purpose after archive.
## Requirements
### Requirement: TTS audio generation
The system SHALL generate spoken audio for any word using the browser's Web Speech API with a Mandarin Chinese voice (`lang=zh-CN`). If no `zh-CN` voice is available, the system SHALL fall back silently without error.

#### Scenario: Word audio plays on demand
- **WHEN** user clicks the audio button or presses R during a session
- **THEN** the word's simplified characters SHALL be spoken using the zh-CN TTS voice

#### Scenario: Missing voice falls back silently
- **WHEN** no zh-CN voice is installed in the browser
- **THEN** the audio button SHALL remain visible but clicking it SHALL produce no sound and no error UI

### Requirement: Audio playback on card reveal
The system SHALL automatically play the word's audio when the card back is revealed, if the targeted sub-skill is `audio`.

#### Scenario: Auto-play on audio sub-skill reveal
- **WHEN** the active sub-skill is `audio` and user reveals the card
- **THEN** the word's TTS audio SHALL play automatically without requiring a button press

#### Scenario: No auto-play for non-audio sub-skills
- **WHEN** the active sub-skill is `meaning` or `pinyin` and user reveals the card
- **THEN** audio SHALL NOT play automatically (user must press R or click audio button)

### Requirement: Audio replay button
The system SHALL render an audio replay button on the card back face. The button SHALL be accessible via keyboard (R key) and mouse click.

#### Scenario: Replay button replays audio
- **WHEN** user clicks the audio replay button after card reveal
- **THEN** the word's TTS audio SHALL play from the beginning

### Requirement: Configurable TTS rate and pitch
The system SHALL expose settings for TTS speech rate (0.5–1.5, default 0.8) and pitch (0.5–2.0, default 1.0) to allow users to slow down pronunciation for study.

#### Scenario: Slowed rate plays slower audio
- **WHEN** user sets speech rate to 0.5 and plays a word
- **THEN** the spoken audio SHALL play at half the default speed

