import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadReaderIndex } from '../lib/readers'
import type { ReaderSummary } from '../lib/readers'
import { getAllReaderProgress } from '../lib/firestore'
import { getCurrentUid } from '../lib/auth'
import HskBadge from '../components/HskBadge'

interface Row extends ReaderSummary {
  finishedCount: number
}

export default function ReadersPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const uid = getCurrentUid()
      const [readers, progress] = await Promise.all([
        loadReaderIndex(),
        uid ? getAllReaderProgress(uid) : Promise.resolve([]),
      ])

      const byReader = new Map(progress.map((p) => [p.readerId, p]))
      setRows(
        readers.map((r) => ({
          ...r,
          // Guard against progress for chapters that no longer exist in the content.
          finishedCount: Math.min(byReader.get(r.id)?.completedChapters.length ?? 0, r.chapterCount),
        }))
      )
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="p-4 sm:p-8 text-text-muted">Loading…</div>

  const totalChapters = rows.reduce((n, r) => n + r.chapterCount, 0)
  const totalFinished = rows.reduce((n, r) => n + r.finishedCount, 0)

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Graded Readers</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Short stories that repeat the words they teach.
          </p>
        </div>
        <p className="text-sm text-text-muted">
          <span className="text-text-primary font-medium">{totalFinished}</span> / {totalChapters} chapters
          finished
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-text-muted">No readers available yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {rows.map((r) => {
            const pct = r.chapterCount > 0 ? Math.round((r.finishedCount / r.chapterCount) * 100) : 0
            return (
              <Link
                key={r.id}
                to={`/readers/${r.id}`}
                className="bg-surface-raised border border-border rounded-2xl p-5 space-y-4 hover:border-accent transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-2xl font-bold text-text-primary">{r.title}</p>
                    <p className="text-sm text-text-muted">{r.titleEn}</p>
                  </div>
                  <HskBadge level={r.hskLevel} />
                </div>

                <p className="text-sm text-text-primary leading-snug">{r.description}</p>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-text-muted">
                    <span>
                      {r.finishedCount} / {r.chapterCount} chapters · {r.vocabCount} words
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
