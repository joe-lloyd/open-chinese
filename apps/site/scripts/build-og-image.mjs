/**
 * Render public/og.png, the 1200x630 card shown when a link is shared.
 *
 * Generated from markup rather than drawn by hand so it tracks site.config.ts,
 * and committed rather than built on every deploy so a broken render never ships
 * a missing image. Re-run after changing the brand name, tagline or price.
 *
 *   pnpm --filter @open-chinese/site build:og
 *
 * Uses the `sharp` that Astro already depends on — no extra dependency.
 */

import { stat } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(pkgRoot, 'public/og.png')

// Values duplicated from site.config.ts rather than imported: this is a plain
// .mjs script and that file is TypeScript. Small and stable enough to be worth
// avoiding a transpile step for.
const NAME = 'OpenChinese'
const TAGLINE = 'Learn Mandarin that sticks'
const SUB = 'Spaced repetition · Graded readers · HSK 1–4'

// librsvg (what sharp uses to rasterise SVG) resolves fonts through fontconfig
// and has no notion of `system-ui` — asking for it silently yields a serif on
// Windows and something else again on Linux. Name real families instead, with
// Liberation Sans for the Linux builders.

// Escaped for XML: an ampersand in the tagline would otherwise break the parse.
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1040" cy="150" r="230" fill="#6366f1" opacity="0.14"/>
  <text x="80" y="176" font-family="Arial, Helvetica, Liberation Sans, sans-serif" font-size="150" font-weight="600" fill="#818cf8">中</text>
  <text x="80" y="330" font-family="Arial, Helvetica, Liberation Sans, sans-serif" font-size="72" font-weight="700" fill="#f9fafb">${esc(TAGLINE)}</text>
  <text x="80" y="404" font-family="Arial, Helvetica, Liberation Sans, sans-serif" font-size="34" fill="#9ca3af">${esc(SUB)}</text>
  <rect x="80" y="470" width="270" height="70" rx="16" fill="#6366f1"/>
  <text x="215" y="516" text-anchor="middle" font-family="Arial, Helvetica, Liberation Sans, sans-serif" font-size="28" font-weight="600" fill="#ffffff">Start free</text>
  <text x="382" y="516" font-family="Arial, Helvetica, Liberation Sans, sans-serif" font-size="26" fill="#9ca3af">${esc(NAME)}</text>
</svg>`

await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(out)
const { size } = await stat(out)
console.log(`Built og.png → ${out} (${Math.round(size / 1024)} KB)`)
