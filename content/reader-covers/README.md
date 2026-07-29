# Graded-reader cover workflow

Cover art is generated once, reviewed, optimized, and committed. The app never calls an
image model at runtime. Titles, HSK labels, progress, and chapter counts stay in HTML;
generated pixels are deliberately text-free.

## Art direction (version 1)

Use contemporary editorial children's-book illustration built from opaque gouache
shapes, subtle cut-paper edges, restrained paper grain, simplified expressive
characters, and cinematic light. The family palette is deep ink, warm parchment,
vermilion, jade, and muted blue, with one story accent. Keep people and places
contemporary unless the prose says otherwise.

Do not imitate a named artist. Do not add generic “Chinese” ornament, historical
costume, pagodas, anime styling, photorealism, a book-jacket border, title text, Hanzi,
Latin letters, numbers, logos, signs, speech bubbles, or watermarks.

## Producing a cover

1. Read all chapters plus the reader's `goal`, `conflict`, and `resolution`.
2. Choose one concrete moment that contains the protagonist, actual setting, defining
   object, and a decision, conflict, or mystery. Do not combine events that cannot
   coexist in the story.
3. Copy the v1 shared direction and record the factual brief and final prompt in
   `prompts-v1.json`.
4. Generate a 2:3 portrait candidate with the built-in image-generation tool. Reserve
   calm, low-detail areas near the top and bottom for HTML; do not ask the model to
   create typography.
5. Reject any candidate with lettering, a watermark, invented story facts, distorted
   anatomy, misleading historical details, or an inconsistent visual style. Iterate
   with one targeted correction at a time.
6. Save the accepted 1024×1536 (or larger 2:3) PNG as
   `content/reader-covers/source/<reader-id>.png`. Record the exact final prompt and
   generation mode in `prompts-v1.json`.
7. Run `pnpm build:reader-covers`. This creates exact 480×720 and 960×1440 WebP
   derivatives under `apps/app/public/reader-covers/`.
8. Add optional `cover` metadata to the reader JSON only after both variants exist:

   ```json
   {
     "image": "reader-covers/cat-at-school",
     "alt": "A small cat listens to a phone beside a classroom door at dusk.",
     "focalPosition": "50% 42%",
     "accent": "#C45B43"
   }
   ```

9. Run `pnpm test:reader-covers`, `pnpm build:readers`, and `pnpm build:app`.
10. Inspect the library and detail page at 320px, tablet, and wide desktop in light and
    dark themes. Test a broken image URL, reduced-data emulation, keyboard navigation,
    and screen-reader naming. The art description should add useful scene information,
    not repeat the visible title.

## Initial level-spanning set

The v1 prompt record covers one story at each HSK level:
`cat-at-school`, `borrowed-bicycle`, `empty-seat`, `balcony-garden`,
`city-investigation`, `borrowed-name`, `echoes-in-the-archive`, `borrowed-voice`, and
`contract-after-the-flood`.

Complete the remaining stories level by level. Keep the v1 direction fixed during that
rollout; if user research suggests another style, test it as a separately versioned
direction rather than silently drifting the existing family.
