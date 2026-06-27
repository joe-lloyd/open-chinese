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
const MASTERY_THRESHOLD = 180
const MIN_INTERVAL = 1

export function selectSubskill(review: ReviewState): Subskill {
  const now = review.nextReviewDate.getTime()
  const scores: [Subskill, number][] = [
    ['meaning', review.intervalMeaning],
    ['pinyin', review.intervalPinyin],
    ['audio', review.intervalAudio],
  ]
  scores.sort((a, b) => a[1] - b[1])
  return scores[0][0]
}

export function calculateNewInterval(
  current: number,
  response: Response,
  easeFactor: number,
): number {
  if (response === 'Again') return MIN_INTERVAL
  const multiplier = MULTIPLIERS[response]!
  const effectiveCurrent = current === 0 ? 1 : current
  return Math.max(MIN_INTERVAL, effectiveCurrent * multiplier * easeFactor)
}

export function adjustEaseFactor(current: number, response: Response): number {
  const delta = EASE_DELTA[response]
  return Math.max(MIN_EASE, current + delta)
}

export function deriveStatus(
  intervalMeaning: number,
  intervalPinyin: number,
  _intervalAudio: number,
): WordStatus {
  const min = Math.min(intervalMeaning, intervalPinyin)
  if (min === 0) return 'Unstudied'
  if (min <= 7) return 'Weak'
  if (min <= 21) return 'Strong'
  if (min <= MASTERY_THRESHOLD) return 'Memorized'
  return 'Mastered'
}

export function updateLeechState(
  consecutiveFails: number,
  response: Response,
): { consecutiveFails: number; isLeech: boolean } {
  if (response === 'Again') {
    const next = consecutiveFails + 1
    return { consecutiveFails: next, isLeech: next > LEECH_THRESHOLD }
  }
  return { consecutiveFails: 0, isLeech: false }
}

export function checkMastery(
  intervalMeaning: number,
  intervalPinyin: number,
  _intervalAudio: number,
): boolean {
  return intervalMeaning > MASTERY_THRESHOLD && intervalPinyin > MASTERY_THRESHOLD
}

export function applyBinaryReview(
  review: ReviewState,
  knewPronunciation: boolean,
  knewMeaning: boolean,
): ReviewState & { response: Response } {
  const pronResponse: Response = knewPronunciation ? 'Good' : 'Again'
  const meaningResponse: Response = knewMeaning ? 'Good' : 'Again'

  const newEase =
    !knewPronunciation && !knewMeaning
      ? adjustEaseFactor(review.easeFactor, 'Hard')
      : review.easeFactor

  const newIntervalPinyin = calculateNewInterval(review.intervalPinyin, pronResponse, newEase)
  const newIntervalMeaning = calculateNewInterval(review.intervalMeaning, meaningResponse, newEase)

  const { consecutiveFails, isLeech } = knewPronunciation || knewMeaning
    ? { consecutiveFails: 0, isLeech: false }
    : updateLeechState(review.consecutiveFails, 'Again')

  const daysUntilNext = Math.min(newIntervalMeaning, newIntervalPinyin)
  const nextReviewDate = new Date()
  nextReviewDate.setDate(nextReviewDate.getDate() + daysUntilNext)

  const derived: Response =
    knewPronunciation && knewMeaning ? 'Good' : !knewPronunciation && !knewMeaning ? 'Again' : 'Hard'

  return {
    ...review,
    intervalPinyin: newIntervalPinyin,
    intervalMeaning: newIntervalMeaning,
    easeFactor: newEase,
    consecutiveFails: isLeech ? review.consecutiveFails + 1 : consecutiveFails,
    nextReviewDate,
    lastSubskill: 'meaning',
    response: derived,
  }
}

export function applyResponse(
  review: ReviewState,
  subskill: Subskill,
  response: Response,
): ReviewState {
  const intervalKey = `interval${subskill.charAt(0).toUpperCase() + subskill.slice(1)}` as
    | 'intervalMeaning'
    | 'intervalPinyin'
    | 'intervalAudio'

  const currentInterval = review[intervalKey]
  const newEase = adjustEaseFactor(review.easeFactor, response)
  const newInterval = calculateNewInterval(currentInterval, response, newEase)
  const { consecutiveFails, isLeech } = updateLeechState(review.consecutiveFails, response)

  const nextReviewDate = new Date()
  nextReviewDate.setDate(nextReviewDate.getDate() + newInterval)

  return {
    ...review,
    [intervalKey]: newInterval,
    easeFactor: newEase,
    consecutiveFails: isLeech ? review.consecutiveFails : consecutiveFails,
    nextReviewDate,
    lastSubskill: subskill,
  }
}
