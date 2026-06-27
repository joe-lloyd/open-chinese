import { Hono } from 'hono'
import { prisma } from '../lib/db.ts'

const app = new Hono()

app.get('/', async (c) => {
  const now = new Date()

  const deckGroups = await prisma.word.groupBy({
    by: ['deckName'],
    _count: true,
  })

  const priorities = await prisma.deckPriority.findMany()
  const priorityMap = new Map(priorities.map((p) => [p.deckName, p.priority]))

  const decks = await Promise.all(
    deckGroups.map(async (g) => {
      const dueCount = await prisma.review.count({
        where: {
          word: { deckName: g.deckName, status: { notIn: ['Mastered', 'Leech'] } },
          nextReviewDate: { lte: now },
        },
      })

      return {
        deckName: g.deckName,
        wordCount: g._count,
        dueCount,
        priority: priorityMap.get(g.deckName) ?? 0,
      }
    }),
  )

  decks.sort((a, b) => a.priority - b.priority)
  return c.json(decks)
})

app.post('/priority', async (c) => {
  const { order } = await c.req.json<{ order: string[] }>()

  await prisma.$transaction(
    order.map((deckName, i) =>
      prisma.deckPriority.upsert({
        where: { deckName },
        create: { deckName, priority: i },
        update: { priority: i },
      }),
    ),
  )

  return c.json({ updated: true })
})

app.post('/:name/mark-known', async (c) => {
  const deckName = c.req.param('name')
  const { wordIds } = await c.req.json<{ wordIds: string[] }>()

  await prisma.$transaction([
    prisma.word.updateMany({
      where: { id: { in: wordIds }, deckName },
      data: { status: 'Mastered' },
    }),
    ...wordIds.map((id) =>
      prisma.review.updateMany({
        where: { wordId: id },
        data: {
          intervalMeaning: 365,
          intervalPinyin: 365,
          intervalAudio: 365,
        },
      }),
    ),
  ])

  return c.json({ updated: wordIds.length })
})

app.get('/:name/words', async (c) => {
  const deckName = c.req.param('name')
  const words = await prisma.word.findMany({
    where: { deckName },
    include: { review: true },
    orderBy: { simplified: 'asc' },
  })
  return c.json(words)
})

export default app
