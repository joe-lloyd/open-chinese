// @ts-check
import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import tailwind from '@astrojs/tailwind'
import { SITE } from './site.config.ts'

export default defineConfig({
  // Makes canonical URLs and the sitemap absolute. Comes from site.config.ts so
  // there is one place to change when the real domain is bought.
  site: SITE.domain,

  integrations: [
    tailwind({ applyBaseStyles: false }),
    sitemap({
      // /app is the SPA. It is behind auth, renders nothing without JavaScript
      // and would only dilute the crawl budget.
      filter: (page) => !page.includes('/app'),
    }),
  ],

  build: {
    // Inline the small amount of CSS this site has rather than paying for a
    // render-blocking request. Everything here is well under the 4KB default.
    inlineStylesheets: 'always',
  },

  // The site ships no client JavaScript, so there is nothing to prefetch into.
  prefetch: false,
})
