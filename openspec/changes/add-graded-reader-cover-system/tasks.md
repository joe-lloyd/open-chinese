## 1. Cover Contract

- [x] 1.1 Extend authored/runtime reader types with optional image base, art alt, focal position, and accent metadata
- [x] 1.2 Validate cover fields and required 480px/960px WebP assets in the reader build
- [x] 1.3 Include validated optional cover metadata in each runtime reader asset and manifest entry
- [x] 1.4 Add build tests for valid metadata, omitted metadata, malformed fields, and missing variants

## 2. Presentation

- [x] 2.1 Build a reusable responsive `ReaderCover` presentation with intrinsic ratio, focal crop, semantic text composition, and token-based accent
- [x] 2.2 Build the deterministic HSK/id fallback and image-error transition without layout collapse
- [x] 2.3 Integrate cover presentation into the skill-organized reader library without losing chapter/progress/navigation information
- [x] 2.4 Integrate a compatible cover treatment into the reader detail page
- [x] 2.5 Add component tests for artwork, fallback, lazy loading, accessible description, HTML titles, and progress retention

## 3. Representative Art Set

- [x] 3.1 Write the versioned master art-direction/prompt template and full cover-production workflow
- [x] 3.2 Extract factual scene briefs from the nine selected reader stories and record one final prompt per reader
- [ ] 3.3 Generate and visually review one text-free source cover for each HSK level 1 through 9, rejecting text, watermark, or story inaccuracies
- [ ] 3.4 Optimize every accepted source to 480px and 960px portrait WebP variants with stable names and recorded dimensions
- [ ] 3.5 Add cover metadata for the nine selected readers and verify the level-coverage audit

## 4. Verification

- [ ] 4.1 Run reader generation, content validation, app tests/typecheck/build, and static asset checks
- [ ] 4.2 Visually inspect library/detail covers at 320px, tablet, and wide desktop in light/dark themes
- [ ] 4.3 Verify broken-image fallback, reduced-data behavior, loading stability, contrast, and screen-reader naming
- [x] 4.4 Mark completed OpenSpec tasks and include the source prompts plus rollout guidance in the PR description
