/**
 * Collapses a pinyin string to a comparable key: no tones, no case, no separators.
 *
 * The build script writes `words.pinyin_normalized` with this function and the
 * client normalizes the search query with it, so `pengyou`, `peng you`,
 * `peng'you` and `peng2you5` all reduce to the same key as the tone-marked form.
 *
 * Shared by `scripts/build-words-db.ts` and `client/src/lib/worddb.ts` — it must
 * stay dependency-free so the build script can import it directly.
 */
const COMBINING_MARKS = /[̀-ͯ]/g
const SEPARATORS = /[\s'’·:-]/g

export function normalizePinyin(value: string): string {
  return value
    .normalize('NFD')
    // NFD is recursive, so u-umlaut-with-grave decomposes to u + diaeresis +
    // grave; stripping the combining block removes tone marks and the umlaut
    // in a single pass.
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/v/g, 'u')
    // 0 as well as 1-5: the neutral tone is written either way (`you5`, `you0`).
    .replace(/[0-5]/g, '')
    .replace(SEPARATORS, '')
}
