import { Hono } from 'hono'
import { prisma } from '../lib/db.ts'

const app = new Hono()

app.get('/', async (c) => {
  const now = new Date()
  const today = now.toISOString().split('T')[0]

  // Daily review counts for last 365 days
  const yearAgo = new Date(now)
  yearAgo.setDate(yearAgo.getDate() - 365)

  const historyRaw = await prisma.reviewHistory.findMany({
    where: { reviewedAt: { gte: yearAgo } },
    select: { reviewedAt: true, correct: true },
  })

  const dailyMap = new Map<string, { count: number; correct: number }>()
  for (const h of historyRaw) {
    const d = h.reviewedAt.toISOString().split('T')[0]
    const entry = dailyMap.get(d) ?? { count: 0, correct: 0 }
    entry.count++
    if (h.correct) entry.correct++
    dailyMap.set(d, entry)
  }

  const dailyCounts = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { count }]) => ({ date, count }))

  // Retention last 30 days
  const thirtyAgo = new Date(now)
  thirtyAgo.setDate(thirtyAgo.getDate() - 30)

  const retentionMap = new Map<string, { correct: number; total: number }>()
  for (const h of historyRaw) {
    if (h.reviewedAt < thirtyAgo) continue
    const d = h.reviewedAt.toISOString().split('T')[0]
    const entry = retentionMap.get(d) ?? { correct: 0, total: 0 }
    entry.total++
    if (h.correct) entry.correct++
    retentionMap.set(d, entry)
  }

  const retention = Array.from(retentionMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { correct, total }]) => ({
      date,
      rate: total > 0 ? Math.round((correct / total) * 100) : 0,
    }))

  // Word counts by status
  const statusGroups = await prisma.word.groupBy({
    by: ['status'],
    _count: true,
  })
  const statusCounts: Record<string, number> = {}
  for (const g of statusGroups) {
    statusCounts[g.status] = g._count
  }

  // Due cards
  const dueCount = await prisma.review.count({
    where: { nextReviewDate: { lte: now }, word: { status: { notIn: ['Mastered', 'Leech'] } } },
  })

  const newCount = await prisma.word.count({ where: { status: 'Unstudied' } })

  const leeches = await prisma.word.findMany({
    where: { status: 'Leech' },
    include: { review: true },
  })

  return c.json({
    dailyCounts,
    statusCounts,
    retention,
    dueCount,
    newCount,
    leeches,
  })
})

export default app
