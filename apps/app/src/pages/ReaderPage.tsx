import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { loadReader, unencounteredWords } from '../lib/readers'
import type { Reader } from '../lib/readers'
import { getEncounteredWords, getReaderProgress } from '../lib/firestore'
import { getCurrentUid } from '../lib/auth'
import HskBadge from '../components/HskBadge'

interface ChapterRow {
  id: string
  title: string
  titleEn: string
  finished: boolean
  newWords: number
}

export default function ReaderPage() {
  const { readerId = '' } = useParams()
  const navigate = useNavigate()
  const [reader, setReader] = useState<Reader | null>(null)
  const [rows, setRows] = useState<ChapterRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const loaded = await loadReader(readerId)
      if (cancelled) return
      setReader(loaded)

      const uid = getCurrentUid()
      if (loaded && uid) {
        const [encountered, progress] = await Promise.all([
          getEncounteredWords(uid, loaded.chapters.flatMap((c) => c.vocab)),
          getReaderProgress(uid, readerId),
        ])
        if (cancelled) return

        const completed = new Set(progress?.completedChapters ?? [])
        setRows(
          loaded.chapters.map((c) => ({
            id: c.id,
            title: c.title,
            titleEn: c.titleEn,
            finished: completed.has(c.id),
            newWords: unencounteredWords(c, encountered).length,
          }))
        )
      }

      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [readerId])

  if (loading) return <div className="p-4 sm:p-8 text-text-muted">Loading…</div>

  if (!reader) {
    return (
      <div className="p-4 sm:p-8 max-w-3xl mx-auto space-y-3">
        <h1 className="text-2xl font-bold text-text-primary">Reader not found</h1>
        <Link to="/readers" className="text-accent text-sm hover:underline">
          ← Back to readers
        </Link>
      </div>
    )
  }

  const finishedCount = rows.filter((r) => r.finished).length
  const nextUnfinished = rows.find((r) => !r.finished) ?? rows[0]

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto space-y-6">
      <div className="space-y-3">
        <Link to="/readers" className="text-xs text-text-muted hover:text-text-primary transition-colors">
          ← All readers
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-text-primary">{reader.title}</h1>
            <p className="text-sm text-text-muted mt-0.5">{reader.titleEn}</p>
          </div>
          <HskBadge level={reader.hskLevel} size="lg" />
        </div>
        <p className="text-sm text-text-primary">{reader.description}</p>
      </div>

      {nextUnfinished && (
        <button
          onClick={() => navigate(`/readers/${reader.id}/${nextUnfinished.id}`)}
          className="w-full py-3 bg-accent-solid text-on-accent rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {finishedCount === 0 ? 'Start reading' : `Continue: ${nextUnfinished.title}`}
        </button>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide">
          Chapters — {finishedCount} / {rows.length} finished
        </h2>
        {rows.map((row, i) => (
          <Link
            key={row.id}
            to={`/readers/${reader.id}/${row.id}`}
            className="flex items-center gap-4 bg-surface-raised border border-border rounded-xl px-4 py-3 hover:border-accent transition-colors"
          >
            <span
              className={`w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-medium ${
                row.finished ? 'bg-accent-solid text-on-accent' : 'bg-border text-text-muted'
              }`}
            >
              {row.finished ? '✓' : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-text-primary truncate">{row.title}</p>
              <p className="text-xs text-text-muted truncate">{row.titleEn}</p>
            </div>
            <span className="text-xs text-text-muted flex-shrink-0">
              {row.newWords > 0 ? `${row.newWords} new` : 'all known'}
            </span>
          </Link>
        ))}
      </section>
    </div>
  )
}
