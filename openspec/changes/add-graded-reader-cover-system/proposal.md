## Why

The expanded graded-reader library is difficult to scan because every story is represented by the same text-only card treatment. A coherent cover-art system can make stories memorable and inviting, but it must scale beyond a few one-off images without embedding unreliable generated typography or bloating the app.

## What Changes

- Add structured cover metadata to authored readers and generated manifests, including image path, accessible description, focal position, and display palette.
- Establish a text-free editorial illustration direction and reusable prompt recipe tied to each story's actual characters, setting, object, and conflict.
- Generate and ship a representative cover set spanning HSK 1 through HSK 9, with titles and level labels rendered as accessible HTML over the artwork.
- Add responsive cover rendering, art-directed crops, lazy loading, fallback art, and reduced-data behavior to the reader library and reader detail page.
- Add build-time validation for metadata/files plus a documented workflow for expanding the system to all readers.

## Capabilities

### New Capabilities

- `reader-cover-art`: Defines art direction, generation inputs, metadata, asset optimization, accessibility, fallbacks, and rollout workflow for graded-reader covers.

### Modified Capabilities

- `reader-content`: Extends authored and generated reader metadata with validated cover information.
- `graded-readers`: Requires browsable story cards and reader details to present responsive cover art without compromising progress, labels, or navigation.

## Impact

- Affects `content/readers/`, `packages/build-tools/build-readers.ts`, runtime reader types/loading, reader list/detail components, static image assets, and validation tests.
- Adds optimized raster assets but no runtime image-generation service or external content request.
- The first implementation covers one representative story per HSK level; the documented workflow supports completing the remaining library consistently.
