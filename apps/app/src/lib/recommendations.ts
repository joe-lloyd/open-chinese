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

/**
 * What kind of activity the card sends the learner to. Used to stop three
 * variations of "go and study now" from filling every slot and crowding out
 * the one non-study action that fired.
 */
export type RecommendationCategory = 'study' | 'reading' | 'browse'

export interface Recommendation {
  id: string
  title: string
  /** One line, built from the learner's own numbers — never generic filler. */
  detail: string
  cta: string
  /** Route including params; also the de-duplication key. */
  to: string
  tone: RecommendationTone
  category: RecommendationCategory
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
  /**
   * Hour of the **UTC** day from which an unstudied day counts as a streak at
   * risk. It must be UTC, not local: `reviewedToday` and the streak are both
   * keyed off `dateKey()`, which is UTC, so a local-hour gate would let the
   * rule claim "you have not studied today" hours after a learner west of
   * Greenwich actually did. Measuring lateness in the same day the data is
   * bucketed in keeps the claim true everywhere. Revisit once day keys are
   * migrated to local dates, at which point this should become a local hour.
   */
  streakRiskHourUtc: 20,
  /** Slots any one category may take before another category gets a look in. */
  maxPerCategory: 2,
} as const

export function readerRoute(position: LastReadPosition): string {
  return `/readers/${encodeURIComponent(position.readerId)}/${encodeURIComponent(position.chapterId)}`
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

interface Rule {
  id: string
  /**
   * Ids this rule makes redundant when it fires. `'*'` suppresses every
   * lower-priority rule. Without this, a flat priority sort cannot express
   * "recommend X *instead of* Y", which two of the rules below need.
   */
  suppresses?: readonly string[]
  run: (ctx: RecommendationContext) => Recommendation | null
}

const RULES: Rule[] = [
  // Nothing studied at all. Every other card would be addressed to a learner
  // who does not exist yet, so this one stands alone.
  {
    id: 'first-steps',
    suppresses: ['*'],
    run: (ctx) =>
      ctx.studiedCount > 0
        ? null
        : {
            id: 'first-steps',
            title: 'Start with HSK 1',
            detail: 'You have not studied any words yet. Pick a level and take the first session.',
            cta: 'Choose a level',
            to: '/hsk',
            tone: 'accent',
            category: 'browse',
            priority: 100,
          },
  },

  // A backlog this size is not a normal session. Note this is a time-boxed
  // *due* session, not `mode=cram`: cram ignores `nextReviewDate` entirely and
  // returns the lowest-ease cards in the whole collection, Mastered and Leech
  // included, so it would not actually reduce a backlog. Due mode already
  // sorts by `nextReviewDate`, which is exactly the job here.
  {
    id: 'backlog-focus',
    suppresses: ['due-review'],
    run: (ctx) =>
      ctx.dueCount < THRESHOLDS.backlog
        ? null
        : {
            id: 'backlog-focus',
            title: 'Clear the backlog',
            detail: `${ctx.dueCount.toLocaleString()} cards are waiting. Fifteen focused minutes takes the most overdue first.`,
            cta: 'Study for 15 minutes',
            to: '/study?minutes=15',
            tone: 'warning',
            category: 'study',
            priority: 90,
          },
  },

  // Late in the UTC day — the day the streak is actually counted in — with a
  // live streak and nothing recorded yet.
  {
    id: 'streak-at-risk',
    run: (ctx) =>
      ctx.currentStreak >= 2 &&
      ctx.reviewedToday === 0 &&
      ctx.now.getUTCHours() >= THRESHOLDS.streakRiskHourUtc
        ? {
            id: 'streak-at-risk',
            title: 'Keep your streak alive',
            detail: `You are on a ${ctx.currentStreak}-day streak and have not studied today. Five minutes is enough.`,
            cta: 'Study for 5 minutes',
            to: '/study?minutes=5',
            tone: 'critical',
            category: 'study',
            priority: 80,
          }
        : null,
  },

  {
    id: 'due-review',
    run: (ctx) =>
      ctx.dueCount === 0
        ? null
        : {
            id: 'due-review',
            title: 'Reviews are due',
            detail: `${plural(ctx.dueCount, 'card is', 'cards are')} scheduled for today.`,
            cta: 'Start reviewing',
            to: '/study',
            tone: 'accent',
            category: 'study',
            priority: 70,
          },
  },

  {
    id: 'leeches',
    run: (ctx) =>
      ctx.leechCount < THRESHOLDS.leeches
        ? null
        : {
            id: 'leeches',
            title: 'Leeches are piling up',
            detail: `${plural(ctx.leechCount, 'word keeps', 'words keep')} slipping. A session of just these breaks the loop.`,
            cta: 'Drill the hard ones',
            to: '/study?mode=hardOnly',
            tone: 'critical',
            category: 'study',
            priority: 60,
          },
  },

  // Owned by the graded-readers feature; dormant until that ships.
  {
    id: 'continue-reading',
    run: (ctx) => {
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
        category: 'reading',
        priority: 50,
      }
    },
  },

  {
    id: 'finish-hsk-level',
    run: (ctx) => {
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
        category: 'study',
        priority: 40,
      }
    },
  },

  {
    id: 'refresh-weak',
    run: (ctx) =>
      ctx.dueCount === 0 && ctx.weakCount >= THRESHOLDS.weak
        ? {
            id: 'refresh-weak',
            title: 'Shore up the weak words',
            detail: `${plural(ctx.weakCount, 'word sits', 'words sit')} at Weak. Nothing is due, so this is free time well spent.`,
            cta: 'Refresh weak words',
            to: '/study?mode=refreshWeak',
            tone: 'warning',
            category: 'study',
            priority: 30,
          }
        : null,
  },

  {
    id: 'learn-new',
    run: (ctx) =>
      ctx.dueCount === 0 && ctx.reviewedToday === 0 && ctx.newAvailable > 0
        ? {
            id: 'learn-new',
            title: 'Learn something new',
            detail: `Nothing is due and you have not studied today. ${ctx.newAvailable.toLocaleString()} words are still unseen.`,
            cta: 'Start new words',
            to: '/study?mode=new',
            tone: 'good',
            category: 'study',
            priority: 20,
          }
        : null,
  },

]

