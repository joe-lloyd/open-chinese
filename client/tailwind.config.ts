import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // `<alpha-value>` is what makes opacity modifiers work. Declaring these as
      // bare `var(--color-x)` silently drops every `bg-accent/10`-style class.
      colors: {
        surface: 'rgb(var(--surface-rgb) / <alpha-value>)',
        'surface-raised': 'rgb(var(--surface-raised-rgb) / <alpha-value>)',
        'text-primary': 'rgb(var(--text-primary-rgb) / <alpha-value>)',
        'text-muted': 'rgb(var(--text-muted-rgb) / <alpha-value>)',
        accent: 'rgb(var(--accent-rgb) / <alpha-value>)',
        border: 'rgb(var(--border-rgb) / <alpha-value>)',
        correct: 'rgb(var(--correct-rgb) / <alpha-value>)',
        incorrect: 'rgb(var(--incorrect-rgb) / <alpha-value>)',
        unrecognized: 'rgb(var(--unrecognized-rgb) / <alpha-value>)',
      },
    },
  },
  plugins: [],
}

export default config
