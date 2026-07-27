/**
 * Web Speech API recognition wrapper.
 *
 * Owns the whole recognizer lifecycle so no code path can leave the UI pinned in
 * a listening state: `result`, `error`, `end` and a watchdog timer all funnel
 * through one idempotent settler.
 *
 * No `MediaRecorder`, no `getUserMedia`, no `Blob`, no upload — the browser owns
 * the microphone stream end to end and hands back only a transcript.
 */

export type SpeechErrorCode =
  | 'no-speech'
  | 'audio-capture'
  | 'not-allowed'
  | 'network'
  | 'aborted'
  | 'timeout'
  | 'unknown'

export interface RecognitionOutcome {
  alternatives: string[]
  error: SpeechErrorCode | null
}

export interface RecognitionSession {
  stop: () => void
  abort: () => void
  done: Promise<RecognitionOutcome>
}

/**
 * Safari drops the terminal `end` event often enough that the browser cannot be
 * trusted to end the session. Ten seconds is well past any single-word utterance.
 */
const WATCHDOG_MS = 10_000

const MAX_ALTERNATIVES = 5

const HANDLED_ERRORS = ['no-speech', 'audio-capture', 'not-allowed', 'network', 'aborted']

/**
 * Resolved once at module load and reused. Constructing a recognizer to probe
 * for support would prompt for the microphone as a side effect.
 */
const CTOR: SpeechRecognitionConstructor | null =
  typeof window === 'undefined'
    ? null
    : window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null

export function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  return CTOR
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null
}

function normaliseError(raw: string): SpeechErrorCode {
  return HANDLED_ERRORS.includes(raw) ? (raw as SpeechErrorCode) : 'unknown'
}

/** User-facing copy, or `null` where the condition should stay silent. */
export function errorMessage(code: SpeechErrorCode): string | null {
  switch (code) {
    case 'no-speech':
      return "Didn't catch that — try again"
    case 'audio-capture':
      return 'No microphone found'
    case 'not-allowed':
      return 'Microphone permission denied'
    case 'network':
      return 'Recognition needs an internet connection'
    // The user's own cancel, or the watchdog cleaning up after a browser that
    // never closed the session. Neither is something to report.
    case 'aborted':
    case 'timeout':
      return null
    case 'unknown':
      return 'Speech recognition failed'
  }
}

export function startRecognition(): RecognitionSession {
  const Ctor = getSpeechRecognitionCtor()
  if (!Ctor) {
    return {
      stop: () => {},
      abort: () => {},
      done: Promise.resolve({ alternatives: [], error: 'unknown' }),
    }
  }

  const recognition = new Ctor()
  recognition.lang = 'zh-CN'
  recognition.continuous = false
  recognition.interimResults = false
  recognition.maxAlternatives = MAX_ALTERNATIVES

  let settled = false
  let watchdog: ReturnType<typeof setTimeout> | null = null
  let resolveDone: (outcome: RecognitionOutcome) => void = () => {}
  const done = new Promise<RecognitionOutcome>((resolve) => {
    resolveDone = resolve
  })

  // Whichever of result / error / end / watchdog arrives first wins; the rest
  // are no-ops, so `done` resolves exactly once on every path.
  const settle = (outcome: RecognitionOutcome) => {
    if (settled) return
    settled = true
    if (watchdog !== null) {
      clearTimeout(watchdog)
      watchdog = null
    }
    resolveDone(outcome)
  }

  recognition.onresult = (event) => {
    const result = event.results[0]
    const alternatives: string[] = []
    if (result) {
      const count = Math.min(result.length, MAX_ALTERNATIVES)
      for (let i = 0; i < count; i++) {
        const transcript = result[i]?.transcript?.trim()
        if (transcript) alternatives.push(transcript)
      }
    }
    settle({ alternatives, error: null })
  }

  recognition.onerror = (event) => {
    settle({ alternatives: [], error: normaliseError(event.error) })
  }

  // `end` after a result is a no-op. `end` without one means the recognizer
  // closed the session having heard nothing.
  recognition.onend = () => {
    settle({ alternatives: [], error: null })
  }

  try {
    recognition.start()
  } catch {
    // start() throws InvalidStateError if this instance is already running.
    settle({ alternatives: [], error: 'unknown' })
    return { stop: () => {}, abort: () => {}, done }
  }

  if (!settled) {
    watchdog = setTimeout(() => {
      watchdog = null
      try {
        recognition.abort()
      } catch {
        // Already torn down — nothing to abort.
      }
      settle({ alternatives: [], error: 'timeout' })
    }, WATCHDOG_MS)
  }

  return {
    stop: () => {
      try {
        recognition.stop()
      } catch {
        // Not running — the outcome has already settled.
      }
    },
    abort: () => {
      try {
        recognition.abort()
      } catch {
        // Not running — the outcome has already settled.
      }
      settle({ alternatives: [], error: 'aborted' })
    },
    done,
  }
}
