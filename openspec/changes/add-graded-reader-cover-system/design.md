## Context

The reader library now contains five three-chapter stories at each HSK level from 1 through 9. Authored JSON is compiled into a runtime manifest and per-reader assets; `ReadersPage` and the reader detail flow currently use text-only cards. Cover art therefore touches authored metadata, the build tool, generated types, static assets, and responsive UI.

This change also establishes an image-generation process. The output must remain a committed, optimized static asset: OpenChinese does not generate images at runtime. Generated text is intentionally excluded because Chinese/English title accuracy, translation, accessibility, and future edits are more reliable in HTML.

## Goals / Non-Goals

**Goals:**

- Establish a recognizable editorial cover family with story-specific scenes.
- Make the library easier to scan while retaining clear HSK and progress information.
- Prove the system with one shipped cover for each HSK level.
- Make future covers repeatable through prompt records, metadata, validation, and optimization.
- Preserve performance, accessibility, responsive cropping, and graceful fallbacks.

**Non-Goals:**

- Generating all 45 covers in this first PR.
- Generating title typography, logos, level numbers, or watermarks inside images.
- Runtime calls to an image model, CDN transformation service, or third-party asset host.
- Character continuity across different stories; continuity is required only within a story's future art.
- Replacing story prose or modifying reader progression.

## Decisions

### Use one consistent editorial style with story-specific narrative anchors

Art direction: contemporary editorial children's-book illustration built from opaque gouache shapes, subtle cut-paper edges, restrained paper grain, simplified expressive characters, and cinematic lighting. The shared palette starts with deep ink, warm parchment, vermilion, jade, and muted blue, while each cover receives a story-specific accent. It avoids imitation of a named artist, generic “Asian” ornament, photorealism, anime styling, and historical costume unless the story requires it.

Every prompt derives from the story JSON and records:

- story id and level;
- one concrete protagonist or focal subject;
- actual setting and defining object;
- a moment of tension, decision, or mystery from the story;
- portrait book-cover composition with safe title/metadata zones;
- no text, lettering, logos, borders, or watermark.

The first set covers:

| HSK | Reader |
|---:|---|
| 1 | `cat-at-school` |
| 2 | `borrowed-bicycle` |
| 3 | `empty-seat` |
| 4 | `balcony-garden` |
| 5 | `city-investigation` |
| 6 | `borrowed-name` |
| 7 | `echoes-in-the-archive` |
| 8 | `borrowed-voice` |
| 9 | `contract-after-the-flood` |

### Keep titles and metadata out of generated pixels

Artwork is text-free. The card renders Chinese title, English title, HSK badge, and progress as semantic HTML in a consistent lower overlay/surface. This is accessible, localizable, searchable, and immune to malformed generated Hanzi.

Alternative: generate complete book jackets. This might look more illustrative in isolation but produces unreliable text and makes every correction a new image-generation task.

### Add explicit cover metadata to authored content

Each reader may define:

```json
{
  "cover": {
    "image": "reader-covers/cat-at-school",
    "alt": "A school cat waiting beside a classroom door at dusk.",
    "focalPosition": "50% 42%",
    "accent": "#B84A3A"
  }
}
```

The base path resolves to generated 480px and 960px WebP assets. `alt` describes the artwork rather than repeating the visible title. `focalPosition` is validated as percentages, and `accent` is a valid six-digit hex value. Readers without cover metadata receive a deterministic CSS fallback based on HSK level/id.

Alternative: infer paths from reader id. Explicit metadata prevents broken assumptions, lets some stories intentionally use fallback art, and supports future art replacement.

### Optimize static assets at build time

Source PNGs and prompt records live under a documented source-art directory; web outputs are produced with the repository's image tooling into committed public assets. Delivery uses a `<picture>`/responsive image or equivalent with intrinsic dimensions, lazy loading below the fold, `object-fit: cover`, and metadata-driven focal position. Each 960px WebP targets a practical quality/size budget, enforced with file existence and dimension checks rather than a brittle universal byte ceiling.

### Validate both content and presentation

The reader build fails on malformed cover metadata or missing declared web assets. UI tests cover image/fallback choice, HTML title rendering, alt behavior, progress retention, and lazy-loading attributes. Visual QA covers 320px mobile, tablet, wide desktop, light/dark themes, image failure, and reduced-data behavior.

## Risks / Trade-offs

- [Generated characters/style drift across covers] → Keep a versioned master prompt, reuse the same style paragraph, and record final prompt/output for every asset.
- [A cover misrepresents the prose] → Require prompt facts to be traceable to the story and review the chosen conflict/object before shipping.
- [Artwork overwhelms learning metadata] → Reserve a stable HTML information surface and test contrast against every accent.
- [Images increase transfer and layout shift] → Use responsive WebP sizes, intrinsic dimensions, lazy loading, and a lightweight CSS fallback.
- [Only nine of 45 stories initially have art] → Make fallback cards intentional and visually coherent; expand level by level through the same workflow.
- [Generated image contains accidental text] → Prompt explicit “no text” and reject outputs with visible lettering/watermarks during visual QA.

## Migration Plan

1. Extend reader source/runtime types and build validation with optional metadata.
2. Implement fallback and responsive `ReaderCover` presentation.
3. Generate, review, optimize, and record nine representative covers.
4. Add metadata only after corresponding assets exist.
5. Run reader build, app tests/build, and the visual QA matrix.
6. Roll back by removing metadata/assets or reverting the component; every reader remains usable through the fallback.

## Open Questions

After measured user feedback on the first nine covers, decide whether to complete the remaining 36 in this style or test one controlled alternative before scaling generation.
