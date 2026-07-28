import { useEffect, useState } from 'react'

interface RadicalEntry {
  char: string
  pinyin: string
  meaning: string
  radical: string
  radicalMeaning: string
}

let cachedRadicals: Map<string, RadicalEntry> | null = null

async function loadRadicals(): Promise<Map<string, RadicalEntry>> {
  if (cachedRadicals) return cachedRadicals
  try {
    const res = await fetch('/data/radicals.json')
    const data: RadicalEntry[] = await res.json()
    cachedRadicals = new Map(data.map((e) => [e.char, e]))
  } catch {
    cachedRadicals = new Map()
  }
  return cachedRadicals
}

interface Props {
  text: string
}

export default function CharacterBreakdown({ text }: Props) {
  const [entries, setEntries] = useState<(RadicalEntry | null)[]>([])

  useEffect(() => {
    loadRadicals().then((radicals) => {
      const chars = [...text]
      setEntries(chars.map((c) => radicals.get(c) ?? null))
    })
  }, [text])

  if (entries.length === 0) return null

  const chars = [...text]

  return (
    <div className="space-y-2">
      {chars.map((char, i) => {
        const entry = entries[i]
        return (
          <div key={i} className="flex items-center gap-4 bg-surface-raised rounded-lg px-4 py-2">
            <span className="text-3xl text-text-primary w-10">{char}</span>
            {entry ? (
              <div className="flex-1 text-sm">
                <p className="text-accent">{entry.pinyin}</p>
                <p className="text-text-primary">{entry.meaning}</p>
                <p className="text-text-muted">
                  Radical: {entry.radical} · {entry.radicalMeaning}
                </p>
              </div>
            ) : (
              <p className="text-sm text-text-muted">No breakdown available</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
