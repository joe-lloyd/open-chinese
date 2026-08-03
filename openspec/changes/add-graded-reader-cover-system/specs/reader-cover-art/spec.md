## ADDED Requirements

### Requirement: Cover art follows a repeatable story-grounded direction
Every generated cover SHALL use the documented OpenChinese editorial illustration direction and SHALL be based on concrete characters, setting, objects, and conflict present in that reader's authored story. The generation prompt and final source output SHALL be recorded by reader id. Cover artwork SHALL contain no generated title, Hanzi, Latin lettering, logo, level number, border text, or watermark.

#### Scenario: Cover prompt is prepared
- **WHEN** an author prepares a cover for a reader
- **THEN** the prompt record SHALL name the reader id, focal subject, actual setting, defining object, narrative tension, shared style, composition, and exclusions

#### Scenario: Generated output contains lettering
- **WHEN** a candidate image contains visible generated lettering or a watermark
- **THEN** that image SHALL be rejected and SHALL NOT be referenced by reader metadata

### Requirement: First cover set spans all skill levels
The initial implementation SHALL ship a completed optimized cover for one reader at each distinct HSK level from 1 through 9. The selected readers SHALL be documented so visual coverage can be reviewed as a set.

#### Scenario: Initial rollout is validated
- **WHEN** the cover audit runs
- **THEN** it SHALL find at least one declared and existing cover at every HSK level from 1 through 9

### Requirement: Cover assets are responsive static files
Declared artwork SHALL be served from the application's own static assets in at least 480px and 960px portrait WebP variants with recorded intrinsic dimensions. Library images below the initial viewport SHALL be lazy-loaded, SHALL reserve aspect-ratio space before loading, and SHALL use the metadata focal position for cover crops. No runtime image-generation request SHALL occur.

#### Scenario: Library loads on a narrow device
- **WHEN** a learner opens the reader library on a narrow viewport
- **THEN** the browser SHALL be able to select the smaller declared asset
- **AND** cards SHALL reserve their cover aspect ratio before the image loads

#### Scenario: Cover is below the fold
- **WHEN** a cover card is initially outside the viewport
- **THEN** its image SHALL use lazy loading

#### Scenario: Learner opens an already-built reader
- **WHEN** a reader or cover is displayed
- **THEN** OpenChinese SHALL make no request to an image-generation service

### Requirement: Titles and labels remain semantic HTML
Chinese title, English title, HSK level, chapter count, and progress SHALL be rendered as text outside the generated pixels. Text contrast SHALL remain readable over every cover/fallback treatment in light and dark themes. The artwork description SHALL not redundantly repeat visible title text.

#### Scenario: Assistive technology reads a covered card
- **WHEN** a screen reader encounters a reader card
- **THEN** it SHALL receive the reader title, level, chapter/progress information, and a concise artwork description without duplicate title announcements

#### Scenario: Title is corrected
- **WHEN** an authored reader title changes
- **THEN** the visible card title SHALL update through content generation without regenerating the artwork

### Requirement: Readers without art have a deliberate fallback
If cover metadata is absent, malformed at runtime, or its image cannot load, the UI SHALL render a deterministic token-based fallback using the reader id and HSK level. The fallback SHALL preserve the same dimensions, title/metadata hierarchy, navigation target, and progress information as an image-backed card.

#### Scenario: Reader has no generated cover
- **WHEN** its card renders
- **THEN** a stable fallback cover SHALL be shown
- **AND** the reader SHALL remain fully navigable

#### Scenario: Image request fails
- **WHEN** a declared cover asset fails to load
- **THEN** the card SHALL replace it with the stable fallback without collapsing or hiding text

### Requirement: Cover workflow is documented and reviewable
The repository SHALL document how to select a scene, assemble a prompt, generate candidates, reject inaccurate/text-bearing outputs, optimize source images, add metadata, validate the build, and perform visual/accessibility review. It SHALL retain the prompt used for each shipped image.

#### Scenario: New story receives a cover
- **WHEN** a contributor follows the workflow
- **THEN** they SHALL be able to produce compatible assets and metadata without reverse-engineering existing images
- **AND** validation SHALL identify missing or malformed deliverables before deployment
