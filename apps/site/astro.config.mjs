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

  vite: {
    server: {
      /*
       * In production the marketing site and the app are one origin: the app
       * build is copied into this site's output at /app. Two dev servers would
       * break that — clicking "Start free" on :4321 would 404, because the app
       * is a separate process on :5173.
       *
       * Proxying /app makes :4321 the whole product locally, exactly as it is
       * once deployed. Open one URL and click through the entire flow.
       *
       * `ws: true` forwards the app's HMR socket, so editing app source still
       * hot-reloads through the proxy.
       */
      proxy: {
        '/app': {
          target: 'http://localhost:5173',
          changeOrigin: true,
          ws: true,
        },
      },
    },
  },
})
