import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadReaderIndex } from '../lib/readers'
import type { ReaderSummary } from '../lib/readers'
import { getAllReaderProgress } from '../lib/firestore'
import { getCurrentUid } from '../lib/auth'
import HskBadge from '../components/HskBadge'
import { HSK_LEVELS, hskStageName } from '../lib/hsk'

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
  const groups = HSK_LEVELS.map((level) => {
    const readers = rows
      .filter((reader) => reader.hskLevel === level)
      .sort((left, right) => left.order - right.order)
    return {
      level,
      readers,
      chapterCount: readers.reduce((total, reader) => total + reader.chapterCount, 0),
      finishedCount: readers.reduce((total, reader) => total + reader.finishedCount, 0),
    }
  }).filter((group) => group.readers.length > 0)

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Graded Readers</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Follow the stories in order, from beginner Chinese through HSK 9.
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
        <>
          <nav
            aria-label="Reader skill levels"
            className="flex gap-2 overflow-x-auto pb-1"
          >
            {groups.map((group) => (
              <a
                key={group.level}
                href={`#hsk-${group.level}`}
                className="shrink-0 px-3 py-1.5 rounded-full border border-border bg-surface-raised text-sm text-text-primary hover:border-accent transition-colors"
              >
                HSK {group.level}
              </a>
            ))}
          </nav>

          <div className="space-y-10">
            {groups.map((group) => {
              const levelPct =
                group.chapterCount > 0
                  ? Math.round((group.finishedCount / group.chapterCount) * 100)
                  : 0

              return (
                <section
                  key={group.level}
                  id={`hsk-${group.level}`}
                  className="scroll-mt-6 space-y-4"
                >
                  <div className="flex items-end justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <HskBadge level={group.level} size="lg" />
                      <div>
                        <h2 className="text-xl font-semibold text-text-primary">
                          {hskStageName(group.level)}
                        </h2>
                        <p className="text-xs text-text-muted">
                          Read stories 1–{group.readers.length} in order
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-text-muted text-right">
                      {group.finishedCount} / {group.chapterCount} chapters
                      <span className="block text-text-primary font-medium">{levelPct}% complete</span>
                    </p>
                  </div>

                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all duration-500"
                      style={{ width: `${levelPct}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {group.readers.map((reader) => {
                      const pct =
                        reader.chapterCount > 0
                          ? Math.round((reader.finishedCount / reader.chapterCount) * 100)
                          : 0
                      const action =
                        reader.finishedCount === reader.chapterCount
                          ? 'Complete'
                          : reader.finishedCount > 0
                            ? 'Continue'
                            : 'Start'

                      return (
                        <Link
                          key={reader.id}
                          to={`/readers/${reader.id}`}
                          className="bg-surface-raised border border-border rounded-2xl p-5 space-y-4 hover:border-accent transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-medium text-accent mb-1">
                                Story {reader.order} of {group.readers.length}
                              </p>
                              <p className="text-2xl font-bold text-text-primary">{reader.title}</p>
                              <p className="text-sm text-text-muted">{reader.titleEn}</p>
                            </div>
                            <span className="text-xs font-medium text-text-muted">{action}</span>
                          </div>

                          <p className="text-sm text-text-primary leading-snug">
                            {reader.description}
                          </p>

                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs text-text-muted">
                              <span>
                                {reader.finishedCount} / {reader.chapterCount} chapters ·{' '}
                                {reader.vocabCount} words
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
                </section>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
