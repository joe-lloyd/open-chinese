import type { Config } from 'tailwindcss'
import tokens from '@open-chinese/tokens/tailwind-preset'

// Colour scale comes from the shared preset so the app and the marketing site
// cannot drift. See packages/tokens/tailwind-preset.js for why the values are
// channel triplets rather than bare var() references.
const config: Config = {
  presets: [tokens as Config],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
}

export default config
