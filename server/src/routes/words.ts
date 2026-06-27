import { Hono } from 'hono'
import { prisma } from '../lib/db.ts'

const app = new Hono()

app.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<{
    status?: string
    consecutiveFails?: number
    notes?: string
  }>()

  const updates: Record<string, unknown> = {}
  if (body.status !== undefined) updates.status = body.status
  if (body.notes !== undefined) updates.notes = body.notes

  const word = await prisma.word.update({ where: { id }, data: updates })

  if (body.consecutiveFails !== undefined) {
    await prisma.review.update({
      where: { wordId: id },
      data: { consecutiveFails: body.consecutiveFails },
    })
  }

  return c.json(word)
})

app.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await prisma.word.delete({ where: { id } })
  return c.json({ deleted: true })
})

app.post('/:id/notes', async (c) => {
  const id = c.req.param('id')
  const { notes } = await c.req.json<{ notes: string }>()
  const word = await prisma.word.update({ where: { id }, data: { notes } })
  return c.json(word)
})

export default app
