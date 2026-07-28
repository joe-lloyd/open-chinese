import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { ReaderParagraph, ReaderToken } from '../lib/readers'

const POPOVER_WIDTH = 256

// Touch devices fire a phantom pointerenter on tap, so hover-to-open is gated on
// the device actually having a hover-capable pointer.
const CAN_HOVER = typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches

interface ActiveWord {
  /** Identifies the occurrence, not the word — the same word appears many times. */
  key: string
  /** Opened by click rather than hover, so moving the pointer away must not dismiss it. */
  pinned: boolean
  text: string
  pinyin: string
  definition: string
  rect: DOMRect
}

interface Props {
  paragraphs: ReaderParagraph[]
  showPinyin: boolean
  showTranslation: boolean
  /** Words the user has never met — rendered with a highlight. */
  unencountered: Set<string>
}

export default function ReaderText({ paragraphs, showPinyin, showTranslation, unencountered }: Props) {
  const [active, setActive] = useState<ActiveWord | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active) return

    const close = () => setActive(null)
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement
      if (popoverRef.current?.contains(target)) return
      if (target.closest('[data-reader-token]')) return
      close()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown)
    // Capture phase so scrolling inside the page's own scroll container also closes it.
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [active])

  function hover(key: string, token: Extract<ReaderToken, { kind: 'word' }>, el: HTMLElement) {
    setActive((current) =>
      current?.pinned ? current : { key, pinned: false, ...token, rect: el.getBoundingClientRect() }
    )
  }

  function toggle(key: string, token: Extract<ReaderToken, { kind: 'word' }>, el: HTMLElement) {
    setActive((current) =>
      current?.key === key && current.pinned
        ? null
        : { key, pinned: true, ...token, rect: el.getBoundingClientRect() }
    )
  }

  return (
    <>
      {/* One line height in both modes: ruby needs the headroom, and switching it with
          the toggle shifted the reader's place on the page by ~15px per line. */}
      <div className="leading-[2.6]">
        {paragraphs.map((paragraph, i) => (
          <div key={i} className="mb-8">
            <p className="text-2xl sm:text-3xl text-text-primary">
              {paragraph.tokens.map((token, j) => {
                if (token.kind === 'punct') return <span key={j}>{token.text}</span>

                const key = `${i}-${j}`
                const isNew = unencountered.has(token.text)
                const isActive = active?.key === key
                return (
                  <span
                    key={j}
                    data-reader-token
                    onClick={(e) => toggle(key, token, e.currentTarget)}
                    onPointerEnter={(e) => CAN_HOVER && hover(key, token, e.currentTarget)}
                    onPointerLeave={() =>
                      CAN_HOVER && setActive((current) => (current?.pinned ? current : null))
                    }
                    className={`cursor-pointer rounded-sm transition-colors ${
                      isActive
                        ? 'bg-accent/30'
                        : isNew
                          ? 'bg-accent/15 underline decoration-dotted decoration-accent/60 underline-offset-4'
                          : 'hover:bg-accent/10'
                    }`}
                  >
                    {showPinyin ? (
                      // 0.5em keeps tone marks legible — at 0.4em with tight tracking
                      // this was 9.6px on mobile, where ǎ and à stop being separable.
                      <ruby className="[&>rt]:text-[0.5em] [&>rt]:text-text-muted">
                        {token.text}
                        <rt>{token.pinyin}</rt>
                      </ruby>
                    ) : (
                      token.text
                    )}
                  </span>
                )
              })}
            </p>
            {showTranslation && (
              <p className="mt-2 text-sm sm:text-base text-text-muted leading-relaxed">
                {paragraph.translation}
              </p>
            )}
          </div>
        ))}
      </div>

      {active && (
        <div
          ref={popoverRef}
          style={popoverPosition(active.rect)}
          className="fixed z-50 bg-surface-raised border border-border rounded-xl shadow-lg p-3 overflow-y-auto"
        >
          <p className="text-2xl text-text-primary leading-tight">{active.text}</p>
          <p className="text-sm text-accent mt-0.5">{active.pinyin}</p>
          <p className="text-sm text-text-primary mt-1.5 leading-snug">{active.definition}</p>
        </div>
      )}
    </>
  )
}

/** Centred on the token, clamped so it stays fully on screen at any viewport width. */
function popoverPosition(rect: DOMRect): CSSProperties {
  const width = Math.min(POPOVER_WIDTH, window.innerWidth - 16)
  const left = Math.max(
    8,
    Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 8)
  )
  // Below the token when near the top, so the popover never lands under the sticky header.
  // Height is bounded either way: anchoring by `bottom` alone lets a long definition —
  // a multi-sense HSK 3/4 gloss — run off the top of the viewport.
  const above = rect.top > 160
  return {
    width,
    left,
    ...(above
      ? { bottom: window.innerHeight - rect.top + 8, maxHeight: rect.top - 16 }
      : { top: rect.bottom + 8, maxHeight: window.innerHeight - rect.bottom - 16 }),
  }
}
