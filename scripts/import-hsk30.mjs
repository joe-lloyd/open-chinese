import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = resolve(root, 'packages/build-tools')

const COMPLETE_HSK_COMMIT = '7ac65bf1a6387d35f1ade478906172a19311c7f9'
const HSK30_COMMIT = '4ff9e3915ce87baaecd7ebe263085573a4ea3192'
const COMPLETE_HSK_BASE =
  `https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/${COMPLETE_HSK_COMMIT}`
const HSK30_BASE = `https://raw.githubusercontent.com/ivankra/hsk30/${HSK30_COMMIT}`

const LEVELS = [1, 2, 3, 4, 5, 6, 7]
const EXPECTED_COUNTS = new Map([
  [1, 506],
  [2, 750],
  [3, 953],
  [4, 972],
  [5, 1059],
  [6, 1123],
  [7, 5606],
])
const EXPECTED_TOTAL = 10969
const DEFINITION_OVERRIDES = new Map([
  ['纪录', 'record; chronicle; to record (Taiwan usage)'],
  ['纯朴', 'simple and honest; unsophisticated'],
  ['得意扬扬', 'triumphant; immensely pleased with oneself'],
  ['火暴', 'fiery; hot-tempered; booming'],
  ['做证', 'to testify; to bear witness'],
])

function parseCsv(source) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''))
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }

  const [headers, ...values] = rows
  return values
    .filter((value) => value.some(Boolean))
    .map((value) => Object.fromEntries(headers.map((header, index) => [header, value[index] ?? ''])))
}

