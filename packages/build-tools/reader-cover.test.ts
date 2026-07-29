import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { COVER_VARIANTS, readWebPDimensions, validateReaderCover } from './reader-cover'

function vp8x(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(30)
  buffer.write('RIFF', 0, 'ascii')
  buffer.writeUInt32LE(22, 4)
  buffer.write('WEBP', 8, 'ascii')
  buffer.write('VP8X', 12, 'ascii')
  buffer.writeUInt32LE(10, 16)
  buffer.writeUIntLE(width - 1, 24, 3)
  buffer.writeUIntLE(height - 1, 27, 3)
  return buffer
}

test('cover metadata may be omitted', () => {
  const errors: string[] = []
  assert.equal(validateReaderCover('no-cover', undefined, '.', errors), undefined)
  assert.deepEqual(errors, [])
})

test('valid metadata and both expected dimensions are accepted', (context) => {
  const root = mkdtempSync(join(tmpdir(), 'reader-cover-'))
  context.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, 'reader-covers'))
  for (const variant of COVER_VARIANTS) {
    writeFileSync(
      join(root, `reader-covers/story-${variant.suffix}.webp`),
      vp8x(variant.width, variant.height)
    )
  }
  const errors: string[] = []
  const cover = validateReaderCover(
    'story',
    {
      image: 'reader-covers/story',
      alt: '  A cyclist repairing a wheel at night. ',
      focalPosition: '52% 40%',
      accent: '#b84a3a',
    },
    root,
    errors
  )
  assert.deepEqual(errors, [])
  assert.deepEqual(cover, {
    image: 'reader-covers/story',
    alt: 'A cyclist repairing a wheel at night.',
    focalPosition: '52% 40%',
    accent: '#B84A3A',
  })
  assert.deepEqual(readWebPDimensions(join(root, 'reader-covers/story-960.webp')), {
    width: 960,
    height: 1440,
  })
})

test('malformed fields are rejected with field-specific errors', () => {
  const errors: string[] = []
  assert.equal(
    validateReaderCover(
      'bad-story',
      { image: '../bad.png', alt: ' ', focalPosition: 'middle', accent: 'red' },
      '.',
      errors
    ),
    undefined
  )
  assert.equal(errors.length, 4)
  assert.ok(errors.some((error) => error.includes('cover.image')))
  assert.ok(errors.some((error) => error.includes('cover.alt')))
  assert.ok(errors.some((error) => error.includes('cover.focalPosition')))
  assert.ok(errors.some((error) => error.includes('cover.accent')))
})

test('missing variants and wrong dimensions identify the reader and asset', (context) => {
  const root = mkdtempSync(join(tmpdir(), 'reader-cover-'))
  context.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, 'reader-covers'))
  writeFileSync(join(root, 'reader-covers/story-480.webp'), vp8x(400, 600))
  const errors: string[] = []
  validateReaderCover(
    'story',
    {
      image: 'reader-covers/story',
      alt: 'A scene.',
      focalPosition: '50% 50%',
      accent: '#123ABC',
    },
    root,
    errors
  )
  assert.ok(errors.some((error) => error.includes('story') && error.includes('400x600')))
  assert.ok(errors.some((error) => error.includes('story') && error.includes('story-960.webp')))
})
