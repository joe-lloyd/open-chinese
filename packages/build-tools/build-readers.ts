import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'fs'
import { resolve, dirname, basename } from 'path'
import { fileURLToPath } from 'url'
import { validateReaderCover } from './reader-cover'
import type { ReaderCover } from './reader-cover'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sourceDir = resolve(__dirname, '../../content/readers')
const outDir = resolve(__dirname, '../../apps/app/public/data/readers')
const publicDir = resolve(__dirname, '../../apps/app/public')

// Content quality gates. These reward complete scenes and deliberate vocabulary
// practice without forcing prose into repetitive drill sentences.
const MIN_CHAPTERS = 3
const MIN_PARAGRAPHS = 2
const MIN_WORD_TOKENS = 30
const MAX_WORD_TOKENS = 220
const MIN_FOCUS_WORDS = 3
const MAX_FOCUS_WORDS = 8
const MIN_FOCUS_REPETITIONS = 1
const MAX_STRETCH_WORDS = 8
const MAX_STRETCH_RATIO = 0.2

const PUNCTUATION = new Set('。，、；：？！…—～·《》〈〉「」『』【】（）“”‘’.,!?;:()[]"\'- \n'.split(''))

// ── Authored source shapes ────────────────────────────────────────────────────

interface InlineToken {
  text: string
  pinyin: string
  definition: string
}

type SourceToken = string | InlineToken

interface SourceParagraph {
  tokens: SourceToken[]
  translation: string
}

interface SourceChapter {
  id: string
  title: string
  titleEn: string
  focusWords: string[]
  paragraphs: SourceParagraph[]
}

interface SourceReader {
  id: string
  order: number
  title: string
  titleEn: string
  description: string
  hskLevel: number
  goal: string
  conflict: string
  resolution: string
  cover?: ReaderCover
  chapters: SourceChapter[]
}

// ── Emitted runtime shapes (kept in sync with client/src/lib/readers.ts) ───────

type ReaderToken =
  | { kind: 'word'; text: string; pinyin: string; definition: string }
  | { kind: 'punct'; text: string }

interface ReaderParagraph {
  tokens: ReaderToken[]
  translation: string
}

interface ReaderChapter {
  id: string
  title: string
  titleEn: string
  paragraphs: ReaderParagraph[]
  focusWords: string[]
  /** A small number of contextual words introduced from a later HSK stage. */
  stretchWords: string[]
  /** Distinct word tokens in this chapter, in order of first appearance. */
  vocab: string[]
}

interface Reader {
  id: string
  order: number
  title: string
  titleEn: string
  description: string
  hskLevel: number
  cover?: ReaderCover
  chapters: ReaderChapter[]
}

interface ManifestEntry {
  id: string
  order: number
  title: string
  titleEn: string
  description: string
  hskLevel: number
  chapterCount: number
  vocabCount: number
  cover?: ReaderCover
}

// ── HSK word data (same source as words.db) ───────────────────────────────────

interface HskWord {
  simplified: string
  pinyin: string
  definition: string
  hskLevel: number
}

const hsk = new Map<string, HskWord>()
for (const level of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
  const words = JSON.parse(
    readFileSync(resolve(__dirname, `hsk${level}.json`), 'utf-8')
  ) as HskWord[]
  for (const w of words) {
    if (!hsk.has(w.simplified)) hsk.set(w.simplified, w)
  }
}

// ── Build ─────────────────────────────────────────────────────────────────────

const errors: string[] = []
const paragraphOwners = new Map<string, string>()

function isPunctuation(text: string): boolean {
  return [...text].every((c) => PUNCTUATION.has(c))
}

