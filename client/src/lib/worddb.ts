import type { SqlJsStatic, Database } from 'sql.js'

export interface Word {
  id: string
  simplified: string
  traditional: string | null
  pinyin: string
  definition: string
  hsk_level: number
  deck_name: string
  notes: string | null
}

let sqlJs: SqlJsStatic | null = null
let dbInstance: Database | null = null

function toObjects<T>(result: ReturnType<Database['exec']>): T[] {
  if (result.length === 0) return []
  const { columns, values } = result[0]
  return values.map((row) =>
    Object.fromEntries(columns.map((c, i) => [c, row[i]])) as T
  )
}

export async function loadDB(): Promise<{
  getWord: (simplified: string) => Word | null
  getWordsByLevel: (level: number) => Word[]
  getAllWords: () => Word[]
  searchWords: (query: string) => Word[]
}> {
  if (!dbInstance) {
    if (!sqlJs) {
      const initSqlJs = (await import('sql.js')).default
      sqlJs = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' })
    }
    const buf = await fetch('/words.db').then((r) => r.arrayBuffer())
    dbInstance = new sqlJs.Database(new Uint8Array(buf))
  }

  const db = dbInstance

  return {
    getWord(simplified: string): Word | null {
      const result = db.exec('SELECT * FROM words WHERE simplified = ?', [simplified])
      const rows = toObjects<Word>(result)
      return rows[0] ?? null
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
      const q = `%${query}%`
      const result = db.exec(
        `SELECT * FROM words
         WHERE simplified LIKE ? OR traditional LIKE ? OR pinyin LIKE ? OR definition LIKE ?
         ORDER BY hsk_level ASC
         LIMIT 50`,
        [q, q, q, q]
      )
      return toObjects<Word>(result)
    },
  }
}
