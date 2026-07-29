import { PRO_PRICING } from '@open-chinese/pricing'

/**
 * Everything that changes when the domain or the brand changes.
 *
 * Canonical URLs, the sitemap, robots.txt, OG/Twitter tags and the JSON-LD
 * structured data all derive from here, so pointing the site at a real domain
 * is editing `domain` and redeploying — nothing else.
 */

export const SITE = {
  name: 'OpenChinese',

  /**
   * Absolute origin, no trailing slash. Swap this when the production domain is
   * bought; `astro.config.mjs` reads it for `site`, which is what makes the
   * sitemap and canonical URLs absolute.
   */
  domain: 'https://open-chinese.joe-lloyd.com',

  /**
   * Where the app itself lives. Path-based, so it stays on the same origin.
   *
   * Trailing slash on purpose: the app's dev server serves at `/app/` and does
   * not redirect the bare path, so every marketing CTA would 404 in `pnpm dev`
   * without it. In production it also saves a redirect hop.
   */
  appPath: '/app/',

  tagline: 'Learn Mandarin that sticks',

  /**
   * The one-sentence description used for the home page meta description, the
   * OG card and the JSON-LD. Kept under 160 characters so search results do not
   * truncate it.
   */
  description:
    'HSK 1–9 Mandarin practice with spaced repetition, 33 graded-reader chapters and pronunciation checks. Study what is due and read what you learn.',

  locale: 'en',
  ogLocale: 'en_US',

  /** Shared VAT-inclusive display offer. The provider holds the real charge amounts. */
  proPricing: PRO_PRICING,
} as const

/** Absolute URL for a site-relative path. */
export function absoluteUrl(path = '/'): string {
  return new URL(path, SITE.domain).href
}