/**
 * Used only when no rule above fires. It is deliberately not a rule: its copy
 * asserts that everything is caught up, which would contradict any other card
 * sitting beside it.
 */
function fallback(ctx: RecommendationContext): Recommendation {
  return {
    id: 'keep-going',
    title: ctx.reviewedToday > 0 ? 'Nicely done today' : 'Keep the habit going',
    detail:
      ctx.reviewedToday > 0
        ? `${plural(ctx.reviewedToday, 'card', 'cards')} reviewed today. A few more never hurt.`
        : 'Everything is caught up. A short session keeps the schedule from bunching up.',
    cta: 'Open a session',
    to: '/study',
    tone: 'neutral',
    category: 'study',
    priority: 0,
  }
}

/**
 * Highest-priority firing rules, at most one per destination, capped at
 * `limit`. Rules may suppress lower-priority ones they make redundant, and a
 * single category may not take every slot while another category is waiting —
 * otherwise three flavours of "go and study now" crowd out the one reading or
 * browsing action that fired. If the category cap leaves slots unfilled, they
 * are backfilled in priority order. When nothing fires at all, the general
 * fallback stands in, so the panel is never empty (unless `limit` is zero or
 * less).
 */
export function recommend(ctx: RecommendationContext, limit = 3): Recommendation[] {
  if (limit <= 0) return []

  const fired: { rule: Rule; rec: Recommendation }[] = []
  for (const rule of RULES) {
    const rec = rule.run(ctx)
    if (rec) fired.push({ rule, rec })
  }
  if (fired.length === 0) return [fallback(ctx)]
  fired.sort((a, b) => b.rec.priority - a.rec.priority)

  const suppressed = new Set<string>()
  let suppressAll = false
  const eligible: Recommendation[] = []
  const seen = new Set<string>()
  for (const { rule, rec } of fired) {
    if (suppressAll || suppressed.has(rec.id) || seen.has(rec.to)) continue
    seen.add(rec.to)
    eligible.push(rec)
    for (const id of rule.suppresses ?? []) {
      if (id === '*') suppressAll = true
      else suppressed.add(id)
    }
  }

  const perCategory = new Map<RecommendationCategory, number>()
  const picked: Recommendation[] = []
  for (const rec of eligible) {
    const used = perCategory.get(rec.category) ?? 0
    if (used >= THRESHOLDS.maxPerCategory) continue
    perCategory.set(rec.category, used + 1)
    picked.push(rec)
    if (picked.length >= limit) return picked
  }

  for (const rec of eligible) {
    if (picked.length >= limit) break
    if (!picked.includes(rec)) picked.push(rec)
  }
  return picked
}
