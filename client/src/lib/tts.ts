export interface TTSSettings {
  rate: number
  pitch: number
}

function getSettings(): TTSSettings {
  try {
    const stored = localStorage.getItem('tts-settings')
    if (stored) return JSON.parse(stored)
  } catch {}
  return { rate: 0.8, pitch: 1.0 }
}

export function speak(text: string): void {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()

  const { rate, pitch } = getSettings()
  const utt = new SpeechSynthesisUtterance(text)
  utt.lang = 'zh-CN'
  utt.rate = rate
  utt.pitch = pitch

  const voices = window.speechSynthesis.getVoices()
  const zhVoice = voices.find((v) => v.lang.startsWith('zh'))
  if (zhVoice) utt.voice = zhVoice

  window.speechSynthesis.speak(utt)
}

export function saveSettings(settings: TTSSettings): void {
  localStorage.setItem('tts-settings', JSON.stringify(settings))
}
