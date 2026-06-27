import { prisma } from './db.ts'
import hskWords from '../data/hsk.json' assert { type: 'json' }

interface HskEntry {
  simplified: string
  traditional: string | null
  pinyin: string
  definition: string
  hskLevel: number
}

export async function seedHsk(): Promise<void> {
  const words = hskWords as HskEntry[]

  const existing = new Set(
    (await prisma.word.findMany({ select: { simplified: true } })).map((w) => w.simplified),
  )

  const seen = new Set<string>()
  const toInsert = words.filter((w) => {
    if (existing.has(w.simplified) || seen.has(w.simplified)) return false
    seen.add(w.simplified)
    return true
  })
  if (toInsert.length === 0) return

  await prisma.$transaction(async (tx) => {
    for (const w of toInsert) {
      const word = await tx.word.create({
        data: {
          simplified: w.simplified,
          traditional: w.traditional,
          pinyin: w.pinyin,
          definition: w.definition,
          hskLevel: w.hskLevel,
          deckName: `HSK ${w.hskLevel}`,
          status: 'Unstudied',
        },
      })
      await tx.review.create({ data: { wordId: word.id } })
    }
  })

  console.log(`Seeded ${toInsert.length} HSK words (${existing.size} already existed)`)
}
