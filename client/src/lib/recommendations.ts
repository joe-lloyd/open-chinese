import type { LastReadPosition } from './firestore'

/**
 * Rule-based "what should I do next" engine.
 *
 * Every rule is a pure function of an explicit context — including `now`, which
 * is passed in rather than read from the clock — so the same context always
 * produces the same recommendations. The only import is a type, erased at
 * build time; there is no runtime dependency on React, Firestore or the router.
 */

export type RecommendationTone = 'accent' | 'good' | 'warning' | 'critical' | 'neutral'

export interface Recommendation {
  id: string
  title: string
  /** One line, built from the learner's own numbers — never generic filler. */
  detail: string
  cta: string
  /** Route including params; also the de-duplication key. */
  to: string
  tone: RecommendationTone
  priority: number
}

export interface RecommendationContext {
  now: Date
  /** Cards scheduled at or before `now`. */
  dueCount: number
  /** Words in the static DB the learner has never studied. */
  newAvailable: number
  leechCount: number
  weakCount: number
  /** Words with any status other than Unstudied. */
  studiedCount: number
  reviewedToday: number
  currentStreak: number
  hskProgress: { level: number; studied: number; total: number; pct: number }[]
  lastRead: LastReadPosition | null
}

/**
 * Thresholds live together so they can be tuned in one place. They are
 * starting guesses, not measured values.
 */
export const THRESHOLDS = {
  /** Due count above which a plain session stops feeling achievable. */
  backlog: 100,
  /** Leeches worth interrupting the normal flow for. */
  leeches: 5,
  /** Weak words that warrant a dedicated refresh once nothing is due. */
  weak: 20,
  /** Proportion of an HSK level studied before "nearly there" applies. */
  hskNearlyDone: 0.7,
  /** Local hour from which an unstudied day counts as a streak at risk. */
  streakRiskHour: 17,
} as const

