import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'fs'
import { resolve, dirname, basename } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sourceDir = resolve(__dirname, '../../content/readers')
const outDir = resolve(__dirname, '../../apps/app/public/data/readers')

// Content quality gates. Loosening any of these is a deliberate, reviewable edit.
const MIN_NEW_WORDS = 10
const MAX_NEW_WORDS = 20
const MIN_REPETITIONS = 3

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
  paragraphs: SourceParagraph[]
}

interface SourceReader {
  id: string
  title: string
  titleEn: string
  description: string
  hskLevel: number
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
  /** Distinct word tokens in this chapter, in order of first appearance. */
  vocab: string[]
}

interface Reader {
  id: string
  title: string
  titleEn: string
  description: string
  hskLevel: number
  chapters: ReaderChapter[]
}

interface ManifestEntry {
  id: string
  title: string
  titleEn: string
  description: string
  hskLevel: number
  chapterCount: number
  vocabCount: number
}

// ── HSK word data (same source as words.db) ───────────────────────────────────

interface HskWord {
  simplified: string
  pinyin: string
  definition: string
  hskLevel: number
}

const hsk = new Map<string, HskWord>()
for (const level of [1, 2, 3, 4]) {
  const words = JSON.parse(
    readFileSync(resolve(__dirname, `hsk${level}.json`), 'utf-8')
  ) as HskWord[]
  for (const w of words) {
    if (!hsk.has(w.simplified)) hsk.set(w.simplified, w)
  }
}

// ── Build ─────────────────────────────────────────────────────────────────────

const errors: string[] = []

function isPunctuation(text: string): boolean {
  return [...text].every((c) => PUNCTUATION.has(c))
}

function buildReader(source: SourceReader): Reader {
  const where = (chapterId: string) => `${source.id}/${chapterId}`
  const seenInReader = new Set<string>()

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

    const record = (text: string) => {
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
          // Inline gloss — proper nouns and anything outside HSK 1–4. This is the one
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
          errors.push(
            `${where(chapter.id)}: token "${token}" is HSK ${word.hskLevel}, above the reader's level ${source.hskLevel}`
          )
        }
        record(token)
        return { kind: 'word', text: token, pinyin: word.pinyin, definition: word.definition }
      })

      return { tokens, translation: paragraph.translation }
    })

    const introduces = vocab.filter((w) => !seenInReader.has(w))
    for (const w of vocab) seenInReader.add(w)

    if (introduces.length < MIN_NEW_WORDS || introduces.length > MAX_NEW_WORDS) {
      errors.push(
        `${where(chapter.id)}: introduces ${introduces.length} new words, expected ${MIN_NEW_WORDS}–${MAX_NEW_WORDS}`
      )
    }

    const thin = introduces
      .filter((w) => (occurrences.get(w) ?? 0) < MIN_REPETITIONS)
      .map((w) => `${w} (${occurrences.get(w)}×)`)
    if (thin.length > 0) {
      errors.push(
        `${where(chapter.id)}: new words repeated fewer than ${MIN_REPETITIONS} times — ${thin.join(', ')}`
      )
    }

    return {
      id: chapter.id,
      title: chapter.title,
      titleEn: chapter.titleEn,
      paragraphs,
      vocab,
    }
  })

  return {
    id: source.id,
    title: source.title,
    titleEn: source.titleEn,
    description: source.description,
    hskLevel: source.hskLevel,
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
  title: r.title,
  titleEn: r.titleEn,
  description: r.description,
  hskLevel: r.hskLevel,
  chapterCount: r.chapters.length,
  vocabCount: new Set(r.chapters.flatMap((c) => c.vocab)).size,
}))

writeFileSync(resolve(outDir, 'index.json'), JSON.stringify({ readers: manifest }))
for (const reader of readers) {
  writeFileSync(resolve(outDir, `${reader.id}.json`), JSON.stringify(reader))
}

const chapterCount = readers.reduce((n, r) => n + r.chapters.length, 0)
console.log(`Built readers → ${outDir} (${readers.length} readers, ${chapterCount} chapters)`)
