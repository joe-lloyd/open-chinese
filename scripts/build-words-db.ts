import Database from 'better-sqlite3'
import { readFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = resolve(__dirname, '../client/public/words.db')

mkdirSync(dirname(outPath), { recursive: true })

interface HskWord {
  simplified: string
  traditional: string | null
  pinyin: string
  definition: string
  hskLevel: number
  sentenceZh?: string
  sentenceEn?: string
}

const words: HskWord[] = [1, 2, 3, 4].flatMap((lvl) =>
  JSON.parse(readFileSync(resolve(__dirname, `hsk${lvl}.json`), 'utf-8')) as HskWord[]
)

const db = new Database(outPath)

db.exec(`
  DROP TABLE IF EXISTS words;
  CREATE TABLE words (
    id TEXT PRIMARY KEY,
    simplified TEXT UNIQUE NOT NULL,
    traditional TEXT,
    pinyin TEXT NOT NULL,
    definition TEXT NOT NULL,
    hsk_level INTEGER,
    deck_name TEXT,
    notes TEXT,
    sentence_zh TEXT,
    sentence_en TEXT
  );
  CREATE INDEX idx_simplified ON words(simplified);
  CREATE INDEX idx_hsk_level ON words(hsk_level);
`)

const seen = new Set<string>()
const insert = db.prepare(
  `INSERT INTO words (id, simplified, traditional, pinyin, definition, hsk_level, deck_name, sentence_zh, sentence_en)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
)

const insertMany = db.transaction(() => {
  for (const w of words) {
    if (seen.has(w.simplified)) continue
    seen.add(w.simplified)
    insert.run(
      randomUUID(),
      w.simplified,
      w.traditional ?? null,
      w.pinyin,
      w.definition,
      w.hskLevel,
      `HSK ${w.hskLevel}`,
      w.sentenceZh ?? null,
      w.sentenceEn ?? null
    )
  }
})

insertMany()
db.close()

console.log(`Built words.db → ${outPath} (${seen.size} words)`)
