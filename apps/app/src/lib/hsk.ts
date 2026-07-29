/**
 * Nine learner-facing stages. GF0025-2021 supplies one official advanced
 * vocabulary band for levels 7–9; OpenChinese divides it into three documented
 * editorial stages so progress remains manageable.
 */
export const HSK_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

const HSK_STAGE_NAMES: Record<number, string> = {
  1: 'Beginner',
  2: 'Elementary',
  3: 'Pre-Intermediate',
  4: 'Intermediate',
  5: 'Upper-Intermediate',
  6: 'Advanced',
  7: 'Advanced I',
  8: 'Advanced II',
  9: 'Mastery',
}

export function hskLevelName(level: number): string {
  return String(level)
}

export function hskLabel(level: number): string {
  return `HSK ${hskLevelName(level)}`
}

export function hskStageName(level: number): string {
  return HSK_STAGE_NAMES[level] ?? 'Chinese'
}
