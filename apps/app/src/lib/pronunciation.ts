import type { Word } from './worddb'

/**
 * Word-identity assessment of a recognition result.
 *
 * This module is deliberately pure and dependency-free: it imports no scheduling
 * (`srs.ts`) and no persistence (`firestore.ts`), because the verdict it produces
 * is advisory and must never reach either.
 *
 * It establishes only WHICH WORD the recognizer heard. It does not, and cannot,
 * check tones — `SpeechRecognition` at `lang='zh-CN'` returns Han characters
 * only, and a Mandarin recognizer's language model silently repairs tone errors.
 */

export type Verdict = 'match' | 'near-match' | 'homophone' | 'mismatch' | 'unrecognized'

export interface Assessment {
  verdict: Verdict
  heard: string | null
}

/**
 * U+0300..U+036F, the combining diacritical marks block — what pinyin tone marks
 * decompose into under NFD. The two range endpoints are invisible in source; do
 * not "tidy" them away.
 */
const COMBINING_MARKS = /[̀-ͯ]/g

/**
 * `mǎi` and `mài` both reduce to `mai`; `lǜ` reduces to `lu`, because `ü`
 * decomposes to `u` plus a combining diaeresis that falls in the same block.
 */
export function toTonelessPinyin(pinyin: string): string {
  return pinyin
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/[\s\d]/g, '')
}

/**
 * `targetPinyin` is optional so the three-argument form still works, but callers
 * should pass the study card's own `pinyin` field: that is the authoritative
 * reading for the card, whereas `lookup(target)` merely re-derives it.
 */
export function assess(
  alternatives: string[],
  target: string,
  lookup: (s: string) => Word | null,
  targetPinyin?: string
): Assessment {
  const heard = alternatives[0] ?? null

  if (alternatives.length === 0) return { verdict: 'unrecognized', heard }
  if (alternatives[0] === target) return { verdict: 'match', heard }
  if (alternatives.includes(target)) return { verdict: 'near-match', heard }

  // Toneless on purpose. The pinyin below is read from the dictionary row of
  // whichever character the recognizer picked, so its tone marks describe that
  // dictionary word, not the learner's utterance. Comparing them would
  // manufacture a tone verdict out of data that never touched the audio.
  const targetToneless = toTonelessPinyin(targetPinyin ?? lookup(target)?.pinyin ?? '')
  if (targetToneless) {
    for (const alt of alternatives) {
      const altPinyin = lookup(alt)?.pinyin
      if (altPinyin && toTonelessPinyin(altPinyin) === targetToneless) {
        return { verdict: 'homophone', heard }
      }
    }
  }

  return { verdict: 'mismatch', heard }
}
