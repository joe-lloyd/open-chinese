import { useState } from 'react'

interface Props {
  zh: string
  en: string | null
  pinyin: string | null
  /** Reveal forced on by the `P` shortcut; the parent owns it so the key and the tap share one state. */
  pinned: boolean
  onTogglePinned: () => void
}

/**
 * The reading is revealed by pointer only — hover on mouse, tap on touch — plus
 * the parent's `P` shortcut. The control is deliberately unreachable by Tab:
 * study is keyboard-driven and Space means "reveal the card", so a focusable
 * button here could swallow it.
 */
export default function ExampleSentence({ zh, en, pinyin, pinned, onTogglePinned }: Props) {
  const [hovered, setHovered] = useState(false)
  const visible = Boolean(pinyin) && (hovered || pinned)

  const sentence = pinyin ? (
    <button
      type="button"
      tabIndex={-1}
      // tabIndex alone blocks Tab, not click focus; without this the control
      // keeps focus after a tap.
      onMouseDown={(e) => e.preventDefault()}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHovered(true) }}
      onPointerLeave={() => setHovered(false)}
      // Clearing hover on click keeps the toggle honest under a mouse: otherwise
      // un-pinning leaves the reading on screen because the pointer is still over it.
      onClick={() => { setHovered(false); onTogglePinned() }}
      aria-pressed={visible}
      className="block w-full text-left text-base text-text-primary cursor-pointer"
    >
      {zh}
    </button>
  ) : (
    <p className="text-base text-text-primary">{zh}</p>
  )

  return (
    <div className="space-y-1">
      {sentence}

      {/* One reserved line, showing either the reading or the affordance for it —
          so revealing the reading reflows nothing. */}
      <div className="relative h-5 pointer-events-none">
        {pinyin && (
          <>
            {/* truncate must sit on the block itself — on a flex container the
                text becomes an anonymous item and ellipsis never applies. */}
            <span className={`absolute inset-0 leading-5 text-sm text-accent truncate ${visible ? 'opacity-100 transition-opacity duration-150' : 'opacity-0 transition-none'}`}>
              {pinyin}
            </span>
            <span className={`absolute inset-0 flex items-center text-[10px] text-text-muted/70 ${visible ? 'opacity-0 transition-none' : 'opacity-100'}`}>
              hover or tap for pinyin · P
            </span>
          </>
        )}
      </div>

      {en && <p className="text-sm text-text-muted italic">{en}</p>}
    </div>
  )
}
