import type { SqlJsStatic, Database } from 'sql.js'
import { normalizePinyin } from './pinyin'

export { normalizePinyin }

export interface Word {
  id: string
  simplified: string
  traditional: string | null
  pinyin: string
  pinyin_normalized: string
  definition: string
  hsk_level: number
  deck_name: string
  notes: string | null
  sentence_zh: string | null
  sentence_en: string | null
  sentence_pinyin: string | null
}

const SEARCH_LIMIT = 50
/** Paired with `ESCAPE '\'` so a literal `%` or `_` in the query isn't a wildcard. */
const LIKE_ESCAPE = /[\\%_]/g
/** SQLite's default SQLITE_MAX_VARIABLE_NUMBER is 999; stay well inside it. */
const IN_CHUNK = 500

let sqlJs: SqlJsStatic | null = null
let dbInstance: Database | null = null

function toObjects<T>(result: ReturnType<Database['exec']>): T[] {
  if (result.length === 0) return []
  const { columns, values } = result[0]
  return values.map((row) =>
    Object.fromEntries(columns.map((c, i) => [c, row[i]])) as T
  )
}

function hasColumn(db: Database, table: string, column: string): boolean {
  return db
    .exec(`PRAGMA table_info(${table})`)
    .flatMap((r) => r.values)
    .some((row) => row[1] === column)
}

export async function loadDB(): Promise<{
  getWord: (simplified: string) => Word | null
  getWords: (simplifieds: string[]) => Word[]
  getWordsByLevel: (level: number) => Word[]
  getAllWords: () => Word[]
  searchWords: (query: string) => Word[]
}> {
  if (!dbInstance) {
    if (!sqlJs) {
      const initSqlJs = (await import('sql.js')).default
      sqlJs = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' })
    }
    const bust = import.meta.env.VITE_BUILD_ID ?? 'dev'
    const buf = await fetch(`/words.db?v=${bust}`).then((r) => r.arrayBuffer())
    dbInstance = new sqlJs.Database(new Uint8Array(buf))
  }

  const db = dbInstance
  // A words.db built before this column existed still loads; search degrades to
  // matching the tone-marked pinyin instead of throwing.
  const hasNormalizedPinyin = hasColumn(db, 'words', 'pinyin_normalized')

  return {
    getWord(simplified: string): Word | null {
      const result = db.exec('SELECT * FROM words WHERE simplified = ?', [simplified])
      const rows = toObjects<Word>(result)
      return rows[0] ?? null
    },

    getWords(simplifieds: string[]): Word[] {
      const out: Word[] = []
      for (let i = 0; i < simplifieds.length; i += IN_CHUNK) {
        const chunk = simplifieds.slice(i, i + IN_CHUNK)
        const placeholders = chunk.map(() => '?').join(',')
        const result = db.exec(
          `SELECT * FROM words WHERE simplified IN (${placeholders})`,
          chunk
        )
        out.push(...toObjects<Word>(result))
      }
      return out
    },

    getWordsByLevel(level: number): Word[] {
      const result = db.exec(
        'SELECT * FROM words WHERE hsk_level = ? ORDER BY simplified',
        [level]
      )
      return toObjects<Word>(result)
    },

    getAllWords(): Word[] {
      const result = db.exec('SELECT * FROM words ORDER BY hsk_level ASC, simplified ASC')
      return toObjects<Word>(result)
    },

    searchWords(query: string): Word[] {
      const q = query.trim()
      if (!q) return []

      const pinyinColumn = hasNormalizedPinyin ? 'pinyin_normalized' : 'pinyin'
      const pq = hasNormalizedPinyin ? normalizePinyin(q) : q.toLowerCase()
      // A pure-hanzi query normalizes to '', which would make the pinyin
      // predicates match every row.
      const usePinyin = pq.length > 0

      // Equality params stay raw; only the LIKE patterns are escaped, so a query
      // of `%` or `_` matches those characters literally instead of everything.
      const qLike = q.replace(LIKE_ESCAPE, '\\$&')
      const pqLike = pq.replace(LIKE_ESCAPE, '\\$&')
      const E = "ESCAPE '\\'"

      const params: Record<string, string> = {
        ':q': q,
        ':prefix': `${qLike}%`,
        ':like': `%${qLike}%`,
      }
      if (usePinyin) {
        params[':pq'] = pq
        params[':pqPrefix'] = `${pqLike}%`
        params[':pqLike'] = `%${pqLike}%`
      }

      const rank = [
        'CASE',
        'WHEN simplified = :q OR traditional = :q THEN 0',
        `WHEN simplified LIKE :prefix ${E} OR traditional LIKE :prefix ${E} THEN 1`,
        ...(usePinyin
          ? [
              `WHEN ${pinyinColumn} = :pq THEN 2`,
              `WHEN ${pinyinColumn} LIKE :pqPrefix ${E} THEN 3`,
            ]
          : []),
        `WHEN definition LIKE :prefix ${E} THEN 4`,
        'ELSE 5 END',
      ].join(' ')

      const where = [
        `simplified LIKE :like ${E}`,
        `traditional LIKE :like ${E}`,
        `definition LIKE :like ${E}`,
        ...(usePinyin ? [`${pinyinColumn} LIKE :pqLike ${E}`] : []),
      ].join(' OR ')

      const result = db.exec(
        `SELECT * FROM words
         WHERE ${where}
         ORDER BY ${rank} ASC, hsk_level ASC, simplified ASC
         LIMIT ${SEARCH_LIMIT}`,
        params
      )
      return toObjects<Word>(result)
    },
  }
}
