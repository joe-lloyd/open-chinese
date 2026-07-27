# audio-playback Specification

## Purpose
Speaks Mandarin words and example sentences aloud in the browser using the Web Speech API, so the learner hears correct pronunciation during study. Requires no audio assets, no network calls, and no server.
## Requirements
### Requirement: TTS audio generation
The system SHALL generate spoken audio for any word using the browser's Web Speech API with a Mandarin Chinese voice (`lang=zh-CN`). If no `zh-CN` voice is available, the system SHALL fall back silently without error. Each new utterance SHALL cancel any utterance still in progress, so playback never overlaps.

#### Scenario: Word audio plays on demand
- **WHEN** user clicks the audio button or presses ↑ or R during a session
- **THEN** the word's simplified characters SHALL be spoken using the zh-CN TTS voice

#### Scenario: Missing voice falls back silently
- **WHEN** no zh-CN voice is installed in the browser
- **THEN** the audio button SHALL remain visible but clicking it SHALL produce no sound and no error UI

#### Scenario: New utterance cancels the previous one
- **WHEN** audio is triggered while a previous utterance is still speaking
- **THEN** the previous utterance SHALL be cancelled
- **AND** only the new utterance SHALL be heard

### Requirement: Audio replay button
The system SHALL render an audio replay button beneath the revealed pinyin. The button SHALL be operable by mouse click and by the ↑ and R keys, and SHALL be labelled with its keyboard binding as `↑ / R`. The button SHALL NOT be interactive while the pronunciation is hidden.

#### Scenario: Replay button replays audio
- **WHEN** user clicks the audio replay button after card reveal
- **THEN** the word's TTS audio SHALL play from the beginning

#### Scenario: Button advertises both keys
- **WHEN** the pronunciation is revealed
- **THEN** the replay control SHALL show the binding `↑ / R`

### Requirement: Configurable TTS rate and pitch
The system SHALL expose settings for TTS speech rate (0.5–1.5, default 0.8) and pitch (0.5–2.0, default 1.0) to allow users to slow down pronunciation for study. These settings SHALL be persisted to the browser's `localStorage` under the key `tts-settings` and SHALL be read on every utterance. They are therefore **per-device**: they SHALL NOT be written to the user's Firestore profile and SHALL NOT follow the user to another browser or device. If the stored value is missing or cannot be parsed, the system SHALL fall back to the defaults without error.

#### Scenario: Slowed rate plays slower audio
- **WHEN** user sets speech rate to 0.5 and plays a word
- **THEN** the spoken audio SHALL play at half the default speed

#### Scenario: Settings persist across reloads on the same device
- **WHEN** the user changes rate or pitch and reloads the app
- **THEN** the changed values SHALL be read back from the `tts-settings` localStorage key
- **AND** SHALL apply to subsequent utterances

#### Scenario: Settings do not follow the user to another device
- **WHEN** the same signed-in user opens the app in a different browser or on a different device
- **THEN** that browser SHALL use its own `tts-settings` value, or the defaults if it has none
- **AND** no TTS rate or pitch value SHALL be read from or written to the Firestore user profile

#### Scenario: Corrupt stored settings fall back to defaults
- **WHEN** the `tts-settings` value is absent or is not valid JSON
- **THEN** the system SHALL use rate 0.8 and pitch 1.0
- **AND** SHALL NOT raise an error

### Requirement: Audio plays automatically on pronunciation reveal and on fail
The system SHALL speak the word automatically whenever its pronunciation becomes visible, without requiring a button press. This SHALL happen on both paths that reveal it:

- **Reveal** — when the user reveals the pronunciation (`→`, `Space`, or the reveal button), the word SHALL be spoken as the pinyin appears.
- **Fail** — when the user answers "I don't know" (`←` or the fail button) at any phase, the full card SHALL be revealed and the word SHALL be spoken, so the correct pronunciation is heard at the moment of failure.

Auto-play SHALL NOT be conditional on any targeted sub-skill, review dimension, or user setting other than the browser's TTS availability.

#### Scenario: Revealing pronunciation plays audio
- **WHEN** the user reveals the pronunciation of a card
- **THEN** the word's TTS audio SHALL play automatically
- **AND** the pinyin SHALL become visible

#### Scenario: Failing at any phase plays audio
- **WHEN** the user answers "I don't know" during the pronunciation-hidden, pronunciation-revealed, or meaning-hidden phase
- **THEN** the full card SHALL be revealed
- **AND** the word's TTS audio SHALL play automatically

#### Scenario: Auto-play is unconditional across cards
- **WHEN** any card's pronunciation is revealed, whatever its status, deck, or HSK level
- **THEN** the word's TTS audio SHALL play automatically
- **AND** no configuration SHALL be required to enable it

### Requirement: Example sentence playback
When a card's meaning has been revealed, the system SHALL speak the card's example sentence on `↓`. The shortcut SHALL be inert when the meaning is not yet revealed, and inert when the card has no example sentence. The keyboard help overlay SHALL list `↓` as "Play example sentence (when revealed)".

#### Scenario: Down arrow speaks the example sentence
- **WHEN** the meaning is revealed, the card has a non-empty example sentence, and the user presses `↓`
- **THEN** the example sentence SHALL be spoken using the zh-CN TTS voice
- **AND** the default scroll behaviour of the arrow key SHALL be suppressed

#### Scenario: Down arrow is inert before the meaning is revealed
- **WHEN** the user presses `↓` during the pronunciation-hidden, pronunciation-revealed, or meaning-hidden phase
- **THEN** no audio SHALL play
- **AND** the card SHALL NOT advance or change phase

#### Scenario: Card without an example sentence plays nothing
- **WHEN** the meaning is revealed for a card that has no example sentence and the user presses `↓`
- **THEN** no audio SHALL play
- **AND** no error SHALL be shown

