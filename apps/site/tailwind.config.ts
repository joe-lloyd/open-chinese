import type { Config } from 'tailwindcss'
import tokens from '@open-chinese/tokens/tailwind-preset'

// Same colour scale as the app, from the shared preset — a visitor who signs up
// should not feel like they changed products.
const config: Config = {
  presets: [tokens as Config],
  content: ['./src/**/*.{astro,ts,tsx,md,mdx}'],
}

export default config
