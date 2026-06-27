import type { ToneResult } from './whisper-cache.ts'

const DIACRITIC_MAP: Record<string, string> = {
  āáǎà: '1234',
  ēéěè: '1234',
  īíǐì: '1234',
  ōóǒò: '1234',
  ūúǔù: '1234',
  ǖǘǚǜ: '1234',
}

function normalizePinyinSyllable(syllable: string): { base: string; tone: string } {
  let tone = '5'
  let base = syllable.toLowerCase()

  for (const [chars, tones] of Object.entries(DIACRITIC_MAP)) {
    for (let i = 0; i < chars.length; i++) {
      if (base.includes(chars[i])) {
        tone = tones[i]
        base = base.replace(chars[i], getBaseVowel(chars[i]))
        break
      }
    }
  }

  // Handle explicit tone numbers (e.g. "peng2")
  const numMatch = base.match(/([a-z]+)([1-5])$/)
  if (numMatch) {
    base = numMatch[1]
    tone = numMatch[2]
  }

  return { base: base.replace(/\s/g, ''), tone }
}

function getBaseVowel(char: string): string {
  const map: Record<string, string> = {
    āáǎà: 'a',
    ēéěè: 'e',
    īíǐì: 'i',
    ōóǒò: 'o',
    ūúǔù: 'u',
    ǖǘǚǜ: 'u',
  }
  for (const [chars, base] of Object.entries(map)) {
    if (chars.includes(char)) return base
  }
  return char
}

function tokenizePinyin(pinyin: string): string[] {
  return pinyin
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

export function comparePinyin(transcribed: string, target: string): ToneResult {
  const transcribedTokens = tokenizePinyin(transcribed)
  const targetTokens = tokenizePinyin(target)

  return targetTokens.map((targetToken, i) => {
    const transcribedToken = transcribedTokens[i]
    if (!transcribedToken) return 'unrecognized'

    const t = normalizePinyinSyllable(targetToken)
    const r = normalizePinyinSyllable(transcribedToken)

    if (r.base === '' || r.tone === '') return 'unrecognized'
    if (t.base === r.base && t.tone === r.tone) return 'correct'
    return 'incorrect'
  })
}
