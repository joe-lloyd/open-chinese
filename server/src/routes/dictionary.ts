import { Hono } from 'hono'
import { prisma } from '../lib/db.ts'

const app = new Hono()

app.get('/', async (c) => {
  const q = c.req.query('q')?.trim()
  if (!q) return c.json([])

  const words = await prisma.word.findMany({
    where: {
      OR: [
        { simplified: { contains: q } },
        { traditional: { contains: q } },
        { pinyin: { contains: q } },
        { definition: { contains: q } },
      ],
    },
    include: { review: true },
    take: 50,
  })

  return c.json(words)
})

export default app
