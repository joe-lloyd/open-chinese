import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllUserWords } from '../lib/firestore'
import { loadDB } from '../lib/worddb'
import { getCurrentUid } from '../lib/auth'

const HSK_LEVELS = [1, 2, 3, 4] as const
const HSK_LABELS: Record<number, string> = {
  1: 'Beginner',
  2: 'Elementary',
  3: 'Intermediate',
  4: 'Upper-Intermediate',
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

  if (loading) return <div className="p-4 sm:p-8 text-text-muted">Loading…</div>

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">HSK Levels</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {levels.map((l) => {
          const pct = l.total > 0 ? Math.round((l.studied / l.total) * 100) : 0
          return (
            <div key={l.level} className="bg-surface-raised border border-border rounded-2xl p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-3xl font-bold text-text-primary">HSK {l.level}</p>
                  <p className="text-sm text-text-muted">{HSK_LABELS[l.level]}</p>
                </div>
                {l.due > 0 && (
                  <span className="text-xs font-medium bg-accent/10 text-accent px-2.5 py-1 rounded-full">
                    {l.due} due
                  </span>
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

              <button
                onClick={() => navigate(`/study?hsk=${l.level}`)}
                className="w-full py-2.5 bg-accent text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Study HSK {l.level}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
