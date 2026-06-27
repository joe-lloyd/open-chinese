import Papa from 'papaparse'

const REQUIRED_HEADERS = [
  'Simplified',
  'Traditional',
  'Pinyin',
  'Definitions',
  'List Name',
  'Status',
  'Next Review',
] as const

export type ImportStatus = 'Unstudied' | 'Weak' | 'Strong' | 'Memorized' | 'Mastered'

const STATUS_CAPS: Record<ImportStatus, { max: number; all?: number }> = {
  Unstudied: { max: 0 },
  Weak: { max: 7 },
  Strong: { max: 21 },
  Memorized: { max: 180 },
  Mastered: { all: 365 },
}

export interface ParsedRow {
  simplified: string
  traditional: string | null
  pinyin: string
  definition: string
  deckName: string
  status: ImportStatus
  intervalMeaning: number
  intervalPinyin: number
  intervalAudio: number
  easeFactor: number
}

export interface ParsedCSVResult {
  rows: ParsedRow[]
  errors: Array<{ line: number; message: string }>
  countByStatus: Record<ImportStatus, number>
}

export function parseHackChineseCSV(
  csvText: string,
  importDate = new Date(),
): ParsedCSVResult {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  const headers = result.meta.fields ?? []
  const missingHeaders = REQUIRED_HEADERS.filter((h) => !headers.includes(h))
  if (missingHeaders.length > 0) {
    throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`)
  }

  const rows: ParsedRow[] = []
  const errors: Array<{ line: number; message: string }> = []
  const countByStatus: Record<ImportStatus, number> = {
    Unstudied: 0,
    Weak: 0,
    Strong: 0,
    Memorized: 0,
    Mastered: 0,
  }

  for (let i = 0; i < result.data.length; i++) {
    const raw = result.data[i]
    const line = i + 2

    const simplified = raw['Simplified']?.trim()
    if (!simplified) {
      errors.push({ line, message: 'Missing Simplified character' })
      continue
    }

    const rawStatus = raw['Status']?.trim() as ImportStatus
    if (!Object.keys(STATUS_CAPS).includes(rawStatus)) {
      errors.push({ line, message: `Unknown status: ${rawStatus}` })
      continue
    }

    const intervals = deriveIntervals(rawStatus, raw['Next Review'], importDate)

    rows.push({
      simplified,
      traditional: raw['Traditional']?.trim() || null,
      pinyin: raw['Pinyin']?.trim() ?? '',
      definition: raw['Definitions']?.trim() ?? '',
      deckName: raw['List Name']?.trim() || 'Default',
      status: rawStatus,
      ...intervals,
      easeFactor: 2.5,
    })

    countByStatus[rawStatus]++
  }

  return { rows, errors, countByStatus }
}

function deriveIntervals(
  status: ImportStatus,
  nextReviewRaw: string,
  importDate: Date,
): { intervalMeaning: number; intervalPinyin: number; intervalAudio: number } {
  if (status === 'Unstudied') {
    return { intervalMeaning: 0, intervalPinyin: 0, intervalAudio: 0 }
  }

  if (status === 'Mastered') {
    return { intervalMeaning: 365, intervalPinyin: 365, intervalAudio: 365 }
  }

  const cap = STATUS_CAPS[status].max!
  let interval = 1

  if (nextReviewRaw) {
    const nextReview = new Date(nextReviewRaw)
    if (!isNaN(nextReview.getTime())) {
      const diffDays = (nextReview.getTime() - importDate.getTime()) / 86_400_000
      interval = Math.max(1, Math.min(cap, diffDays))
    }
  }

  return {
    intervalMeaning: interval,
    intervalPinyin: interval,
    intervalAudio: interval,
  }
}
