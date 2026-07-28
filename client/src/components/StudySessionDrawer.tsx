import { useEffect, useState } from 'react'
import { getSettings, saveSettings } from '../lib/tts'

interface Props {
  open: boolean
  onClose: () => void
  onEndSession: () => void
}

/**
 * Session-scoped menu. Escape and backdrop dismissal are handled here; StudyPage
 * suppresses its own shortcuts while `open`, so nothing can be graded behind it.
 */
export default function StudySessionDrawer({ open, onClose, onEndSession }: Props) {
  const [volume, setVolume] = useState(1)

  useEffect(() => {
    if (open) setVolume(getSettings().volume)
  }, [open])

  function updateVolume(next: number) {
    setVolume(next)
    saveSettings({ ...getSettings(), volume: next })
  }

  // `inert` while closed: the panel is only translated off-screen, so without it
  // the volume slider and both buttons would stay in the tab order.
  return (
    <div
      inert={!open}
      className={`fixed inset-0 z-50 overflow-hidden ${open ? '' : 'pointer-events-none'}`}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/50 ${open ? 'opacity-100 transition-opacity duration-200' : 'opacity-0 transition-none'}`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Session menu"
        className={`absolute inset-y-0 right-0 w-80 max-w-[85vw] bg-surface border-l border-border flex flex-col transition-transform duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 h-14 border-b border-border flex-shrink-0">
          <h2 className="text-sm font-semibold text-text-primary">Session</h2>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-raised transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-8">
          <section className="space-y-3">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-widest">Audio</p>
            <label className="block space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Volume</span>
                <span className="text-text-primary font-mono">{Math.round(volume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => updateVolume(parseFloat(e.target.value))}
                className="w-full accent-[var(--color-accent)]"
              />
            </label>
            <p className="text-xs text-text-muted">
              Applies to the next word or sentence played. Rate and pitch live in Settings.
            </p>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-widest">Session</p>
            <button
              onClick={onEndSession}
              className="w-full py-3 rounded-xl border border-incorrect/50 text-incorrect text-sm font-medium hover:bg-incorrect/10 transition-colors"
            >
              End session now
            </button>
            <p className="text-xs text-text-muted">
              Everything you have already graded is saved. You will go straight to the summary.
            </p>
          </section>
        </div>
      </aside>
    </div>
  )
}
