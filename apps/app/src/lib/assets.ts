/**
 * Absolute URLs for runtime-fetched static assets.
 *
 * Vite rewrites asset URLs it can see at build time, but not strings we build
 * ourselves. `words.db`, the sql.js WASM binary and the reader JSON are all
 * fetched by hand, so they have to be prefixed explicitly — otherwise they
 * resolve against the domain root and 404 once the app is served from /app/.
 *
 * `BASE_URL` already carries a trailing slash ('/app/'), and is '/' in dev.
 */
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
}
