import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export interface ReaderCover {
  image: string
  alt: string
  focalPosition: string
  accent: string
}

const IMAGE_BASE = /^reader-covers\/[a-z0-9]+(?:-[a-z0-9]+)*$/
const FOCAL_POSITION = /^(?:100|[0-9]{1,2})%\s+(?:100|[0-9]{1,2})%$/
const ACCENT = /^#[0-9A-Fa-f]{6}$/

export const COVER_VARIANTS = [
  { suffix: '480', width: 480, height: 720 },
  { suffix: '960', width: 960, height: 1440 },
] as const

export function readWebPDimensions(path: string): { width: number; height: number } {
  const buffer = readFileSync(path)
  if (
    buffer.length < 30 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    throw new Error('not a WebP file')
  }

  let offset = 12
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString('ascii', offset, offset + 4)
    const size = buffer.readUInt32LE(offset + 4)
    const data = offset + 8

    if (type === 'VP8X' && size >= 10 && data + 10 <= buffer.length) {
      return {
        width: 1 + buffer.readUIntLE(data + 4, 3),
        height: 1 + buffer.readUIntLE(data + 7, 3),
      }
    }
    if (type === 'VP8L' && size >= 5 && data + 5 <= buffer.length && buffer[data] === 0x2f) {
      const bits = buffer.readUInt32LE(data + 1)
      return {
        width: 1 + (bits & 0x3fff),
        height: 1 + ((bits >> 14) & 0x3fff),
      }
    }
    if (
      type === 'VP8 ' &&
      size >= 10 &&
      data + 10 <= buffer.length &&
      buffer[data + 3] === 0x9d &&
      buffer[data + 4] === 0x01 &&
      buffer[data + 5] === 0x2a
    ) {
      return {
        width: buffer.readUInt16LE(data + 6) & 0x3fff,
        height: buffer.readUInt16LE(data + 8) & 0x3fff,
      }
    }

    offset = data + size + (size % 2)
  }

  throw new Error('WebP dimensions could not be read')
}

export function validateReaderCover(
  readerId: string,
  value: unknown,
  publicDir: string,
  errors: string[]
): ReaderCover | undefined {
  if (value === undefined) return undefined
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${readerId}: cover must be an object`)
    return undefined
  }

  const candidate = value as Partial<ReaderCover>
  if (typeof candidate.image !== 'string' || !IMAGE_BASE.test(candidate.image)) {
    errors.push(
      `${readerId}: cover.image must be an extensionless path like "reader-covers/${readerId}"`
    )
  }
  if (typeof candidate.alt !== 'string' || !candidate.alt.trim()) {
    errors.push(`${readerId}: cover.alt must be a non-empty artwork description`)
  }
  if (
    typeof candidate.focalPosition !== 'string' ||
    !FOCAL_POSITION.test(candidate.focalPosition)
  ) {
    errors.push(`${readerId}: cover.focalPosition must contain two percentages`)
  }
  if (typeof candidate.accent !== 'string' || !ACCENT.test(candidate.accent)) {
    errors.push(`${readerId}: cover.accent must be a six-digit hex colour`)
  }

  if (
    typeof candidate.image !== 'string' ||
    !IMAGE_BASE.test(candidate.image) ||
    typeof candidate.alt !== 'string' ||
    !candidate.alt.trim() ||
    typeof candidate.focalPosition !== 'string' ||
    !FOCAL_POSITION.test(candidate.focalPosition) ||
    typeof candidate.accent !== 'string' ||
    !ACCENT.test(candidate.accent)
  ) {
    return undefined
  }

  for (const variant of COVER_VARIANTS) {
    const relativePath = `${candidate.image}-${variant.suffix}.webp`
    const assetPath = resolve(publicDir, relativePath)
    if (!existsSync(assetPath)) {
      errors.push(`${readerId}: missing cover asset ${relativePath}`)
      continue
    }
    try {
      const dimensions = readWebPDimensions(assetPath)
      if (dimensions.width !== variant.width || dimensions.height !== variant.height) {
        errors.push(
          `${readerId}: ${relativePath} is ${dimensions.width}x${dimensions.height}, expected ${variant.width}x${variant.height}`
        )
      }
    } catch (error) {
      errors.push(
        `${readerId}: cannot inspect ${relativePath} (${error instanceof Error ? error.message : String(error)})`
      )
    }
  }

  return {
    image: candidate.image,
    alt: candidate.alt.trim(),
    focalPosition: candidate.focalPosition,
    accent: candidate.accent.toUpperCase(),
  }
}
