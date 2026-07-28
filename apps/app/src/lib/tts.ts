export interface TTSSettings {
  rate: number
  pitch: number
  volume: number
}

export const DEFAULT_TTS_SETTINGS: TTSSettings = { rate: 0.8, pitch: 1.0, volume: 1.0 }

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

export function speak(text: string): void {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()

  const { rate, pitch, volume } = getSettings()
  const utt = new SpeechSynthesisUtterance(text)
  utt.lang = 'zh-CN'
  utt.rate = rate
  utt.pitch = pitch
  utt.volume = volume

  const voices = window.speechSynthesis.getVoices()
  const zhVoice = voices.find((v) => v.lang.startsWith('zh'))
  if (zhVoice) utt.voice = zhVoice

  window.speechSynthesis.speak(utt)
}

export function saveSettings(settings: TTSSettings): void {
  localStorage.setItem('tts-settings', JSON.stringify(settings))
}
