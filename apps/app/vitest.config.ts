import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // ReaderCover.test.tsx is written for the node test runner and executes
    // via `pnpm test:reader-covers` (tsx --test); vitest must not collect it.
    exclude: ['**/node_modules/**', 'src/components/ReaderCover.test.tsx'],
  },
})
