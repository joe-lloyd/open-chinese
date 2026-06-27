import { createHash } from 'node:crypto'

export type ToneResult = Array<'correct' | 'incorrect' | 'unrecognized'>

const MAX_SIZE = 500
const cache = new Map<string, ToneResult>()

function cacheKey(audioBuffer: Buffer, targetPinyin: string): string {
  const hash = createHash('sha256').update(audioBuffer).digest('hex')
  return `${hash}:${targetPinyin}`
}

export function getCached(audioBuffer: Buffer, targetPinyin: string): ToneResult | null {
  return cache.get(cacheKey(audioBuffer, targetPinyin)) ?? null
}

export function setCached(
  audioBuffer: Buffer,
  targetPinyin: string,
  result: ToneResult,
): void {
  const key = cacheKey(audioBuffer, targetPinyin)
  if (cache.size >= MAX_SIZE) {
    const firstKey = cache.keys().next().value!
    cache.delete(firstKey)
  }
  cache.set(key, result)
}
