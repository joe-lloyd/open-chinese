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
        // These three CSS variables have always existed in index.css and are
        // used all over the app (LeechPanel, DueSummary, StudyPage), but were
        // never mapped here — so `text-correct` and friends emitted nothing.
        correct: 'var(--color-correct)',
        incorrect: 'var(--color-incorrect)',
        unrecognized: 'var(--color-unrecognized)',
      },
    },
  },
  plugins: [],
}

export default config