export function readerRoute(position: LastReadPosition): string {
  return `/readers/${encodeURIComponent(position.readerId)}/${encodeURIComponent(position.chapterId)}`
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

type Rule = (ctx: RecommendationContext) => Recommendation | null

const RULES: Rule[] = [
  // Nothing studied at all — everything else would read as noise.
  (ctx) =>
    ctx.studiedCount > 0
      ? null
      : {
          id: 'first-steps',
          title: 'Start with HSK 1',
          detail: 'You have not studied any words yet. Pick a level and take the first session.',
          cta: 'Choose a level',
          to: '/hsk',
          tone: 'accent',
          priority: 100,
        },

  // A backlog this size is not a normal session — offer a time-boxed cram.
  (ctx) =>
    ctx.dueCount < THRESHOLDS.backlog
      ? null
      : {
          id: 'backlog-cram',
          title: 'Clear the backlog',
          detail: `${ctx.dueCount} cards are waiting. A 15-minute cram takes the hardest ones first.`,
          cta: 'Cram for 15 minutes',
          to: '/study?mode=cram&minutes=15',
          tone: 'warning',
          priority: 90,
        },

  // Late in the day, a live streak, nothing done yet.
  (ctx) =>
    ctx.currentStreak >= 2 &&
    ctx.reviewedToday === 0 &&
    ctx.now.getHours() >= THRESHOLDS.streakRiskHour
      ? {
          id: 'streak-at-risk',
          title: 'Keep your streak alive',
          detail: `You are on a ${ctx.currentStreak}-day streak and have not studied today. Five minutes is enough.`,
          cta: 'Study for 5 minutes',
          to: '/study?minutes=5',
          tone: 'critical',
          priority: 80,
        }
      : null,

  (ctx) =>
    ctx.dueCount === 0
      ? null
      : {
          id: 'due-review',
          title: 'Reviews are due',
          detail: `${plural(ctx.dueCount, 'card is', 'cards are')} scheduled for today.`,
          cta: 'Start reviewing',
          to: '/study',
          tone: 'accent',
          priority: 70,
        },

  (ctx) =>
    ctx.leechCount < THRESHOLDS.leeches
      ? null
      : {
          id: 'leeches',
          title: 'Leeches are piling up',
          detail: `${plural(ctx.leechCount, 'word keeps', 'words keep')} slipping. A session of just these breaks the loop.`,
          cta: 'Drill the hard ones',
          to: '/study?mode=hardOnly',
          tone: 'critical',
          priority: 60,
        },

  // Owned by the graded-readers feature; absent until that ships.
  (ctx) => {
    const position = ctx.lastRead
    if (!position) return null
    const where = position.chapterTitle ?? position.readerTitle ?? 'where you left off'
    const pct = position.progress != null ? ` You are ${Math.round(position.progress * 100)}% through.` : ''
    return {
      id: 'continue-reading',
      title: 'Continue reading',
      detail: `Pick up ${where}.${pct}`,
      cta: 'Resume chapter',
      to: readerRoute(position),
      tone: 'neutral',
      priority: 50,
    }
  },

  (ctx) => {
    const candidate = ctx.hskProgress
      .filter((l) => l.total > 0 && l.studied < l.total && l.studied / l.total >= THRESHOLDS.hskNearlyDone)
      .sort((a, b) => b.pct - a.pct)[0]
    if (!candidate) return null
    const remaining = candidate.total - candidate.studied
    return {
      id: 'finish-hsk-level',
      title: `Finish HSK ${candidate.level}`,
      detail: `${candidate.pct}% done — ${plural(remaining, 'word', 'words')} left to see for the first time.`,
      cta: `Learn the rest of HSK ${candidate.level}`,
      to: `/study?hsk=${candidate.level}&mode=new`,
      tone: 'good',
      priority: 40,
    }
  },

  (ctx) =>
    ctx.dueCount === 0 && ctx.weakCount >= THRESHOLDS.weak
      ? {
          id: 'refresh-weak',
          title: 'Shore up the weak words',
          detail: `${plural(ctx.weakCount, 'word sits', 'words sit')} at Weak. Nothing is due, so this is free time well spent.`,
          cta: 'Refresh weak words',
          to: '/study?mode=refreshWeak',
          tone: 'warning',
          priority: 30,
        }
      : null,

  (ctx) =>
    ctx.dueCount === 0 && ctx.reviewedToday === 0 && ctx.newAvailable > 0
      ? {
          id: 'learn-new',
          title: 'Learn something new',
          detail: `Nothing is due and you have not studied today. ${ctx.newAvailable.toLocaleString()} words are still unseen.`,
          cta: 'Start new words',
          to: '/study?mode=new',
          tone: 'good',
          priority: 20,
        }
      : null,

  // Terminal fallback — the panel is never empty.
  (ctx) => ({
    id: 'keep-going',
    title: ctx.reviewedToday > 0 ? 'Nicely done today' : 'Keep the habit going',
    detail:
      ctx.reviewedToday > 0
        ? `${plural(ctx.reviewedToday, 'card', 'cards')} reviewed today. A few more never hurt.`
        : 'Everything is caught up. A short session keeps the schedule from bunching up.',
    cta: 'Open a session',
    to: '/study',
    tone: 'neutral',
    priority: 10,
  }),
]

/**
 * Highest-priority firing rules, at most one per destination, capped at three.
 * Always returns at least one recommendation.
 */
export function recommend(ctx: RecommendationContext, limit = 3): Recommendation[] {
  const fired = RULES.map((rule) => rule(ctx))
    .filter((r): r is Recommendation => r !== null)
    .sort((a, b) => b.priority - a.priority)

  const seen = new Set<string>()
  const picked: Recommendation[] = []
  for (const r of fired) {
    if (seen.has(r.to)) continue
    seen.add(r.to)
    picked.push(r)
    if (picked.length === limit) break
  }
  return picked
}
