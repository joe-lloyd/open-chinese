/**
 * Shared Tailwind colour scale, consumed by both apps via `presets: [...]`.
 *
 * `<alpha-value>` is what makes opacity modifiers work. Declaring these as bare
 * `var(--color-x)` silently drops every `bg-accent/10`-style class — the whole
 * class compiles to nothing with no error, which is exactly the bug this
 * indirection exists to prevent.
 */

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: 'rgb(var(--surface-rgb) / <alpha-value>)',
        'surface-raised': 'rgb(var(--surface-raised-rgb) / <alpha-value>)',
        'text-primary': 'rgb(var(--text-primary-rgb) / <alpha-value>)',
        'text-muted': 'rgb(var(--text-muted-rgb) / <alpha-value>)',
        accent: 'rgb(var(--accent-rgb) / <alpha-value>)',
        // Pair for filled accent surfaces. `bg-accent text-white` fails WCAG AA
        // in both themes — use `bg-accent-solid text-on-accent` instead.
        'accent-solid': 'rgb(var(--accent-solid-rgb) / <alpha-value>)',
        'on-accent': 'rgb(var(--on-accent-rgb) / <alpha-value>)',
        border: 'rgb(var(--border-rgb) / <alpha-value>)',
        correct: 'rgb(var(--correct-rgb) / <alpha-value>)',
        incorrect: 'rgb(var(--incorrect-rgb) / <alpha-value>)',
        unrecognized: 'rgb(var(--unrecognized-rgb) / <alpha-value>)',
      },
    },
  },
}
