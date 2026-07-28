import type { APIRoute } from 'astro'
import { SITE } from '../../site.config'

/**
 * Generated rather than static so the sitemap URL follows `site.config.ts`.
 *
 * /app is disallowed on purpose: it is behind auth, renders nothing without
 * JavaScript, and every crawl of it is budget spent on a page that can never
 * rank. Keeping it out also stops the SPA's shell competing with the real
 * landing pages for the brand query.
 */
export const GET: APIRoute = () =>
  new Response(
    `User-agent: *
Allow: /
Disallow: /app

Sitemap: ${SITE.domain}/sitemap-index.xml
`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
  )
