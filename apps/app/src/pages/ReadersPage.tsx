import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ReaderCover from '../components/ReaderCover'
import HskBadge from '../components/HskBadge'
import { getCurrentUid } from '../lib/auth'
import { getAllReaderProgress } from '../lib/firestore'
import { HSK_LEVELS, hskStageName } from '../lib/hsk'
import { loadReaderIndex } from '../lib/readers'
import type { ReaderSummary } from '../lib/readers'

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
      const byReader = new Map(progress.map((item) => [item.readerId, item]))
      setRows(
        readers.map((reader) => ({
          ...reader,
          finishedCount: Math.min(
            byReader.get(reader.id)?.completedChapters.length ?? 0,
            reader.chapterCount
          ),
        }))
      )
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="p-4 text-text-muted sm:p-8">Loading…</div>

  const totalChapters = rows.reduce((total, reader) => total + reader.chapterCount, 0)
  const totalFinished = rows.reduce((total, reader) => total + reader.finishedCount, 0)
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
    <div className="mx-auto max-w-6xl space-y-8 p-4 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Graded Readers</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            Follow the stories in order, from beginner Chinese through HSK 9.
          </p>
        </div>
        <p className="text-sm text-text-muted">
          <span className="font-medium text-text-primary">{totalFinished}</span> / {totalChapters}{' '}
          chapters finished
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-text-muted">No readers available yet.</p>
      ) : (
        <>
          <nav aria-label="Reader skill levels" className="flex gap-2 overflow-x-auto pb-1">
            {groups.map((group) => (
              <a
                key={group.level}
                href={`#hsk-${group.level}`}
                className="shrink-0 rounded-full border border-border bg-surface-raised px-3 py-1.5 text-sm text-text-primary transition-colors hover:border-accent"
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
                    <p className="text-right text-xs text-text-muted">
                      {group.finishedCount} / {group.chapterCount} chapters
                      <span className="block font-medium text-text-primary">{levelPct}% complete</span>
                    </p>
                  </div>

                  <div className="h-1.5 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-500"
                      style={{ width: `${levelPct}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                          className="group overflow-hidden rounded-2xl border border-border bg-surface-raised transition-colors hover:border-accent"
                        >
                          <ReaderCover
                            readerId={reader.id}
                            hskLevel={reader.hskLevel}
                            cover={reader.cover}
                            eager={group.level === groups[0]?.level && reader.order === 1}
                          >
                            <div className="flex items-end justify-between gap-3">
                              <div>
                                <p className="mb-1 text-xs font-medium text-white/80">
                                  Story {reader.order} of {group.readers.length} · HSK {reader.hskLevel}
                                </p>
                                <p className="text-2xl font-bold leading-tight">{reader.title}</p>
                                <p className="text-sm text-white/80">{reader.titleEn}</p>
                              </div>
                              <span className="text-xs font-medium text-white/80">{action}</span>
                            </div>
                          </ReaderCover>

                          <div className="space-y-4 p-4">
                            <p className="text-sm leading-snug text-text-primary">
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
                              <div className="h-1.5 overflow-hidden rounded-full bg-border">
                                <div
                                  className="h-full rounded-full bg-accent transition-all duration-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
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
