export type Subskill = 'meaning' | 'pinyin' | 'audio'
export type Response = 'Again' | 'Hard' | 'Good' | 'Easy'
export type WordStatus = 'Unstudied' | 'Weak' | 'Strong' | 'Memorized' | 'Mastered' | 'Leech'

export interface ReviewState {
  intervalMeaning: number
  intervalPinyin: number
  intervalAudio: number
  easeFactor: number
  consecutiveFails: number
  nextReviewDate: Date
  lastSubskill: Subskill | null
}

const MULTIPLIERS: Record<Response, number | null> = {
  Again: null,
  Hard: 1.2,
  Good: 2.5,
  Easy: 3.5,
}

const EASE_DELTA: Record<Response, number> = {
  Again: 0,
  Hard: -0.15,
  Good: 0,
  Easy: 0.15,
}

const MIN_EASE = 1.3
const LEECH_THRESHOLD = 8
export const MASTERY_THRESHOLD = 180
const MIN_INTERVAL = 1
const MS_PER_DAY = 86400000

export function calculateNewInterval(current: number, response: Response, easeFactor: number): number {
  if (response === 'Again') return MIN_INTERVAL
  // Graduated initial learning steps — avoid jumping to 6+ days on first review
  if (response === 'Good') {
    if (current === 0) return 1
    if (current < 2) return 4
    if (current < 5) return 10
  }
  const multiplier = MULTIPLIERS[response]!
  return Math.max(MIN_INTERVAL, (current || 1) * multiplier * easeFactor)
}

export function adjustEaseFactor(current: number, response: Response): number {
  const delta = EASE_DELTA[response]
  return Math.max(MIN_EASE, current + delta)
}

export function deriveStatus(intervalMeaning: number, intervalPinyin: number, _intervalAudio: number): WordStatus {
  const min = Math.min(intervalMeaning, intervalPinyin)
  if (min === 0) return 'Unstudied'
  if (min <= 7) return 'Weak'
  if (min <= 21) return 'Strong'
  if (checkMastery(intervalMeaning, intervalPinyin, _intervalAudio)) return 'Mastered'
  return 'Memorized'
}

/**
 * Single authoritative status resolver: leech state takes precedence over the
 * interval-derived bucket. `deriveStatus` stays a pure function of intervals.
 */
export function resolveStatus(
  intervalMeaning: number,
  intervalPinyin: number,
  intervalAudio: number,
  consecutiveFails: number,
): WordStatus {
  if (consecutiveFails > LEECH_THRESHOLD) return 'Leech'
  return deriveStatus(intervalMeaning, intervalPinyin, intervalAudio)
}

export function updateLeechState(consecutiveFails: number, response: Response): { consecutiveFails: number; isLeech: boolean } {
  if (response === 'Again') {
    const next = consecutiveFails + 1
    return { consecutiveFails: next, isLeech: next > LEECH_THRESHOLD }
  }
  return { consecutiveFails: 0, isLeech: false }
}

export function checkMastery(intervalMeaning: number, intervalPinyin: number, _intervalAudio: number): boolean {
  return intervalMeaning > MASTERY_THRESHOLD && intervalPinyin > MASTERY_THRESHOLD
}

export function applyBinaryReview(
  review: ReviewState,
  knewPronunciation: boolean,
  knewMeaning: boolean,
): ReviewState & { response: Response; isLeech: boolean } {
  const pronResponse: Response = knewPronunciation ? 'Good' : 'Again'
  const meaningResponse: Response = knewMeaning ? 'Good' : 'Again'

  const newEase =
    !knewPronunciation && !knewMeaning
      ? adjustEaseFactor(review.easeFactor, 'Hard')
      : review.easeFactor

  const newIntervalPinyin = calculateNewInterval(review.intervalPinyin, pronResponse, newEase)
  const newIntervalMeaning = calculateNewInterval(review.intervalMeaning, meaningResponse, newEase)

  const { consecutiveFails, isLeech } =
    knewPronunciation || knewMeaning
      ? { consecutiveFails: 0, isLeech: false }
      : updateLeechState(review.consecutiveFails, 'Again')

  const daysUntilNext = Math.min(newIntervalMeaning, newIntervalPinyin)
  // Millisecond arithmetic keeps the fractional part of a float day interval —
  // Date.prototype.setDate would truncate 6.25 days to 6.
  const nextReviewDate = new Date(Date.now() + daysUntilNext * MS_PER_DAY)

  const derived: Response =
    knewPronunciation && knewMeaning ? 'Good' : !knewPronunciation && !knewMeaning ? 'Again' : 'Hard'

  return {
    ...review,
    intervalPinyin: newIntervalPinyin,
    intervalMeaning: newIntervalMeaning,
    easeFactor: newEase,
    consecutiveFails,
    nextReviewDate,
    lastSubskill: 'meaning',
    response: derived,
    isLeech,
  }
}
