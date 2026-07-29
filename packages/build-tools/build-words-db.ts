import Database from 'better-sqlite3'
import { readFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'
import { pinyin } from 'pinyin-pro'
import { normalizePinyin } from '../../apps/app/src/lib/pinyin.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = resolve(__dirname, '../../apps/app/public/words.db')

mkdirSync(dirname(outPath), { recursive: true })

interface HskWord {
  simplified: string
  traditional: string | null
  pinyin: string
  definition: string
  hskLevel: number
  sentenceZh?: string
  sentenceEn?: string
  /** Overrides the generated reading — for the cases the generator gets wrong (erhua, sandhi). */
  sentencePinyin?: string
}

const PUNCTUATION: Record<string, string> = {
  '。': '.', '，': ',', '、': ',', '？': '?', '！': '!',
  '：': ':', '；': ';', '“': '"', '”': '"', '‘': "'", '’': "'",
  '（': '(', '）': ')', '《': '"', '》': '"', '…': '…',
}

/** Tone marks, apostrophes, case and ü/v spelling removed — the syllable's identity only. */
function bare(syllable: string): string {
  return syllable
    .normalize('NFD')
    .replace(/[̀-̏]/g, '')
    .replace(/[\s'·]/g, '')
    .replace(/ü/g, 'v')
    .toLowerCase()
}

const isNeutral = (syllable: string) => !/[̀-̏]/.test(syllable.normalize('NFD'))

/**
 * Splits a headword's dictionary reading into one tone-marked syllable per
 * character, by walking it against the generator's own toneless syllabification.
 * Returns null when the two disagree — a different reading of the word, which
 * must not be forced onto a sentence.
 */
function syllabify(word: string, dictPinyin: string): string[] | null {
  const chars = [...word]
  const toneless = pinyin(word, { type: 'array', toneType: 'none' })
  if (toneless.length !== chars.length) return null

  const compact = [...dictPinyin].filter((c) => !/[\s'·]/.test(c))
  const out: string[] = []
  let i = 0
  for (const expected of toneless) {
    const width = bare(expected).length
    const taken = compact.slice(i, i + width).join('')
    if (bare(taken) !== bare(expected)) return null
    out.push(taken)
    i += width
  }
  return i === compact.length ? out : null
}

/**
 * Per-character neutral-tone readings taken from each headword's own `pinyin`
 * column, keyed by the word.
 *
 * pinyin-pro reads every syllable in its full citation tone, so 谢谢 comes back
 * as `xiè xiè` while the dictionary — and the card's own pinyin block — says
 * `xièxie`. Showing a learner both on one screen teaches the wrong thing, and
 * the structural particle 得 read as `dé` is the exact grammar point its
 * sentences exist to demonstrate.
 *
 * Only neutral-toned dictionary syllables are recorded, so a correction can
 * never change *which* syllable is read or swap one tone for another — it can
 * only drop a tone the dictionary says is not there.
 */
function buildNeutralReadings(words: HskWord[]): Map<string, (string | null)[]> {
  const map = new Map<string, (string | null)[]>()
  for (const w of words) {
    if (map.has(w.simplified)) continue
    const syllables = syllabify(w.simplified, w.pinyin)
    if (!syllables || !syllables.some(isNeutral)) continue
    map.set(w.simplified, syllables.map((s) => (isNeutral(s) ? s : null)))
  }
  return map
}

/**
 * pinyin-pro segments before transliterating, so polyphones read correctly in
 * context (银行 → yín háng) — those are left alone. Longest-match first, so a
 * compound claims its characters before any single-character particle can:
 * 了解 is read before 了, 着急 before 着.
 */
function toSentencePinyin(sentence: string, neutral: Map<string, (string | null)[]>): string {
  const chars = [...sentence]
  const syllables = pinyin(sentence, { type: 'array' })
  const longest = Math.max(...[...neutral.keys()].map((w) => [...w].length))

  for (let i = 0; i < chars.length; i++) {
    for (let len = Math.min(longest, chars.length - i); len > 0; len--) {
      const reading = neutral.get(chars.slice(i, i + len).join(''))
      if (!reading) continue
      reading.forEach((syllable, k) => {
        if (syllable && bare(syllable) === bare(syllables[i + k])) syllables[i + k] = syllable
      })
      i += len - 1
      break
    }
  }

  const asciified = [...syllables.join(' ')].map((c) => PUNCTUATION[c] ?? c).join('')
  return asciified.replace(/\s+([.,?!:;)"'…])/g, '$1').replace(/(["'(])\s+/g, '$1').trim()
}

const words: HskWord[] = [1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((lvl) =>
  JSON.parse(readFileSync(resolve(__dirname, `hsk${lvl}.json`), 'utf-8')) as HskWord[]
)

const neutralReadings = buildNeutralReadings(words)

const db = new Database(outPath)

db.exec(`
  DROP TABLE IF EXISTS words;
  CREATE TABLE words (
    id TEXT PRIMARY KEY,
    simplified TEXT UNIQUE NOT NULL,
    traditional TEXT,
    pinyin TEXT NOT NULL,
    pinyin_normalized TEXT NOT NULL,
    definition TEXT NOT NULL,
    hsk_level INTEGER,
    deck_name TEXT,
    notes TEXT,
    sentence_zh TEXT,
    sentence_en TEXT,
    sentence_pinyin TEXT
  );
  CREATE INDEX idx_simplified ON words(simplified);
  CREATE INDEX idx_hsk_level ON words(hsk_level);
  CREATE INDEX idx_pinyin_normalized ON words(pinyin_normalized);
`)

const seen = new Set<string>()
const insert = db.prepare(
  `INSERT INTO words (id, simplified, traditional, pinyin, pinyin_normalized, definition, hsk_level, deck_name, sentence_zh, sentence_en, sentence_pinyin)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
)

const insertMany = db.transaction(() => {
  for (const w of words) {
    if (seen.has(w.simplified)) continue
    seen.add(w.simplified)
    const sentencePinyin = w.sentenceZh
      ? w.sentencePinyin ?? toSentencePinyin(w.sentenceZh, neutralReadings)
      : null
    insert.run(
      randomUUID(),
      w.simplified,
      w.traditional ?? null,
      w.pinyin,
      normalizePinyin(w.pinyin),
      w.definition,
      w.hskLevel,
      `HSK ${w.hskLevel}`,
      w.sentenceZh ?? null,
      w.sentenceEn ?? null,
      sentencePinyin
    )
  }
})

insertMany()
db.close()

console.log(`Built words.db → ${outPath} (${seen.size} words)`)
