import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import HskBadge from '../components/HskBadge'
import ReaderCover from '../components/ReaderCover'
import { getCurrentUid } from '../lib/auth'
import { getEncounteredWords, getReaderProgress } from '../lib/firestore'
import { loadReader, unencounteredWords } from '../lib/readers'
import type { Reader } from '../lib/readers'

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
          getEncounteredWords(uid, loaded.chapters.flatMap((chapter) => chapter.vocab)),
          getReaderProgress(uid, readerId),
        ])
        if (cancelled) return
        const completed = new Set(progress?.completedChapters ?? [])
        setRows(
          loaded.chapters.map((chapter) => ({
            id: chapter.id,
            title: chapter.title,
            titleEn: chapter.titleEn,
            finished: completed.has(chapter.id),
            newWords: unencounteredWords(chapter, encountered).length,
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

  if (loading) return <div className="p-4 text-text-muted sm:p-8">Loading…</div>
  if (!reader) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 p-4 sm:p-8">
        <h1 className="text-2xl font-bold text-text-primary">Reader not found</h1>
        <Link to="/readers" className="text-sm text-accent hover:underline">
          ← Back to readers
        </Link>
      </div>
    )
  }

  const finishedCount = rows.filter((row) => row.finished).length
  const nextUnfinished = rows.find((row) => !row.finished) ?? rows[0]

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
      <div className="space-y-4">
        <Link
          to="/readers"
          className="text-xs text-text-muted transition-colors hover:text-text-primary"
        >
          ← All readers
        </Link>
        <div className="grid gap-5 sm:grid-cols-[11rem_1fr] sm:items-start">
          <ReaderCover
            readerId={reader.id}
            hskLevel={reader.hskLevel}
            cover={reader.cover}
            eager
            className="w-full max-w-56 rounded-2xl border border-border shadow-sm"
          />
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-text-primary">{reader.title}</h1>
                <p className="mt-0.5 text-sm text-text-muted">{reader.titleEn}</p>
              </div>
              <HskBadge level={reader.hskLevel} size="lg" />
            </div>
            <p className="text-sm text-text-primary">{reader.description}</p>
            <p className="text-xs text-text-muted">
              Every chapter includes complete Mandarin read-aloud with pause and resume.
            </p>
          </div>
        </div>
      </div>

      {nextUnfinished ? (
        <button
          onClick={() => navigate(`/readers/${reader.id}/${nextUnfinished.id}`)}
          className="w-full rounded-xl bg-accent-solid py-3 text-sm font-medium text-on-accent transition-opacity hover:opacity-90"
        >
          {finishedCount === 0 ? 'Start reading' : `Continue: ${nextUnfinished.title}`}
        </button>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Chapters — {finishedCount} / {rows.length} finished
        </h2>
        {rows.map((row, index) => (
          <Link
            key={row.id}
            to={`/readers/${reader.id}/${row.id}`}
            className="flex items-center gap-4 rounded-xl border border-border bg-surface-raised px-4 py-3 transition-colors hover:border-accent"
          >
            <span
              className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                row.finished ? 'bg-accent-solid text-on-accent' : 'bg-border text-text-muted'
              }`}
            >
              {row.finished ? '✓' : index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-text-primary">{row.title}</p>
              <p className="truncate text-xs text-text-muted">{row.titleEn}</p>
            </div>
            <span className="flex-shrink-0 text-xs text-text-muted">
              {row.newWords > 0 ? `${row.newWords} new` : 'all known'}
            </span>
          </Link>
        ))}
      </section>
    </div>
  )
}
