import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage, isSpeechRecognitionSupported, startRecognition } from '../lib/speech'
import type { RecognitionSession, SpeechErrorCode } from '../lib/speech'
import { assess } from '../lib/pronunciation'
import type { Assessment, Verdict } from '../lib/pronunciation'
import { loadDB } from '../lib/worddb'

interface Props {
  target: string
  targetPinyin: string
}

/**
 * Resolved once at module load. A Firefox user has no remedy for this, so the
 * control is disabled with an explanation rather than being made to fail.
 */
const SUPPORTED = isSpeechRecognitionSupported()

/**
 * `--color-correct` / `--color-incorrect` / `--color-unrecognized` are declared
 * for both themes in `index.css`. The utility classes are kept for consistency
 * with the rest of the app, but the inline `var()` is what actually paints:
 * these three colours are not in `tailwind.config.ts`, so the classes currently
 * compile to nothing.
 */
const VERDICT_STYLE: Record<Verdict, { className: string; color: string; label: string }> = {
  match: {
    className: 'text-correct',
    color: 'var(--color-correct)',
    label: 'Heard the target word',
  },
  'near-match': {
    className: 'text-correct',
    color: 'var(--color-correct)',
    label: 'Close — the target was among the alternatives',
  },
  homophone: {
    className: 'text-unrecognized',
    color: 'var(--color-unrecognized)',
    label: 'Same syllables, different character — the tone is what could not be checked',
  },
  mismatch: {
    className: 'text-incorrect',
    color: 'var(--color-incorrect)',
    label: 'A different word was heard',
  },
  unrecognized: {
    className: 'text-unrecognized',
    color: 'var(--color-unrecognized)',
    label: 'Nothing recognized',
  },
}

export default function PronunciationAssessor({ target, targetPinyin }: Props) {
  const [listening, setListening] = useState(false)
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [errorCode, setErrorCode] = useState<SpeechErrorCode | null>(null)
  const sessionRef = useRef<RecognitionSession | null>(null)
  // Bumped on every new attempt and on unmount, so a late-settling recognition
  // from a previous card can never write its verdict into the current one.
  const attemptRef = useRef(0)

  useEffect(() => {
    setListening(false)
    setAssessment(null)
    setErrorCode(null)
    return () => {
      attemptRef.current += 1
      sessionRef.current?.abort()
      sessionRef.current = null
    }
  }, [target])

  const start = useCallback(() => {
    if (!SUPPORTED || sessionRef.current) return

    setAssessment(null)
    setErrorCode(null)
    setListening(true)

    attemptRef.current += 1
    const attempt = attemptRef.current
    const session = startRecognition()
    sessionRef.current = session

    session.done.then((outcome) => {
      if (attempt !== attemptRef.current) return
      sessionRef.current = null
      setListening(false)
      setErrorCode(outcome.error)

      // `aborted` is the learner's own cancel; the other hard errors mean no
      // attempt happened at all, so neither produces a verdict.
      if (outcome.error === 'no-speech' || outcome.error === 'timeout') {
        setAssessment({ verdict: 'unrecognized', heard: null })
        return
      }
      if (outcome.error !== null) return

      loadDB()
        .then((db) => {
          if (attempt !== attemptRef.current) return
          setAssessment(assess(outcome.alternatives, target, (s) => db.getWord(s), targetPinyin))
        })
        .catch(() => {
          if (attempt !== attemptRef.current) return
          // Dictionary unavailable — fall back to identity comparison only,
          // which costs the homophone verdict but never blocks feedback.
          setAssessment(assess(outcome.alternatives, target, () => null, targetPinyin))
        })
    })
  }, [target, targetPinyin])

  const stop = useCallback(() => {
    sessionRef.current?.stop()
  }, [])

  if (!SUPPORTED) {
    return (
      <div className="flex flex-col items-center gap-1 text-center">
        <button
          type="button"
          disabled
          title="This browser does not support speech recognition. Chrome, Edge and Opera do."
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-text-muted opacity-40 cursor-not-allowed"
        >
          🎤 Hold to speak
        </button>
      </div>
    )
  }

  const message = errorCode ? errorMessage(errorCode) : null
  const style = assessment ? VERDICT_STYLE[assessment.verdict] : null

  return (
    <div className="h-24 flex flex-col items-center justify-start gap-1.5 text-center">
      <button
        type="button"
        onMouseDown={start}
        onMouseUp={stop}
        onMouseLeave={stop}
        onTouchStart={start}
        onTouchEnd={stop}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors select-none ${
          listening
            ? 'border-accent text-accent bg-accent/10'
            : 'border-border text-text-muted hover:text-text-primary hover:border-text-muted'
        }`}
      >
        {listening ? '● Listening…' : '🎤 Hold to speak'}
      </button>

      {/* Fixed-height feedback row so a verdict never shifts the card layout. */}
      <div className="h-8 flex items-center justify-center px-2">
        {message && (
          <p className="text-xs" style={{ color: 'var(--color-incorrect)' }}>
            {message}
          </p>
        )}
        {!message && style && (
          <p className="text-xs leading-tight">
            <span className={`font-medium ${style.className}`} style={{ color: style.color }}>
              {style.label}
            </span>
            {assessment?.heard && (
              <span className="text-text-muted"> · heard “{assessment.heard}”</span>
            )}
          </p>
        )}
      </div>

      {/*
        Persistent and non-dismissible, and deliberately still on screen after a
        `match`: the recognizer's language model repairs tone errors, so a match
        is evidence about the word, never about the tone.
      */}
      <p className="text-[10px] text-text-muted leading-tight max-w-xs">
        Checks which word was heard. Browser speech recognition does not verify tones.
      </p>
    </div>
  )
}
