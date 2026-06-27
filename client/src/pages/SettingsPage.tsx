import { useEffect, useState } from 'react'
import { saveSettings, type TTSSettings } from '../lib/tts'
import { speak } from '../lib/tts'

export default function SettingsPage() {
  const [settings, setSettings] = useState<TTSSettings>({ rate: 0.8, pitch: 1.0 })

  useEffect(() => {
    try {
      const stored = localStorage.getItem('tts-settings')
      if (stored) setSettings(JSON.parse(stored))
    } catch {}
  }, [])

  function update(patch: Partial<TTSSettings>) {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveSettings(next)
  }

  return (
    <div className="p-8 max-w-lg mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-text-primary">Settings</h1>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Audio / TTS</h2>

        <label className="block space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Speech rate</span>
            <span className="text-text-primary font-mono">{settings.rate.toFixed(1)}×</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="1.5"
            step="0.1"
            value={settings.rate}
            onChange={(e) => update({ rate: parseFloat(e.target.value) })}
            className="w-full accent-[var(--color-accent)]"
          />
        </label>

        <label className="block space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Pitch</span>
            <span className="text-text-primary font-mono">{settings.pitch.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={settings.pitch}
            onChange={(e) => update({ pitch: parseFloat(e.target.value) })}
            className="w-full accent-[var(--color-accent)]"
          />
        </label>

        <button
          onClick={() => speak('你好，这是一个测试')}
          className="px-4 py-2 border border-border rounded-lg text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          🔊 Test audio
        </button>
      </section>
    </div>
  )
}
