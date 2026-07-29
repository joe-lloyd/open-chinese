import { access, mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '../../..')
const sourceDir = resolve(root, 'content/reader-covers/source')
const outputDir = resolve(root, 'apps/app/public/reader-covers')
const promptPath = resolve(root, 'content/reader-covers/prompts-v1.json')
const records = JSON.parse(await readFile(promptPath, 'utf8'))

await mkdir(outputDir, { recursive: true })

for (const record of records.covers) {
  const source = resolve(sourceDir, `${record.readerId}.png`)
  await access(source)
  for (const [width, height] of [
    [480, 720],
    [960, 1440],
  ]) {
    const output = resolve(outputDir, `${record.readerId}-${width}.webp`)
    await sharp(source)
      .rotate()
      .resize(width, height, { fit: 'cover', position: 'centre' })
      .webp({ quality: 82, smartSubsample: true, effort: 6 })
      .toFile(output)
  }
}

console.log(`Built ${records.covers.length * 2} reader-cover variants → ${outputDir}`)