function compactPinyin(value) {
  return value
    .normalize('NFC')
    .replace(/[\s'’·|-]/g, '')
    .replace(/u:/gi, 'ü')
    .toLocaleLowerCase()
}

function officialEntries(csv) {
  const entries = new Map()

  for (const row of parseCsv(csv)) {
    const level = row.Level === '7-9' ? 7 : Number(row.Level)
    if (!LEVELS.includes(level)) continue

    if (row.Variants) {
      for (const variant of JSON.parse(row.Variants)) {
        if (!entries.has(variant.Simplified)) {
          entries.set(variant.Simplified, {
            pinyin: variant.Pinyin,
            traditional: variant.Traditional,
            level,
          })
        }
      }
      continue
    }

    const simplified = row.Simplified.split('|')
    const traditional = row.Traditional.split('|')
    const pinyin = row.Pinyin.split('|')
    simplified.forEach((word, index) => {
      if (!entries.has(word)) {
        entries.set(word, {
          pinyin: pinyin[index] ?? pinyin[0],
          traditional: traditional[index] ?? traditional[0],
          level,
        })
      }
    })
  }

  return entries
}

function isSecondarySense(form) {
  const meanings = form.meanings.join(' ')
  return /^(?:surname\b|variant of\b)/i.test(meanings)
}

function usefulForm(forms, officialPinyin, officialTraditional) {
  const readingMatches = forms.filter(
    (form) => compactPinyin(form.transcriptions.pinyin) === compactPinyin(officialPinyin)
  )
  const traditionalMatches = readingMatches.filter(
    (form) => !officialTraditional || form.traditional === officialTraditional
  )
  const candidates = traditionalMatches.length > 0
    ? traditionalMatches
    : readingMatches.length > 0
      ? readingMatches
      : forms

  const primary = candidates.find((form) => {
    const pinyin = form.transcriptions.pinyin
    return pinyin[0] === pinyin[0]?.toLocaleLowerCase() && !isSecondarySense(form)
  })
  return primary ?? candidates.find((form) => !isSecondarySense(form)) ?? candidates.at(-1)
}

function cleanDefinition(meanings) {
  const unique = [...new Set(meanings.filter((meaning) => !/^CL:/i.test(meaning)))]
  return unique
    .sort((left, right) => {
      const leftSecondary = /^(?:surname\b|variant of\b)/i.test(left) ? 1 : 0
      const rightSecondary = /^(?:surname\b|variant of\b)/i.test(right) ? 1 : 0
      return leftSecondary - rightSecondary
    })
    .join('; ')
    .replace(/\s+/g, ' ')
    .trim()
}

function definitionFor(forms, officialPinyin) {
  const readingMatches = forms.filter(
    (form) => compactPinyin(form.transcriptions.pinyin) === compactPinyin(officialPinyin)
  )
  const candidates = readingMatches.length > 0 ? readingMatches : forms
  return cleanDefinition(candidates.flatMap((form) => form.meanings))
}

async function fetchText(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not fetch ${url}: ${response.status}`)
  return response.text()
}

async function existingWords() {
  const words = new Map()
  for (const level of LEVELS) {
    const path = resolve(outputDir, `hsk${level}.json`)
    const entries = JSON.parse(await readFile(path, 'utf8'))
    for (const entry of entries) words.set(entry.simplified, entry)
  }
  return words
}

const [officialCsv, legacy, ...sourceLists] = await Promise.all([
  fetchText(`${HSK30_BASE}/hsk30.csv`),
  existingWords(),
  ...LEVELS.map((level) =>
    fetchText(`${COMPLETE_HSK_BASE}/wordlists/exclusive/new/${level}.json`).then(JSON.parse)
  ),
])

const official = officialEntries(officialCsv)
const seen = new Set()
const byLevel = new Map(LEVELS.map((level) => [level, []]))

for (const [sourceIndex, sourceWords] of sourceLists.entries()) {
  const sourceLevel = LEVELS[sourceIndex]
  const expected = EXPECTED_COUNTS.get(sourceLevel)
  if (sourceWords.length !== expected) {
    throw new Error(
      `HSK ${sourceLevel} source count changed: expected ${expected}, received ${sourceWords.length}`
    )
  }

  for (const source of sourceWords) {
    if (seen.has(source.simplified)) continue
    seen.add(source.simplified)

    const standard = official.get(source.simplified)
    const level = standard?.level ?? sourceLevel
    const form = usefulForm(
      source.forms,
      standard?.pinyin ?? '',
      standard?.traditional ?? source.simplified
    )
    const previous = legacy.get(source.simplified)
    const curated = previous?.sentenceZh && previous?.sentenceEn ? previous : null
    const definition =
      curated?.definition ||
      DEFINITION_OVERRIDES.get(source.simplified) ||
      definitionFor(source.forms, standard?.pinyin ?? form.transcriptions.pinyin)
    if (!definition) throw new Error(`No definition for ${source.simplified}`)
    if (/^surname\b/i.test(definition) && source.simplified !== '姓名') {
      throw new Error(`Surname sense selected as the primary definition for ${source.simplified}`)
    }
    if (/^variant of\b/i.test(definition)) {
      throw new Error(`Variant-only primary definition selected for ${source.simplified}`)
    }

    const entry = {
      simplified: source.simplified,
      traditional:
        curated?.traditional ??
        ((standard?.traditional || form.traditional) === source.simplified
          ? null
          : standard?.traditional || form.traditional),
      pinyin: curated?.pinyin || standard?.pinyin || form.transcriptions.pinyin,
      definition,
      hskLevel: level,
    }

    if (previous?.sentenceZh && previous?.sentenceEn) {
      entry.sentenceZh = previous.sentenceZh
      entry.sentenceEn = previous.sentenceEn
      if (previous.sentencePinyin) entry.sentencePinyin = previous.sentencePinyin
    }

    byLevel.get(level).push(entry)
  }
}

if (seen.size !== EXPECTED_TOTAL) {
  throw new Error(`HSK total changed: expected ${EXPECTED_TOTAL}, received ${seen.size}`)
}

for (const level of LEVELS) {
  const entries = byLevel.get(level).sort((left, right) =>
    left.simplified.localeCompare(right.simplified, 'zh-CN')
  )
  await writeFile(
    resolve(outputDir, `hsk${level}.json`),
    `${JSON.stringify(entries, null, 2)}\n`,
    'utf8'
  )
  console.log(`HSK ${level === 7 ? '7–9' : level}: ${entries.length} words`)
}

console.log(`Imported ${seen.size} unique HSK 3.0 vocabulary entries.`)
