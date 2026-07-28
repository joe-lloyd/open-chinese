import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = resolve(root, 'packages/build-tools')

const COMPLETE_HSK_BASE =
  'https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main'
const HSK30_BASE = 'https://raw.githubusercontent.com/ivankra/hsk30/master'

const LEVELS = [1, 2, 3, 4, 5, 6, 7]

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

function usefulForm(forms, officialPinyin) {
  const exact = forms.find(
    (form) => compactPinyin(form.transcriptions.pinyin) === compactPinyin(officialPinyin)
  )
  if (exact) return exact

  const notSurnameOrVariant = forms.find((form) => {
    const pinyin = form.transcriptions.pinyin
    const meanings = form.meanings.join(' ')
    return pinyin[0] === pinyin[0]?.toLocaleLowerCase() && !/^variant of\b/i.test(meanings)
  })
  return notSurnameOrVariant ?? forms.at(-1)
}

function cleanDefinition(meanings) {
  return meanings
    .filter((meaning) => !/^CL:/i.test(meaning))
    .join('; ')
    .replace(/\s+/g, ' ')
    .trim()
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
  for (const source of sourceWords) {
    if (seen.has(source.simplified)) continue
    seen.add(source.simplified)

    const standard = official.get(source.simplified)
    const level = standard?.level ?? sourceLevel
    const form = usefulForm(source.forms, standard?.pinyin ?? '')
    const previous = legacy.get(source.simplified)
    const definition = previous?.definition || cleanDefinition(form.meanings)

    const entry = {
      simplified: source.simplified,
      traditional:
        previous?.traditional ??
        ((standard?.traditional || form.traditional) === source.simplified
          ? null
          : standard?.traditional || form.traditional),
      pinyin: previous?.pinyin || standard?.pinyin || form.transcriptions.pinyin,
      definition: definition || 'Chinese vocabulary term',
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
