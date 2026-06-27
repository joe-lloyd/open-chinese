import { Hono } from 'hono'
import { prisma } from '../lib/db.ts'
import {
  selectSubskill,
  applyBinaryReview,
  deriveStatus,
  checkMastery,
  type Subskill,
} from '../lib/srs.ts'

const app = new Hono()

const MODES = ['Standard', 'RefreshWeak', 'Cram', 'HardOnly'] as const
type Mode = (typeof MODES)[number]

app.get('/', async (c) => {
  const limit = parseInt(c.req.query('limit') ?? '50')
  const deckName = c.req.query('deck') ?? undefined
  const mode = (c.req.query('mode') ?? 'Standard') as Mode
  const now = new Date()
  const today = now.toISOString().split('T')[0]

  const statusFilter: string[] = mode === 'RefreshWeak' ? ['Weak'] : ['Unstudied', 'Weak', 'Strong', 'Memorized']

  let whereReview: object = {}
  if (mode === 'Cram') {
    whereReview = {}
  } else {
    whereReview = { nextReviewDate: { lte: now } }
  }

  const words = await prisma.word.findMany({
    where: {
      status: { in: statusFilter },
      ...(deckName ? { deckName } : {}),
      review: whereReview,
    },
    include: { review: true },
    orderBy: { review: { nextReviewDate: 'asc' } },
    take: mode === 'Cram' ? limit : undefined,
  })

  let filtered = words
  if (mode === 'HardOnly') {
    const recentHard = await prisma.reviewHistory.findMany({
      where: {
        response: { in: ['Again', 'Hard'] },
        reviewedAt: { gte: new Date(Date.now() - 7 * 86_400_000) },
      },
      select: { wordId: true },
    })
    const hardIds = new Set(recentHard.map((r) => r.wordId))
    filtered = words.filter((w) => hardIds.has(w.id))
  }

  // Count new cards seen today per deck and enforce limit
  const dailyNewLimit = 20
  const newCardsSeen: Record<string, number> = {}
  const result = []

  for (const word of filtered) {
    if (result.length >= limit) break
    if (!word.review) continue

    if (word.status === 'Unstudied') {
      const deck = word.deckName
      if (!newCardsSeen[deck]) {
        const stats = await prisma.dailyStats.findUnique({
          where: { date_deckName: { date: today, deckName: deck } },
        })
        newCardsSeen[deck] = stats?.newCardsSeen ?? 0
      }
      if (newCardsSeen[deck] >= dailyNewLimit) continue
    }

    const subskill = selectSubskill({
      intervalMeaning: word.review.intervalMeaning,
      intervalPinyin: word.review.intervalPinyin,
      intervalAudio: word.review.intervalAudio,
      easeFactor: word.review.easeFactor,
      consecutiveFails: word.review.consecutiveFails,
      nextReviewDate: word.review.nextReviewDate,
      lastSubskill: (word.review.lastSubskill as Subskill | null) ?? null,
    })

    result.push({
      id: word.id,
      simplified: word.simplified,
      traditional: word.traditional,
      pinyin: word.pinyin,
      definition: word.definition,
      hskLevel: word.hskLevel,
      deckName: word.deckName,
      status: word.status,
      notes: word.notes,
      subskill,
      review: {
        intervalMeaning: word.review.intervalMeaning,
        intervalPinyin: word.review.intervalPinyin,
        intervalAudio: word.review.intervalAudio,
        easeFactor: word.review.easeFactor,
        nextReviewDate: word.review.nextReviewDate,
      },
    })
  }

  return c.json(result)
})

app.post('/review', async (c) => {
  const { wordId, knewPronunciation, knewMeaning } = await c.req.json<{
    wordId: string
    knewPronunciation: boolean
    knewMeaning: boolean
  }>()

  const word = await prisma.word.findUnique({
    where: { id: wordId },
    include: { review: true },
  })

  if (!word || !word.review) {
    return c.json({ error: 'Word not found' }, 404)
  }

  const reviewState = {
    intervalMeaning: word.review.intervalMeaning,
    intervalPinyin: word.review.intervalPinyin,
    intervalAudio: word.review.intervalAudio,
    easeFactor: word.review.easeFactor,
    consecutiveFails: word.review.consecutiveFails,
    nextReviewDate: word.review.nextReviewDate,
    lastSubskill: (word.review.lastSubskill as Subskill | null) ?? null,
  }

  const updated = applyBinaryReview(reviewState, knewPronunciation, knewMeaning)
  const isLeech = updated.consecutiveFails > 8
  const mastered = checkMastery(updated.intervalMeaning, updated.intervalPinyin, updated.intervalAudio)

  let newStatus = deriveStatus(updated.intervalMeaning, updated.intervalPinyin, updated.intervalAudio)
  if (isLeech) newStatus = 'Leech'
  if (mastered) newStatus = 'Mastered'

  const today = new Date().toISOString().split('T')[0]

  await prisma.$transaction([
    prisma.review.update({
      where: { wordId },
      data: {
        intervalMeaning: updated.intervalMeaning,
        intervalPinyin: updated.intervalPinyin,
        intervalAudio: updated.intervalAudio,
        easeFactor: updated.easeFactor,
        consecutiveFails: updated.consecutiveFails,
        nextReviewDate: updated.nextReviewDate,
        lastSubskill: 'combined',
      },
    }),
    prisma.word.update({
      where: { id: wordId },
      data: { status: newStatus },
    }),
    prisma.reviewHistory.create({
      data: {
        wordId,
        subskill: 'combined',
        response: updated.response,
        correct: knewPronunciation && knewMeaning,
        knewPronunciation,
        knewMeaning,
      },
    }),
    ...(word.status === 'Unstudied'
      ? [
          prisma.dailyStats.upsert({
            where: { date_deckName: { date: today, deckName: word.deckName } },
            create: { date: today, deckName: word.deckName, newCardsSeen: 1 },
            update: { newCardsSeen: { increment: 1 } },
          }),
        ]
      : []),
  ])

  return c.json({
    newStatus,
    intervalMeaning: updated.intervalMeaning,
    intervalPinyin: updated.intervalPinyin,
    intervalAudio: updated.intervalAudio,
    easeFactor: updated.easeFactor,
    nextReviewDate: updated.nextReviewDate,
    isLeech,
    mastered,
  })
})

export default app
