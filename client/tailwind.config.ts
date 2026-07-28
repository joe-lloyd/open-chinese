import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: 'var(--color-surface)',
        'surface-raised': 'var(--color-surface-raised)',
        'text-primary': 'var(--color-text-primary)',
        'text-muted': 'var(--color-text-muted)',
        accent: 'var(--color-accent)',
        border: 'var(--color-border)',
        correct: 'var(--color-correct)',
        incorrect: 'var(--color-incorrect)',
        unrecognized: 'var(--color-unrecognized)',
      },
    },
  },
  plugins: [],
}

export default config
