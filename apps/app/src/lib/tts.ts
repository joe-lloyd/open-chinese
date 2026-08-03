export interface TTSSettings {
  rate: number
  pitch: number
  volume: number
}

export const DEFAULT_TTS_SETTINGS: TTSSettings = { rate: 0.8, pitch: 1.0, volume: 1.0 }
const MAX_UTTERANCE_CHARS = 100

/**
 * Merged over the defaults rather than returned as parsed: blobs written before
 * `volume` existed would otherwise hand `undefined` to the utterance.
 */
export function getSettings(): TTSSettings {
  try {
    const stored = localStorage.getItem('tts-settings')
    if (stored) return { ...DEFAULT_TTS_SETTINGS, ...JSON.parse(stored) }
  } catch {}
  return DEFAULT_TTS_SETTINGS
}

export function speechIsAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window
  )
}

function mandarinVoice(): SpeechSynthesisVoice | null {
  if (!speechIsAvailable()) return null
  const voices = window.speechSynthesis.getVoices()

  const score = (voice: SpeechSynthesisVoice): number => {
    const language = voice.lang.toLowerCase().replace('_', '-')
    if (!language.startsWith('zh')) return -1

    let result = 10
    if (language === 'zh-cn' || language.startsWith('zh-hans')) result += 100
    else if (language.includes('cn')) result += 80
    if (voice.localService) result += 5
    if (voice.default) result += 1
    return result
  }

  return (
    voices
      .map((voice) => ({ voice, score: score(voice) }))
      .filter((candidate) => candidate.score >= 0)
      .sort((left, right) => right.score - left.score)[0]?.voice ?? null
  )
}

function utteranceFor(text: string): SpeechSynthesisUtterance {
  const { rate, pitch, volume } = getSettings()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'zh-CN'
  utterance.rate = rate
  utterance.pitch = pitch
  utterance.volume = volume

  const voice = mandarinVoice()
  if (voice) utterance.voice = voice
  return utterance
}

export function speak(text: string): void {
  if (!speechIsAvailable()) return
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utteranceFor(text))
}

export function saveSettings(settings: TTSSettings): void {
  localStorage.setItem('tts-settings', JSON.stringify(settings))
}

/**
 * Browser speech engines are unreliable with one long utterance. Keep natural
 * sentence boundaries while limiting each queued item to a safe size.
 */
export function mandarinSpeechChunks(paragraphs: string[]): string[] {
  const chunks: string[] = []

  for (const paragraph of paragraphs) {
    const sentences = paragraph.trim().match(/[^。！？!?]+[。！？!?][”’"]?|[^。！？!?]+$/g) ?? []
    for (const sentence of sentences) {
      let remaining = sentence.trim()
      while (remaining.length > MAX_UTTERANCE_CHARS) {
        const prefix = remaining.slice(0, MAX_UTTERANCE_CHARS + 1)
        const punctuationCut = Math.max(
          prefix.lastIndexOf('，'),
          prefix.lastIndexOf('；'),
          prefix.lastIndexOf('：'),
          prefix.lastIndexOf('、')
        )
        const cut = punctuationCut > MAX_UTTERANCE_CHARS / 2
          ? punctuationCut + 1
          : MAX_UTTERANCE_CHARS
        chunks.push(remaining.slice(0, cut).trim())
        remaining = remaining.slice(cut).trim()
      }
      if (remaining) chunks.push(remaining)
    }
  }

  return chunks
}

export interface MandarinPlayback {
  pause: () => void
  resume: () => void
  cancel: () => void
}

interface PlaybackEvents {
  onEnd?: () => void
  onError?: (message: string) => void
}

/** Queue a complete passage using the best Simplified-Chinese voice on the device. */
export function speakMandarinSequence(
  chunks: string[],
  events: PlaybackEvents = {}
): MandarinPlayback | null {
  if (!speechIsAvailable() || chunks.length === 0) return null

  const synthesis = window.speechSynthesis
  let index = 0
  let cancelled = false
  let completed = false

  const finish = () => {
    if (completed || cancelled) return
    completed = true
    events.onEnd?.()
  }

  const playNext = () => {
    if (cancelled) return
    if (index >= chunks.length) {
      finish()
      return
    }

    const utterance = utteranceFor(chunks[index])
    utterance.onend = () => {
      if (cancelled) return
      index += 1
      playNext()
    }
    utterance.onerror = (event) => {
      if (cancelled) return
      completed = true
      if (event.error === 'canceled' || event.error === 'interrupted') {
        events.onEnd?.()
      } else {
        events.onError?.(`Mandarin audio stopped: ${event.error}`)
      }
    }
    synthesis.speak(utterance)
  }

  synthesis.cancel()
  playNext()

  return {
    pause: () => {
      if (!cancelled && !completed) synthesis.pause()
    },
    resume: () => {
      if (!cancelled && !completed) synthesis.resume()
    },
    cancel: () => {
      if (cancelled || completed) return
      cancelled = true
      synthesis.cancel()
    },
  }
}
