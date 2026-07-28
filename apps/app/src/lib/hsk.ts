/** HSK 3.0 vocabulary bands. The standard groups advanced levels 7–9. */
export const HSK_LEVELS = [1, 2, 3, 4, 5, 6, 7] as const

export function hskLevelName(level: number): string {
  return level === 7 ? '7–9' : String(level)
}

export function hskLabel(level: number): string {
  return `HSK ${hskLevelName(level)}`
}
