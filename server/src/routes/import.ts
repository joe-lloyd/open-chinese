import { Hono } from 'hono'
import { prisma } from '../lib/db.ts'
import { parseHackChineseCSV } from '../lib/import.ts'
import { deriveStatus } from '../lib/srs.ts'

const app = new Hono()

app.post('/preview', async (c) => {
  const body = await c.req.parseBody()
  const file = body['file']

  if (!file || typeof file === 'string') {
    return c.json({ error: 'No CSV file provided' }, 400)
  }

  const text = await (file as File).text()

  try {
    const result = parseHackChineseCSV(text)
    return c.json({
      total: result.rows.length,
      countByStatus: result.countByStatus,
      errors: result.errors,
      errorCount: result.errors.length,
    })
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400)
  }
})

app.post('/confirm', async (c) => {
  const body = await c.req.parseBody()
  const file = body['file']

  if (!file || typeof file === 'string') {
    return c.json({ error: 'No CSV file provided' }, 400)
  }

  const text = await (file as File).text()

  let parsed
  try {
    parsed = parseHackChineseCSV(text)
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400)
  }

  const existing = new Set(
    (await prisma.word.findMany({ select: { simplified: true } })).map((w) => w.simplified),
  )

  const toImport = parsed.rows.filter((r) => !existing.has(r.simplified))
  const skipped = parsed.rows.length - toImport.length

  const now = new Date()

  try {
    await prisma.$transaction(
      toImport.map((row) => {
        const wordStatus = deriveStatus(
          row.intervalMeaning,
          row.intervalPinyin,
          row.intervalAudio,
        )
        return prisma.word.create({
          data: {
            simplified: row.simplified,
            traditional: row.traditional,
            pinyin: row.pinyin,
            definition: row.definition,
            deckName: row.deckName,
            status: wordStatus,
            review: {
              create: {
                intervalMeaning: row.intervalMeaning,
                intervalPinyin: row.intervalPinyin,
                intervalAudio: row.intervalAudio,
                easeFactor: row.easeFactor,
                nextReviewDate: now,
              },
            },
          },
        })
      }),
    )

    return c.json({
      imported: toImport.length,
      skipped,
      errors: parsed.errors.length,
    })
  } catch (e) {
    return c.json({ error: 'Import failed: ' + (e as Error).message }, 500)
  }
})

export default app
