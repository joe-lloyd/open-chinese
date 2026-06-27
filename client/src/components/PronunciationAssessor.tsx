import { useRef, useState } from 'react'

interface Props {
  targetPinyin: string
}

type ToneResult = 'correct' | 'incorrect' | 'unrecognized'

const COLOR_CLASS: Record<ToneResult, string> = {
  correct: 'text-correct',
  incorrect: 'text-incorrect',
  unrecognized: 'text-unrecognized',
}

export default function PronunciationAssessor({ targetPinyin }: Props) {
  const [recording, setRecording] = useState(false)
  const [result, setResult] = useState<ToneResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  async function startRecording() {
    setError(null)
    setResult(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data)
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/wav' })
        const form = new FormData()
        form.append('audio', blob, 'recording.wav')
        form.append('targetPinyin', targetPinyin)
        try {
          const res = await fetch('http://localhost:3001/api/pronounce', { method: 'POST', body: form })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error)
          setResult(data.result)
        } catch (e) {
          setError((e as Error).message)
        }
        stream.getTracks().forEach((t) => t.stop())
      }
      mediaRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch {
      setError('Microphone access denied')
    }
  }

  function stopRecording() {
    mediaRef.current?.stop()
    setRecording(false)
  }

  const syllables = targetPinyin.trim().split(/\s+/)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            recording
              ? 'bg-incorrect text-white scale-95'
              : 'border border-border text-text-muted hover:text-text-primary'
          }`}
        >
          {recording ? '⏹ Recording…' : '🎤 Hold to record'}
        </button>
        {recording && (
          <span className="w-2 h-2 rounded-full bg-incorrect animate-pulse" />
        )}
      </div>

      {error && <p className="text-sm text-incorrect">{error}</p>}

      {result && (
        <div className="flex gap-1 flex-wrap">
          {syllables.map((syl, i) => (
            <span
              key={i}
              className={`text-base font-medium ${COLOR_CLASS[result[i] ?? 'unrecognized']}`}
            >
              {syl}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