function buildReader(source: SourceReader): Reader {
  const where = (chapterId: string) => `${source.id}/${chapterId}`

  if (!Number.isInteger(source.order) || source.order < 1) {
    errors.push(`${source.id}: story order must be a positive integer`)
  }
  if (![source.title, source.titleEn, source.description, source.goal, source.conflict, source.resolution]
    .every((value) => value?.trim())) {
    errors.push(`${source.id}: story metadata must include title, description, goal, conflict and resolution`)
  }
  if (source.chapters.length < MIN_CHAPTERS) {
    errors.push(`${source.id}: has ${source.chapters.length} chapters, expected at least ${MIN_CHAPTERS}`)
  }
  const cover = validateReaderCover(source.id, source.cover, publicDir, errors)

  // Chapter ids address both the route and the entries in `completedChapters`, so a
  // duplicate silently conflates two chapters' progress and makes the second
  // unreachable.
  const seenChapterIds = new Set<string>()
  for (const chapter of source.chapters) {
    if (!chapter.id?.trim()) errors.push(`${source.id}: chapter with no id`)
    else if (seenChapterIds.has(chapter.id)) {
      errors.push(`${source.id}: duplicate chapter id "${chapter.id}"`)
    }
    seenChapterIds.add(chapter.id)
  }

  const chapters = source.chapters.map((chapter) => {
    const occurrences = new Map<string, number>()
    const vocab: string[] = []
    let wordTokenCount = 0
    let stretchTokenCount = 0
    const stretchWords: string[] = []
    const seenStretchWords = new Set<string>()

    if (!chapter.title?.trim() || !chapter.titleEn?.trim()) {
      errors.push(`${where(chapter.id)}: chapter titles must be non-empty`)
    }
    if (chapter.paragraphs.length < MIN_PARAGRAPHS) {
      errors.push(
        `${where(chapter.id)}: has ${chapter.paragraphs.length} paragraphs, expected at least ${MIN_PARAGRAPHS}`
      )
    }
    if (
      chapter.focusWords.length < MIN_FOCUS_WORDS ||
      chapter.focusWords.length > MAX_FOCUS_WORDS
    ) {
      errors.push(
        `${where(chapter.id)}: has ${chapter.focusWords.length} focus words, expected ${MIN_FOCUS_WORDS}–${MAX_FOCUS_WORDS}`
      )
    }

    const record = (text: string) => {
      wordTokenCount += 1
      const next = (occurrences.get(text) ?? 0) + 1
      occurrences.set(text, next)
      if (next === 1) vocab.push(text)
    }

    const paragraphs: ReaderParagraph[] = chapter.paragraphs.map((paragraph, pIndex) => {
      if (!paragraph.translation?.trim()) {
        errors.push(`${where(chapter.id)} paragraph ${pIndex + 1}: missing English translation`)
      }

      const tokens = paragraph.tokens.map((token): ReaderToken => {
        if (typeof token !== 'string') {
          // Inline gloss — proper nouns and anything outside HSK 1–9. This is the one
          // path the HSK data cannot cross-check, so the gloss gate has to be applied
          // by hand here or it does not exist at all.
          const { text, pinyin, definition } = token
          if (!text?.trim()) {
            errors.push(`${where(chapter.id)}: inline token has empty text`)
          } else if (!pinyin?.trim() || !definition?.trim()) {
            errors.push(
              `${where(chapter.id)}: inline token "${text}" is missing ${
                !pinyin?.trim() ? 'a pinyin' : 'a definition'
              } — every word token must open a usable popover`
            )
          }
          // An inline gloss is for words the HSK data does not have. If the data does
          // have it and it is above the reader's level, glossing it inline is smuggling
          // vocabulary past the level-fit gate rather than naming a person or place.
          const known = hsk.get(text)
          if (known && known.hskLevel > source.hskLevel) {
            errors.push(
              `${where(chapter.id)}: inline token "${text}" is HSK ${known.hskLevel}, above the reader's level ${source.hskLevel} — an inline gloss is not a way around the level gate`
            )
          }
          record(text)
          return { kind: 'word', text, pinyin, definition }
        }

        if (!token.trim()) {
          errors.push(`${where(chapter.id)}: empty token`)
          return { kind: 'punct', text: token }
        }

        if (isPunctuation(token)) return { kind: 'punct', text: token }

        if ([...token].some((c) => PUNCTUATION.has(c))) {
          errors.push(`${where(chapter.id)}: token "${token}" mixes text and punctuation`)
        }

        const word = hsk.get(token)
        if (!word) {
          errors.push(
            `${where(chapter.id)}: token "${token}" is not in the HSK word data and has no inline gloss`
          )
          return { kind: 'word', text: token, pinyin: '', definition: '' }
        }
        if (word.hskLevel > source.hskLevel) {
          stretchTokenCount += 1
          if (!seenStretchWords.has(token)) {
            seenStretchWords.add(token)
            stretchWords.push(token)
          }
        }
        record(token)
        return { kind: 'word', text: token, pinyin: word.pinyin, definition: word.definition }
      })

      const fingerprint = tokens.map((token) => token.text).join('')
      const previousOwner = paragraphOwners.get(fingerprint)
      if (previousOwner) {
        errors.push(`${where(chapter.id)} paragraph ${pIndex + 1}: duplicates ${previousOwner}`)
      } else {
        paragraphOwners.set(fingerprint, `${where(chapter.id)} paragraph ${pIndex + 1}`)
      }

      return { tokens, translation: paragraph.translation }
    })

    if (wordTokenCount < MIN_WORD_TOKENS || wordTokenCount > MAX_WORD_TOKENS) {
      errors.push(
        `${where(chapter.id)}: has ${wordTokenCount} word tokens, expected ${MIN_WORD_TOKENS}–${MAX_WORD_TOKENS}`
      )
    }
    if (stretchWords.length > MAX_STRETCH_WORDS) {
      errors.push(
        `${where(chapter.id)}: introduces ${stretchWords.length} stretch words, maximum ${MAX_STRETCH_WORDS} — ${stretchWords.join(', ')}`
      )
    }
    if (stretchTokenCount / wordTokenCount > MAX_STRETCH_RATIO) {
      errors.push(
        `${where(chapter.id)}: ${Math.round((stretchTokenCount / wordTokenCount) * 100)}% of word tokens are above HSK ${source.hskLevel}, maximum ${MAX_STRETCH_RATIO * 100}%`
      )
    }

    const thin = chapter.focusWords
      .filter((w) => (occurrences.get(w) ?? 0) < MIN_FOCUS_REPETITIONS)
      .map((w) => `${w} (${occurrences.get(w)}×)`)
    if (thin.length > 0) {
      errors.push(
        `${where(chapter.id)}: focus words are missing from the chapter — ${thin.join(', ')}`
      )
    }

    for (const focusWord of chapter.focusWords) {
      const word = hsk.get(focusWord)
      if (!word) {
        errors.push(`${where(chapter.id)}: focus word "${focusWord}" is not in the HSK data`)
      } else if (word.hskLevel > source.hskLevel) {
        errors.push(
          `${where(chapter.id)}: focus word "${focusWord}" is HSK ${word.hskLevel}, above reader level ${source.hskLevel}`
        )
      }
    }

    return {
      id: chapter.id,
      title: chapter.title,
      titleEn: chapter.titleEn,
      paragraphs,
      focusWords: chapter.focusWords,
      stretchWords,
      vocab,
    }
  })

  return {
    id: source.id,
    order: source.order,
    title: source.title,
    titleEn: source.titleEn,
    description: source.description,
    hskLevel: source.hskLevel,
    ...(cover ? { cover } : {}),
    chapters,
  }
}

