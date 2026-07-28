import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { findChapter, loadReader, nextChapter, unencounteredWords } from '../lib/readers'
import type { Reader, ReaderChapter } from '../lib/readers'
import { loadDB } from '../lib/worddb'
import {
  addEncounteredWords,
  getAllUserWords,
  getReaderProgress,
  markChapterComplete,
  recordChapterOpened,
} from '../lib/firestore'
import type { EncounteredWord } from '../lib/firestore'
import { getCurrentUid } from '../lib/auth'
import ReaderText from '../components/ReaderText'
import HskBadge from '../components/HskBadge'

const PINYIN_KEY = 'readers.showPinyin'
const TRANSLATION_KEY = 'readers.showTranslation'

function storedToggle(key: string): boolean {
  return localStorage.getItem(key) === 'true'
}

export default function ChapterPage() {
  const { readerId = '', chapterId = '' } = useParams()
  const navigate = useNavigate()

  const [reader, setReader] = useState<Reader | null>(null)
  const [chapter, setChapter] = useState<ReaderChapter | null>(null)
  const [unencountered, setUnencountered] = useState<Set<string>>(new Set())
  const [finished, setFinished] = useState(false)
  const [addedWords, setAddedWords] = useState<string[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const [showPinyin, setShowPinyin] = useState(() => storedToggle(PINYIN_KEY))
  const [showTranslation, setShowTranslation] = useState(() => storedToggle(TRANSLATION_KEY))

  const togglePinyin = useCallback(() => {
    setShowPinyin((v) => {
      localStorage.setItem(PINYIN_KEY, String(!v))
      return !v
    })
  }, [])

  const toggleTranslation = useCallback(() => {
    setShowTranslation((v) => {
      localStorage.setItem(TRANSLATION_KEY, String(!v))
      return !v
    })
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setAddedWords(null)

      const loaded = await loadReader(readerId)
      const loadedChapter = loaded ? findChapter(loaded, chapterId) : null
      if (cancelled) return

      setReader(loaded)
      setChapter(loadedChapter)

      const uid = getCurrentUid()
      if (loaded && loadedChapter && uid) {
        const [userWords, progress] = await Promise.all([
          getAllUserWords(uid),
          getReaderProgress(uid, readerId),
        ])
        if (cancelled) return

        const encountered = new Set(userWords.map((w) => w.simplified))
        setUnencountered(new Set(unencounteredWords(loadedChapter, encountered)))
        setFinished(progress?.completedChapters.includes(chapterId) ?? false)

        // Fire-and-forget: a failed "continue reading" pointer must not block reading.
        recordChapterOpened(uid, {
          readerId,
          chapterId,
          readerTitle: loaded.title,
          chapterTitle: loadedChapter.title,
        }).catch(() => {})
      }

      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [readerId, chapterId])

  async function finish() {
    const uid = getCurrentUid()
    if (!uid || !chapter) return
    setSaving(true)

    const worddb = await loadDB()
    const glosses = new Map(
      chapter.paragraphs
        .flatMap((p) => p.tokens)
        .filter((t) => t.kind === 'word')
        .map((t) => [t.text, t] as const)
    )

    const words: EncounteredWord[] = [...unencountered].map((simplified) => {
      const known = worddb.getWord(simplified)
      if (known) {
        return { simplified, deckName: known.deck_name, hskLevel: known.hsk_level }
      }
      const gloss = glosses.get(simplified)
      return {
        simplified,
        deckName: 'Readers',
        hskLevel: null,
        customWordData: {
          simplified,
          traditional: null,
          pinyin: gloss?.pinyin ?? '',
          definition: gloss?.definition ?? '',
        },
      }
    })

    const added = await addEncounteredWords(uid, words, `${readerId}/${chapterId}`)
    await markChapterComplete(uid, readerId, chapterId)

    setAddedWords(added)
    setUnencountered(new Set())
    setFinished(true)
    setSaving(false)
  }

  if (loading) return <div className="p-4 sm:p-8 text-text-muted">Loading…</div>

  if (!reader || !chapter) {
    return (
      <div className="p-4 sm:p-8 max-w-3xl mx-auto space-y-3">
        <h1 className="text-2xl font-bold text-text-primary">Chapter not found</h1>
        <Link to="/readers" className="text-accent text-sm hover:underline">
          ← Back to readers
        </Link>
      </div>
    )
  }

  const next = nextChapter(reader, chapterId)
  const index = reader.chapters.findIndex((c) => c.id === chapterId)

  return (
    <div className="pb-16">
      <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Link
                to={`/readers/${reader.id}`}
                className="text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                ← {reader.title}
              </Link>
              <h1 className="text-lg font-bold text-text-primary truncate">
                {index + 1}. {chapter.title}
              </h1>
              <p className="text-xs text-text-muted truncate">{chapter.titleEn}</p>
            </div>
            <HskBadge level={reader.hskLevel} />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Toggle active={showPinyin} onClick={togglePinyin}>
              Pinyin
            </Toggle>
            <Toggle active={showTranslation} onClick={toggleTranslation}>
              English
            </Toggle>
            <span className="text-xs text-text-muted ml-auto">
              {unencountered.size > 0
                ? `${unencountered.size} new ${unencountered.size === 1 ? 'word' : 'words'}`
                : 'No new words'}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8">
        <ReaderText
          paragraphs={chapter.paragraphs}
          showPinyin={showPinyin}
          showTranslation={showTranslation}
          unencountered={unencountered}
        />

        <div className="mt-4 bg-surface-raised border border-border rounded-2xl p-5 space-y-4">
          {finished ? (
            <>
              <p className="text-sm font-medium text-text-primary">Chapter finished</p>
              {addedWords != null && (
                <p className="text-sm text-text-muted">
                  {addedWords.length > 0
                    ? `${addedWords.length} new ${addedWords.length === 1 ? 'word' : 'words'} added to your dictionary: ${addedWords.join('、')}`
                    : 'No new words to add — you already knew every word in this chapter.'}
                </p>
              )}
              {next ? (
                <button
                  onClick={() => navigate(`/readers/${reader.id}/${next.id}`)}
                  className="w-full py-2.5 bg-accent text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Next chapter: {next.title}
                </button>
              ) : (
                <Link
                  to={`/readers/${reader.id}`}
                  className="block text-center w-full py-2.5 border border-border rounded-xl text-sm font-medium text-text-primary hover:bg-surface transition-colors"
                >
                  Back to {reader.title}
                </Link>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-text-muted">
                {unencountered.size > 0
                  ? `Finishing this chapter adds ${unencountered.size} new ${unencountered.size === 1 ? 'word' : 'words'} to your personal dictionary.`
                  : 'You have already met every word in this chapter.'}
              </p>
              <button
                onClick={finish}
                disabled={saving}
                className="w-full py-2.5 bg-accent text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Mark as finished'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
        active
          ? 'bg-accent text-white border-accent'
          : 'border-border text-text-muted hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  )
}
