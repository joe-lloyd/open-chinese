/**
 * Combine the two builds into the single directory Netlify publishes.
 *
 *   apps/site/dist        -> /            (marketing, static, indexed)
 *   apps/app/dist         -> /app         (the SPA, noindex)
 *
 * Done as a script rather than a `cp -r` in netlify.toml so it behaves the same
 * on Windows as it does on Netlify's Linux builders, and so a missing input
 * fails with a sentence instead of a non-zero exit code.
 */

import { cp, rm, stat } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const siteDist = resolve(root, 'apps/site/dist')
const appDist = resolve(root, 'apps/app/dist')
const target = resolve(siteDist, 'app')

async function requireDir(path, hint) {
  try {
    if ((await stat(path)).isDirectory()) return
  } catch {
    /* fall through */
  }
  console.error(`\n  Missing ${path}\n  Run ${hint} first.\n`)
  process.exit(1)
}

await requireDir(siteDist, '`pnpm build:site`')
await requireDir(appDist, '`pnpm build:app`')

// Idempotent: re-running after only the app rebuilt must not leave stale files.
await rm(target, { recursive: true, force: true })
await cp(appDist, target, { recursive: true })

console.log(`Assembled → ${siteDist} (marketing at /, app at /app)`)
