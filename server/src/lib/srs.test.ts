import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateNewInterval,
  adjustEaseFactor,
  deriveStatus,
  updateLeechState,
  checkMastery,
  selectSubskill,
  applyResponse,
} from './srs.ts'

describe('calculateNewInterval', () => {
  it('Again resets to 1', () => {
    assert.equal(calculateNewInterval(10, 'Again', 2.5), 1)
  })
  it('Hard: current * 1.2 * ease', () => {
    assert.equal(calculateNewInterval(4, 'Hard', 2.5), 4 * 1.2 * 2.5)
  })
  it('Good: current * 2.5 * ease', () => {
    assert.equal(calculateNewInterval(4, 'Good', 2.5), 4 * 2.5 * 2.5)
  })
  it('Easy: current * 3.5 * ease', () => {
    assert.equal(calculateNewInterval(4, 'Easy', 2.5), 4 * 3.5 * 2.5)
  })
  it('zero interval gets minimum 1 on Good', () => {
    assert.equal(calculateNewInterval(0, 'Good', 2.5), 1)
  })
})

describe('adjustEaseFactor', () => {
  it('Hard reduces by 0.15', () => {
    assert.equal(adjustEaseFactor(2.5, 'Hard'), 2.35)
  })
  it('Easy increases by 0.15', () => {
    assert.equal(adjustEaseFactor(2.5, 'Easy'), 2.65)
  })
  it('Good leaves unchanged', () => {
    assert.equal(adjustEaseFactor(2.5, 'Good'), 2.5)
  })
  it('floor at 1.3 on Hard', () => {
    assert.equal(adjustEaseFactor(1.3, 'Hard'), 1.3)
  })
  it('below floor clamped to 1.3', () => {
    assert.equal(adjustEaseFactor(1.4, 'Hard'), 1.3)
  })
})

describe('deriveStatus', () => {
  it('all zero = Unstudied', () => {
    assert.equal(deriveStatus(0, 0, 0), 'Unstudied')
  })
  it('max <= 7 = Weak', () => {
    assert.equal(deriveStatus(3, 5, 7), 'Weak')
  })
  it('max > 7 <= 21 = Strong', () => {
    assert.equal(deriveStatus(2, 14, 7), 'Strong')
  })
  it('max > 21 < 180 = Memorized', () => {
    assert.equal(deriveStatus(30, 25, 10), 'Memorized')
  })
  it('all > 180 = Mastered', () => {
    assert.equal(deriveStatus(181, 200, 365), 'Mastered')
  })
})

describe('updateLeechState', () => {
  it('Again increments consecutiveFails', () => {
    const result = updateLeechState(3, 'Again')
    assert.equal(result.consecutiveFails, 4)
    assert.equal(result.isLeech, false)
  })
  it('Again beyond 8 marks leech', () => {
    const result = updateLeechState(8, 'Again')
    assert.equal(result.isLeech, true)
  })
  it('Good resets consecutiveFails', () => {
    const result = updateLeechState(7, 'Good')
    assert.equal(result.consecutiveFails, 0)
    assert.equal(result.isLeech, false)
  })
  it('Easy resets consecutiveFails', () => {
    assert.equal(updateLeechState(5, 'Easy').consecutiveFails, 0)
  })
})

describe('checkMastery', () => {
  it('all > 180 = true', () => {
    assert.equal(checkMastery(181, 200, 365), true)
  })
  it('one <= 180 = false', () => {
    assert.equal(checkMastery(181, 179, 365), false)
  })
})

describe('selectSubskill', () => {
  it('returns subskill with lowest interval', () => {
    const review = {
      intervalMeaning: 10,
      intervalPinyin: 2,
      intervalAudio: 5,
      easeFactor: 2.5,
      consecutiveFails: 0,
      nextReviewDate: new Date(),
      lastSubskill: null,
    }
    assert.equal(selectSubskill(review), 'pinyin')
  })
})
