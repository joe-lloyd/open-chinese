import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllUserWords } from '../lib/firestore'
import { loadDB } from '../lib/worddb'
import { getCurrentUid } from '../lib/auth'
import { useEntitlements } from '../hooks/useEntitlements'
import LockBadge, { LockIcon } from '../components/LockBadge'
import { HSK_LEVELS, hskLabel } from '../lib/hsk'

const HSK_LABELS: Record<number, string> = {
  1: 'Beginner',
  2: 'Elementary',
  3: 'Pre-Intermediate',
  4: 'Intermediate',
  5: 'Upper-Intermediate',
  6: 'Advanced',
  7: 'Advanced band',
}

interface LevelData {
  level: number
  total: number
  studied: number
  due: number
  examples: string[]
}

export default function HskPage() {
  const [levels, setLevels] = useState<LevelData[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { check, freeCountFor, loading: entitlementsLoading } = useEntitlements()

  useEffect(() => {
    async function load() {
      const uid = getCurrentUid()
      if (!uid) return
      const [worddb, allUserWords] = await Promise.all([loadDB(), getAllUserWords(uid)])
      const userMap = new Map(allUserWords.map((w) => [w.simplified, w]))
      const now = new Date()

      const data: LevelData[] = HSK_LEVELS.map((level) => {
        const words = worddb.getWordsByLevel(level)
        let studied = 0
        let due = 0
        for (const w of words) {
          const u = userMap.get(w.simplified)
          if (!u) continue
          if (u.status !== 'Unstudied') studied++
          if (
            u.nextReviewDate <= now &&
            u.status !== 'Mastered' &&
            u.status !== 'Leech' &&
            u.status !== 'Unstudied' &&
            u.intervalMeaning > 0
          ) due++
        }
        return {
          level,
          total: words.length,
          studied,
          due,
          examples: words.slice(0, 6).map((w) => w.simplified),
        }
      })

      setLevels(data)
      setLoading(false)
    }
    load()
  }, [])

  // Waiting for the entitlement snapshot too, so a paying user is never shown
  // "Unlock HSK 4" for the moment before it arrives.
  if (loading || entitlementsLoading)
    return <div className="p-4 sm:p-8 text-text-muted">Loading…</div>

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">HSK Levels</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {levels.map((l) => {
          const pct = l.total > 0 ? Math.round((l.studied / l.total) * 100) : 0
          // Gating is computed at render, not in the effect, so the cards settle
          // as soon as the entitlement snapshot arrives.
          const locked = !check({ kind: 'hskLevel', level: l.level }).allowed
          const freeCount = locked ? freeCountFor(l.level) : 0
          return (
            <div key={l.level} className="bg-surface-raised border border-border rounded-2xl p-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-3xl font-bold text-text-primary">{hskLabel(l.level)}</p>
                  <p className="text-sm text-text-muted">{HSK_LABELS[l.level]}</p>
                </div>
                {locked ? (
                  <LockBadge label={freeCount > 0 ? `${freeCount} free` : 'Locked'} />
                ) : (
                  l.due > 0 && (
                    <span className="text-xs font-medium bg-accent/10 text-accent px-2.5 py-1 rounded-full">
                      {l.due} due
                    </span>
                  )
                )}
              </div>

              <div className="flex gap-1.5 flex-wrap">
                {l.examples.map((c) => (
                  <span key={c} className="text-2xl text-text-secondary leading-none">{c}</span>
                ))}
                <span className="text-xl text-text-muted leading-none">…</span>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-text-muted">
                  <span>{l.studied} / {l.total} studied</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {!locked ? (
                <button
                  onClick={() => navigate(`/study?hsk=${l.level}`)}
                  className="w-full py-2.5 bg-accent-solid text-on-accent rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Study HSK {l.level}
                </button>
              ) : freeCount > 0 ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/study?hsk=${l.level}`)}
                    className="flex-1 py-2.5 border border-border text-text-primary rounded-xl text-sm font-medium hover:bg-surface transition-colors"
                  >
                    Study free {freeCount}
                  </button>
                  <button
                    onClick={() => navigate('/pricing')}
                    className="flex-1 py-2.5 bg-accent-solid text-on-accent rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Unlock all
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => navigate('/pricing')}
                  className="w-full py-2.5 bg-accent-solid text-on-accent rounded-xl text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
                >
                  <LockIcon /> Unlock HSK {l.level}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
