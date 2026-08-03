## Summary

- adds an optional, validated graded-reader cover contract to authored content,
  per-reader runtime assets, and the reader manifest
- adds responsive, accessible cover presentation to the reader library and detail page,
  including deterministic HSK/id fallback, broken-image recovery, and reduced-data
  behavior
- adds a repeatable v1 cover workflow, Sharp optimizer, and story-grounded final prompt
  records for one selected story at every HSK level from 1 through 9
- adds contract and server-rendered component tests for optional/invalid/missing art,
  WebP dimensions, responsive/lazy attributes, semantic titles, accessible descriptions,
  and stable fallbacks

## Image-generation status

No generated cover is included yet. The built-in image-generation backend returned a
network error on four attempts (including two different story prompts), and an
independent root prototype attempt failed the same way. Per the image-generation skill,
the implementation does not silently switch to an API-key CLI fallback and does not
substitute placeholders.

The nine final factual prompts are ready in
`content/reader-covers/prompts-v1.json`. When built-in export is available:

1. generate and visually reject text/watermark/story-inaccurate candidates;
2. save accepted PNGs under `content/reader-covers/source/`;
3. run `pnpm build:reader-covers`;
4. add cover metadata to the nine selected reader JSON files;
5. run the tests/build and complete the visual QA matrix.

Until then, all 45 readers use the deliberate deterministic fallback, and the build
cannot emit a broken art reference.

## Validation

- `tsx --tsconfig apps/app/tsconfig.app.json --test ...`: 6/6 pass
- reader build: 45 readers, 135 chapters
- app TypeScript project build: pass
- app Vite production build: pass
- app lint: no new warnings (two existing `StudyPage` hook dependency warnings remain)
- `git diff --check`: pass
