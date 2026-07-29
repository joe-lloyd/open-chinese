/**
 * Runtime access to the graded reader assets built by
 * `packages/build-tools/build-readers.ts` from the authored sources in
 * `content/readers/`. Shapes here mirror what that script emits.
 */
import { assetUrl } from './assets'

export type ReaderToken =
  | { kind: 'word'; text: string; pinyin: string; definition: string }
  | { kind: 'punct'; text: string }

export interface ReaderParagraph {
  tokens: ReaderToken[]
  translation: string
}

export interface ReaderChapter {
  id: string
  title: string
  titleEn: string
  paragraphs: ReaderParagraph[]
  /** Deliberately practised words for this scene. */
  focusWords: string[]
  /** A small number of contextual words introduced from a later HSK stage. */
  stretchWords: string[]
  /** Distinct word tokens in this chapter, in order of first appearance. */
  vocab: string[]
}

export interface Reader {
  id: string
  order: number
  title: string
  titleEn: string
  description: string
  hskLevel: number
  chapters: ReaderChapter[]
}

export interface ReaderSummary {
  id: string
  order: number
  title: string
  titleEn: string
  description: string
  hskLevel: number
  chapterCount: number
  vocabCount: number
}

const bust = import.meta.env.VITE_BUILD_ID ?? 'dev'

let indexPromise: Promise<ReaderSummary[]> | null = null
const readerPromises = new Map<string, Promise<Reader | null>>()

// Caching the promise, not the value, means a failure would otherwise be cached too —
// one dropped request and that reader stays unloadable until a full page reload. Both
// caches evict themselves when the fetch did not produce content.

export function loadReaderIndex(): Promise<ReaderSummary[]> {
  if (!indexPromise) {
    const promise = fetch(`${assetUrl('data/readers/index.json')}?v=${bust}`)
      .then((r) => (r.ok ? r.json() : { readers: [] }))
      .then((data: { readers: ReaderSummary[] }) => data.readers ?? [])
      .catch(() => [])
    promise.then((readers) => {
      if (readers.length === 0 && indexPromise === promise) indexPromise = null
    })
    indexPromise = promise
  }
  return indexPromise
}

export function loadReader(readerId: string): Promise<Reader | null> {
  const cached = readerPromises.get(readerId)
  if (cached) return cached

  const promise = fetch(
    `${assetUrl(`data/readers/${encodeURIComponent(readerId)}.json`)}?v=${bust}`
  )
    .then((r) => (r.ok ? (r.json() as Promise<Reader>) : null))
    .catch(() => null)
  promise.then((reader) => {
    if (reader === null && readerPromises.get(readerId) === promise) {
      readerPromises.delete(readerId)
    }
  })
  readerPromises.set(readerId, promise)
  return promise
}

export function findChapter(reader: Reader, chapterId: string): ReaderChapter | null {
  return reader.chapters.find((c) => c.id === chapterId) ?? null
}

export function nextChapter(reader: Reader, chapterId: string): ReaderChapter | null {
  const index = reader.chapters.findIndex((c) => c.id === chapterId)
  if (index === -1) return null
  return reader.chapters[index + 1] ?? null
}

/**
 * Words in the chapter the user has never met. A word counts as encountered when
 * a document exists at `users/{uid}/words/{simplified}` — whether it got there
 * through study or through finishing an earlier chapter.
 */
export function unencounteredWords(chapter: ReaderChapter, encountered: Set<string>): string[] {
  return chapter.vocab.filter((w) => !encountered.has(w))
}