const sourceFiles = readdirSync(sourceDir)
  .filter((f) => f.endsWith('.json'))
  .sort()

const readers = sourceFiles.map((file) => {
  const source = JSON.parse(readFileSync(resolve(sourceDir, file), 'utf-8')) as SourceReader
  if (source.id !== basename(file, '.json')) {
    errors.push(`${file}: reader id "${source.id}" does not match its filename`)
  }
  return buildReader(source)
})

for (let level = 1; level <= 9; level += 1) {
  const levelReaders = readers.filter((reader) => reader.hskLevel === level)
  const orders = levelReaders.map((reader) => reader.order)
  if (new Set(orders).size !== orders.length) {
    errors.push(`HSK ${level}: story orders must be unique`)
  }
  const expectedOrders = levelReaders.map((_, index) => index + 1)
  if ([...orders].sort((a, b) => a - b).some((order, index) => order !== expectedOrders[index])) {
    errors.push(`HSK ${level}: story orders must be consecutive from 1`)
  }
}

// A bad token repeats once per occurrence; the author only needs to be told once.
const distinctErrors = [...new Set(errors)]
if (distinctErrors.length > 0) {
  console.error(`\nReader content validation failed (${distinctErrors.length}):\n`)
  for (const e of distinctErrors) console.error(`  ✗ ${e}`)
  console.error('')
  process.exit(1)
}

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

const manifest: ManifestEntry[] = readers.map((r) => ({
  id: r.id,
  order: r.order,
  title: r.title,
  titleEn: r.titleEn,
  description: r.description,
  hskLevel: r.hskLevel,
  chapterCount: r.chapters.length,
  vocabCount: new Set(r.chapters.flatMap((c) => c.vocab)).size,
  ...(r.cover ? { cover: r.cover } : {}),
}))

writeFileSync(resolve(outDir, 'index.json'), JSON.stringify({ readers: manifest }))
for (const reader of readers) {
  writeFileSync(resolve(outDir, `${reader.id}.json`), JSON.stringify(reader))
}

const chapterCount = readers.reduce((n, r) => n + r.chapters.length, 0)
console.log(`Built readers → ${outDir} (${readers.length} readers, ${chapterCount} chapters)`)
