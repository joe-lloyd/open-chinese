import { useEffect, useRef, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { buildQueue } from '../lib/session'
import type { StudyCard } from '../lib/session'
import { applyBinaryReview, deriveStatus } from '../lib/srs'
import { setUserWord, appendHistory, upsertDailyStats } from '../lib/firestore'
import { getCurrentUid } from '../lib/auth'
import { speak } from '../lib/tts'
import { getSentence } from '../lib/sentences'

type Phase = 'pron-hidden' | 'pron-revealed' | 'meaning-hidden' | 'meaning-revealed'

interface SessionStats {
  total: number
  knewPron: number
  knewMeaning: number
  knewBoth: number
}

export default function StudyPage() {
  const [searchParams] = useSearchParams()
  const hskLevel = searchParams.get('hsk') ? Number(searchParams.get('hsk')) : undefined

  const [queue, setQueue] = useState<StudyCard[]>([])
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('pron-hidden')
  const [knewPron, setKnewPron] = useState<boolean | null>(null)
  const [revealedByFail, setRevealedByFail] = useState(false)
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(false)
  const [stats, setStats] = useState<SessionStats>({ total: 0, knewPron: 0, knewMeaning: 0, knewBoth: 0 })
  const [elapsed, setElapsed] = useState(0)
  const [showHelp, setShowHelp] = useState(false)
  const startRef = useRef(Date.now())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const uid = getCurrentUid()
    if (!uid) return
    buildQueue(uid, 50, hskLevel ? { hskLevel } : {}).then((cards) => {
      setQueue(cards)
      setLoading(false)
      if (cards.length > 0) {
        timerRef.current = setInterval(
          () => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)),
          1000
        )
      }
    })
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [hskLevel])

  const card = queue[index]

  const advance = useCallback(
    (finalKnewPron: boolean, finalKnewMeaning: boolean) => {
      if (!card) return

      setStats((s) => ({
        total: s.total + 1,
        knewPron: s.knewPron + (finalKnewPron ? 1 : 0),
        knewMeaning: s.knewMeaning + (finalKnewMeaning ? 1 : 0),
        knewBoth: s.knewBoth + (finalKnewPron && finalKnewMeaning ? 1 : 0),
      }))

      const uid = getCurrentUid()
      if (uid) {
        const currentState = {
          intervalMeaning: card.intervalMeaning,
          intervalPinyin: card.intervalPinyin,
          intervalAudio: card.intervalAudio,
          easeFactor: card.easeFactor,
          consecutiveFails: card.consecutiveFails,
          nextReviewDate: card.nextReviewDate,
          lastSubskill: null as null,
        }
        const result = applyBinaryReview(currentState, finalKnewPron, finalKnewMeaning)
        const status = deriveStatus(result.intervalMeaning, result.intervalPinyin, result.intervalAudio)

        setUserWord(uid, card.simplified, { ...result, status, deckName: card.deckName, notes: card.notes }).catch(console.error)
        appendHistory(uid, { simplified: card.simplified, knewPronunciation: finalKnewPron, knewMeaning: finalKnewMeaning, response: result.response }).catch(console.error)
        upsertDailyStats(uid, new Date().toISOString().slice(0, 10), card.isNew).catch(console.error)
      }

      if (index + 1 >= queue.length) {
        setDone(true)
        if (timerRef.current) clearInterval(timerRef.current)
      } else {
        setIndex((i) => i + 1)
        setPhase('pron-hidden')
        setKnewPron(null)
        setRevealedByFail(false)
      }
    },
    [card, index, queue.length]
  )

  const failAndReveal = useCallback(() => {
    setKnewPron(false)
    setRevealedByFail(true)
    setPhase('meaning-revealed')
  }, [])

  const revealPron = useCallback(() => {
    setPhase('pron-revealed')
    speak(card?.simplified ?? '')
  }, [card])

  const gradePron = useCallback((knew: boolean) => {
    setKnewPron(knew)
    setPhase('meaning-hidden')
  }, [])

  const revealMeaning = useCallback(() => setPhase('meaning-revealed'), [])

  const gradeMeaning = useCallback(
    (knew: boolean) => advance(knewPron ?? false, knew),
    [advance, knewPron]
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?') { setShowHelp((s) => !s); return }
      if (e.key === 'r' || e.key === 'R') { if (card) speak(card.simplified); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); if (card) speak(card.simplified); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (card && phase === 'meaning-revealed') {
          const s = getSentence(card.simplified)
          if (s) speak(s.zh)
        }
        return
      }

      if (revealedByFail) {
        if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault(); advance(false, false)
        }
        return
      }

      switch (phase) {
        case 'pron-hidden':
          if (e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); revealPron() }
          else if (e.key === 'ArrowLeft') { e.preventDefault(); failAndReveal() }
          break
        case 'pron-revealed':
          if (e.key === 'ArrowRight') { e.preventDefault(); gradePron(true) }
          else if (e.key === 'ArrowLeft') { e.preventDefault(); failAndReveal() }
          break
        case 'meaning-hidden':
          if (e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); revealMeaning() }
          else if (e.key === 'ArrowLeft') { e.preventDefault(); failAndReveal() }
          break
        case 'meaning-revealed':
          if (e.key === 'ArrowRight') { e.preventDefault(); gradeMeaning(true) }
          else if (e.key === 'ArrowLeft') { e.preventDefault(); gradeMeaning(false) }
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [phase, revealPron, gradePron, revealMeaning, gradeMeaning, card, revealedByFail, advance, failAndReveal])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-text-muted">Loading cards…</div>
  )

  if (queue.length === 0) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-center px-6">
      <p className="text-3xl font-light text-text-primary">All caught up</p>
      <p className="text-text-muted">
        {hskLevel ? `No cards due for HSK ${hskLevel}.` : 'No cards due right now.'}
      </p>
      {hskLevel && <Link to="/hsk" className="text-sm text-accent hover:underline">← Back to HSK levels</Link>}
    </div>
  )

  if (done) {
    const pronPct = stats.total > 0 ? Math.round((stats.knewPron / stats.total) * 100) : 0
    const meanPct = stats.total > 0 ? Math.round((stats.knewMeaning / stats.total) * 100) : 0
    const bothPct = stats.total > 0 ? Math.round((stats.knewBoth / stats.total) * 100) : 0
    const mins = Math.floor(elapsed / 60)
    const secs = elapsed % 60
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-md space-y-6 text-center">
          <h1 className="text-3xl font-bold text-text-primary">Session complete</h1>
          <div className="grid grid-cols-2 gap-3">
            <Stat value={stats.total} label="Cards" />
            <Stat value={`${mins}:${String(secs).padStart(2, '0')}`} label="Time" />
            <Stat value={`${pronPct}%`} label="Pronunciation" color="accent" />
            <Stat value={`${meanPct}%`} label="Meaning" color="accent" />
          </div>
          <Stat value={`${bothPct}%`} label="Fully known (both)" color="correct" large />
          <button
            onClick={() => {
              setIndex(0); setDone(false); setPhase('pron-hidden'); setKnewPron(null); setRevealedByFail(false)
              setStats({ total: 0, knewPron: 0, knewMeaning: 0, knewBoth: 0 })
              startRef.current = Date.now(); setElapsed(0)
              timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000)
            }}
            className="w-full py-3 bg-accent text-white rounded-xl hover:opacity-90 transition-opacity font-medium"
          >
            Study again
          </button>
          {hskLevel && <Link to="/hsk" className="block text-sm text-text-muted hover:text-accent transition-colors">← Back to HSK levels</Link>}
        </div>
      </div>
    )
  }

  const progress = index / queue.length
  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  const pronVisible = phase !== 'pron-hidden'
  const meaningVisible = phase === 'meaning-revealed'
  const sentence = card ? getSentence(card.simplified) : null

  return (
    <div className="min-h-screen flex flex-col">
      {/* Progress — fixed */}
      <div className="flex-shrink-0 px-4 sm:px-8 pt-4 sm:pt-5 pb-2 flex items-center gap-4">
        <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
          <div className="h-full bg-accent transition-all duration-500" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="text-xs text-text-muted tabular-nums whitespace-nowrap">
          {index}/{queue.length} · {mins}:{String(secs).padStart(2, '0')}
        </span>
      </div>

      {/* Card area — always same structure, opacity controls visibility */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 gap-0">

        {/* Character block — never moves */}
        <div className="flex flex-col items-center gap-2 mb-6">
          {card.hskLevel ? (
            <span className="text-xs font-medium bg-accent/10 text-accent px-2.5 py-0.5 rounded-full">
              HSK {card.hskLevel}
            </span>
          ) : (
            <span className="text-xs px-2.5 py-0.5 opacity-0 select-none">·</span>
          )}
          <p
            className="font-light text-text-primary select-none leading-none text-center"
            style={{ fontSize: 'clamp(7rem, 18vw, 13rem)' }}
          >
            {card.simplified}
          </p>
          {/* Always reserve traditional space — invisible if absent */}
          <p className={`text-xl ${card.traditional && card.traditional !== card.simplified ? 'text-text-muted' : 'opacity-0 select-none'}`}>
            {card.traditional && card.traditional !== card.simplified ? card.traditional : card.simplified}
          </p>
        </div>

        {/* Pinyin — always reserves h-14, fades in */}
        <div className="h-14 flex flex-col items-center justify-center gap-0.5 mb-4">
          <div className={`text-center transition-opacity duration-150 ${pronVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <p className="text-3xl font-medium text-accent">{card.pinyin}</p>
            <button
              onClick={() => speak(card.simplified)}
              className="text-xs text-text-muted hover:text-accent transition-colors mt-0.5"
            >
              ▶ play (↑ / R)
            </button>
          </div>
        </div>

        {/* Definition + sentence — always reserves space, fades in */}
        <div className={`w-full max-w-lg mb-6 transition-opacity duration-150 ${meaningVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="bg-surface-raised rounded-2xl px-6 py-4 border border-border space-y-3 text-center">
            <p className="text-lg text-text-primary leading-relaxed">{card.definition}</p>
            {(sentence || card.notes) && (
              <div className="pt-3 border-t border-border text-left space-y-1">
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">Example</p>
                {sentence ? (
                  <>
                    <p className="text-base text-text-primary">{sentence.zh}</p>
                    <p className="text-sm text-text-muted italic">{sentence.en}</p>
                  </>
                ) : (
                  <p className="text-sm text-text-muted italic">{card.notes}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Button area — fixed height, content swaps without layout shift */}
      <div className="flex-shrink-0 px-6 pb-6 sm:pb-8">
        <div className="w-full max-w-md mx-auto h-28 flex flex-col justify-start gap-3">
          {phase === 'pron-hidden' && <>
            <p className="text-center text-text-muted text-sm">Do you know the pronunciation?</p>
            <div className="grid grid-cols-2 gap-3">
              <ActionBtn label="I don't know" sub="←" variant="fail" onClick={failAndReveal} />
              <ActionBtn label="Reveal" sub="→ / Space" variant="accent" onClick={revealPron} />
            </div>
          </>}
          {phase === 'pron-revealed' && <>
            <p className="text-center text-text-muted text-sm">Did you know the pronunciation?</p>
            <div className="grid grid-cols-2 gap-3">
              <ActionBtn label="I didn't know" sub="←" variant="fail" onClick={failAndReveal} />
              <ActionBtn label="I knew it" sub="→" variant="pass" onClick={() => gradePron(true)} />
            </div>
          </>}
          {phase === 'meaning-hidden' && <>
            <p className="text-center text-text-muted text-sm">Do you know the meaning?</p>
            <div className="grid grid-cols-2 gap-3">
              <ActionBtn label="I don't know" sub="←" variant="fail" onClick={failAndReveal} />
              <ActionBtn label="Reveal" sub="→ / Space" variant="accent" onClick={revealMeaning} />
            </div>
          </>}
          {phase === 'meaning-revealed' && revealedByFail && <>
            <p className="text-center text-text-muted text-sm">Marked as not known</p>
            <ActionBtn label="Next card" sub="→ / Space / ←" variant="neutral" onClick={() => advance(false, false)} />
          </>}
          {phase === 'meaning-revealed' && !revealedByFail && <>
            <p className="text-center text-text-muted text-sm">Did you know the meaning?</p>
            <div className="grid grid-cols-2 gap-3">
              <ActionBtn label="I didn't know" sub="←" variant="fail" onClick={() => gradeMeaning(false)} />
              <ActionBtn label="I knew it" sub="→" variant="pass" onClick={() => gradeMeaning(true)} />
            </div>
          </>}
        </div>
      </div>

      {showHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowHelp(false)}>
          <div className="bg-surface rounded-2xl p-6 max-w-sm w-full border border-border mx-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-text-primary">Keyboard shortcuts</h3>
            {[
              ['→ / Space', 'Reveal or I knew it'],
              ['←', "I didn't know (skip to answer)"],
              ['↑ / R', 'Replay word audio'],
              ['↓', 'Play example sentence (when revealed)'],
              ['?', 'Toggle help'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between items-center text-sm gap-4">
                <kbd className="bg-surface-raised px-2 py-0.5 rounded font-mono text-text-muted whitespace-nowrap">{k}</kbd>
                <span className="text-text-muted">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={() => setShowHelp(true)} className="fixed bottom-16 right-4 md:bottom-4 text-xs text-text-muted hover:text-text-primary transition-colors">
        ? help
      </button>
    </div>
  )
}

function ActionBtn({ label, sub, variant, onClick }: {
  label: string; sub: string; variant: 'fail' | 'pass' | 'accent' | 'neutral'; onClick: () => void
}) {
  const cls = {
    fail: 'border-incorrect/50 text-incorrect hover:bg-incorrect/10',
    pass: 'border-correct/50 text-correct hover:bg-correct/10',
    accent: 'border-accent/50 text-accent hover:bg-accent/10',
    neutral: 'border-border text-text-muted hover:text-text-primary hover:border-text-muted',
  }[variant]
  return (
    <button onClick={onClick} className={`py-4 rounded-xl border font-medium text-sm transition-colors ${cls}`}>
      {label}
      <span className="block text-xs opacity-50 mt-0.5 font-normal">{sub}</span>
    </button>
  )
}

function Stat({ value, label, color, large }: { value: string | number; label: string; color?: 'accent' | 'correct'; large?: boolean }) {
  const colorClass = color === 'correct' ? 'text-correct' : color === 'accent' ? 'text-accent' : 'text-text-primary'
  return (
    <div className="bg-surface-raised rounded-xl p-4 border border-border text-center">
      <p className={`font-bold ${large ? 'text-5xl' : 'text-3xl'} ${colorClass}`}>{value}</p>
      <p className="text-xs text-text-muted mt-1">{label}</p>
    </div>
  )
}
