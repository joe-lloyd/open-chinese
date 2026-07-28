/**
 * Pure derivations for the dashboard. Every function here folds over data the
 * dashboard has already fetched — no I/O, no clock, no Firestore. `now` is
 * always passed in so the results are reproducible.
 */

export interface DayStat {
  date: string
  totalReviewed: number
  correctCount: number
  newCardsSeen?: number
}

export interface SchedulableWord {
  status: string
  nextReviewDate: Date
  analytics: {
    correctMeaningCount: number
    incorrectMeaningCount: number
    correctPronCount: number
    incorrectPronCount: number
  }
}

/** Statuses that never appear in a due queue. */
const NOT_SCHEDULED = new Set(['Mastered', 'Leech', 'Unstudied'])

export function isScheduled(word: { status: string }): boolean {
  return !NOT_SCHEDULED.has(word.status)
}

/**
 * Day keys match how `upsertDailyStats` writes them — `toISOString`, i.e. UTC.
 * All stepping below happens in UTC key space rather than by mutating a local
 * `Date`, so a DST transition cannot make two calendar days collapse onto one
 * key or skip one.
 */
export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function shiftKey(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** `MM-DD` — the short form used on time axes. */
function axisLabel(key: string): string {
  return key.slice(5)
}

// ── Streaks ─────────────────────────────────────────────────────────────────

export interface Streak {
  current: number
  longest: number
}

/**
 * A day counts when it recorded at least one review. The current streak walks
 * backwards from today, and falls back to starting at yesterday when today has
 * no reviews yet — otherwise the number reads 0 every morning, which is exactly
 * when it should be motivating. It only breaks once a whole day is skipped.
 */
export function computeStreak(days: DayStat[], now: Date): Streak {
  const studied = new Set(days.filter((d) => d.totalReviewed > 0).map((d) => d.date))
  if (studied.size === 0) return { current: 0, longest: 0 }

  const todayKey = dateKey(now)
  let current = 0
  let cursor = studied.has(todayKey) ? todayKey : shiftKey(todayKey, -1)
  while (studied.has(cursor)) {
    current++
    cursor = shiftKey(cursor, -1)
  }

  const sorted = [...studied].sort()
  let longest = 0
  let run = 0
  let previous: string | null = null
  for (const day of sorted) {
    run = previous != null && shiftKey(previous, 1) === day ? run + 1 : 1
    longest = Math.max(longest, run)
    previous = day
  }

  return { current, longest }
}

// ── Activity totals ─────────────────────────────────────────────────────────

export interface ActivityTotals {
  reviewedToday: number
  reviewedThisWeek: number
  newThisWeek: number
}

export function computeActivityTotals(days: DayStat[], now: Date): ActivityTotals {
  const todayKey = dateKey(now)
  const weekCutoff = shiftKey(todayKey, -6)

  let reviewedToday = 0
  let reviewedThisWeek = 0
  let newThisWeek = 0
  for (const d of days) {
    if (d.date === todayKey) reviewedToday += d.totalReviewed
    if (d.date >= weekCutoff) {
      reviewedThisWeek += d.totalReviewed
      newThisWeek += d.newCardsSeen ?? 0
    }
  }
  return { reviewedToday, reviewedThisWeek, newThisWeek }
}

// ── Review workload forecast ────────────────────────────────────────────────

export interface ForecastBucket {
  date: string
  /** Short axis label; the first bucket is always "Today". */
  label: string
  count: number
  /** True only on the first bucket, and only when it absorbed overdue cards. */
  overdue: boolean
}

/**
 * Scheduled reviews per day for the next `days` days. Anything already overdue
 * folds into the first bucket rather than disappearing — it is work the learner
 * has to do today either way — and that bucket is flagged so it can be drawn
 * as a warning rather than as routine workload.
 */
export function computeForecast(words: SchedulableWord[], now: Date, days = 14): ForecastBucket[] {
  const todayKey = dateKey(now)
  const buckets: ForecastBucket[] = []
  for (let i = 0; i < days; i++) {
    const key = shiftKey(todayKey, i)
    buckets.push({
      date: key,
      label: i === 0 ? 'Today' : axisLabel(key),
      count: 0,
      overdue: false,
    })
  }
  const index = new Map(buckets.map((b, i) => [b.date, i]))
  const lastKey = buckets[buckets.length - 1].date

  for (const w of words) {
    if (!isScheduled(w)) continue
    const key = dateKey(w.nextReviewDate)
    if (key > lastKey) continue
    if (key < todayKey) {
      buckets[0].count++
      buckets[0].overdue = true
      continue
    }
    const i = index.get(key)
    if (i != null) buckets[i].count++
  }

  return buckets
}

// ── Pronunciation vs meaning accuracy ───────────────────────────────────────

export interface SkillSplitData {
  pronunciation: { correct: number; total: number; pct: number }
  meaning: { correct: number; total: number; pct: number }
}

/** Returns null when nothing has been graded yet, so callers show an empty state. */
export function computeSkillSplit(words: SchedulableWord[]): SkillSplitData | null {
  let pronCorrect = 0
  let pronTotal = 0
  let meaningCorrect = 0
  let meaningTotal = 0

  for (const { analytics: a } of words) {
    pronCorrect += a.correctPronCount
    pronTotal += a.correctPronCount + a.incorrectPronCount
    meaningCorrect += a.correctMeaningCount
    meaningTotal += a.correctMeaningCount + a.incorrectMeaningCount
  }

  if (pronTotal === 0 && meaningTotal === 0) return null

  return {
    pronunciation: {
      correct: pronCorrect,
      total: pronTotal,
      pct: pronTotal > 0 ? Math.round((pronCorrect / pronTotal) * 100) : 0,
    },
    meaning: {
      correct: meaningCorrect,
      total: meaningTotal,
      pct: meaningTotal > 0 ? Math.round((meaningCorrect / meaningTotal) * 100) : 0,
    },
  }
}

// ── HSK progress ────────────────────────────────────────────────────────────

export interface HskLevelProgress {
  level: number
  studied: number
  total: number
  pct: number
}

export function computeHskProgress(
  allWords: { simplified: string; hsk_level: number }[],
  studiedSimplifieds: Set<string>
): HskLevelProgress[] {
  const totals = new Map<number, { studied: number; total: number }>()
  for (const w of allWords) {
    if (w.hsk_level == null) continue
    const entry = totals.get(w.hsk_level) ?? { studied: 0, total: 0 }
    entry.total++
    if (studiedSimplifieds.has(w.simplified)) entry.studied++
    totals.set(w.hsk_level, entry)
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a - b)
    .map(([level, { studied, total }]) => ({
      level,
      studied,
      total,
      pct: total > 0 ? Math.round((studied / total) * 100) : 0,
    }))
}

// ── Learning velocity ───────────────────────────────────────────────────────

export interface VelocityWeek {
  /** ISO date of the week's first day. */
  weekStart: string
  label: string
  newWords: number
}

/**
 * New words seen per week over the last `weeks` weeks. Weeks with no data are
 * zero-filled so the time axis stays continuous rather than compressing gaps.
 */
export function computeVelocity(days: DayStat[], now: Date, weeks = 12): VelocityWeek[] {
  const todayKey = dateKey(now)
  const buckets: VelocityWeek[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const start = shiftKey(todayKey, -(i * 7 + 6))
    buckets.push({ weekStart: start, label: axisLabel(start), newWords: 0 })
  }
  const oldest = buckets[0].weekStart

  for (const d of days) {
    if (d.date < oldest) continue
    const seen = d.newCardsSeen ?? 0
    if (seen === 0) continue
    // Buckets are contiguous 7-day spans, so the last one starting on or
    // before this date owns it.
    for (let i = buckets.length - 1; i >= 0; i--) {
      if (d.date >= buckets[i].weekStart) {
        buckets[i].newWords += seen
        break
      }
    }
  }

  return buckets
}
