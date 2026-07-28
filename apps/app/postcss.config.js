export default {
  plugins: {
    // Resolves `@import '@open-chinese/tokens/tokens.css'` through node
    // resolution. Without it PostCSS treats the specifier as a relative path and
    // the build fails looking for ./@open-chinese/tokens/tokens.css.
    // Must run before Tailwind so the imported custom properties are present.
    'postcss-import': {},
    tailwindcss: {},
    autoprefixer: {},
  },
}
