## Why

OpenChinese today only teaches vocabulary in isolation — flashcards, HSK level lists and a searchable dictionary. Learners have no place to meet those words in running text, which is where recognition actually consolidates. Graded readers are the standard bridge: short stories pinned to an HSK level that deliberately recycle a small set of new words often enough for them to stick. Adding them gives the app a second, lower-effort study mode that feeds the SRS pipeline instead of competing with it.

## What Changes

- Add a **Readers** section to the app (sidebar + bottom nav + routes) listing every graded reader with its HSK level and the user's completion progress.
- Introduce a **reader content format**: pre-segmented, per-token chapter data (hanzi + pinyin + gloss) authored as JSON in the repo and enriched/validated by a build script into static assets the client fetches.
- Ship a **vertical slice of hand-authored content**: two readers (HSK 1 and HSK 2) with several short chapters each, each chapter introducing roughly 10–20 new words and repeating every new word at least three times.
- Build the **reading experience**: large text, generous line spacing, a pinyin toggle, an English-translation toggle, hover (desktop) / tap (mobile) word popovers showing pinyin and meaning, and highlighting of words the user has not yet encountered.
- On **chapter completion**, write every newly-encountered word into `users/{uid}/words` so it lands in the user's personal dictionary and stays eligible as a future new SRS card.
- Track **per-reader and overall completion** in a new `users/{uid}/readerProgress/{readerId}` subcollection, and denormalise a `lastRead` pointer onto the user profile document so the dashboard can offer "continue reading".
- Add a `build:readers` script to the build pipeline that validates content quality (segmentation coverage, gloss coverage, new-word count, repetition floor) and fails the build on violations.
- Fix a latent bug in queue building: a word document that exists but has never been studied is currently excluded from the new-card pool. Reader-encountered words must remain studiable.

## Capabilities

### New Capabilities
- `graded-readers`: browsing readers, reading a chapter with pinyin/translation toggles and per-word lookups, unknown-word highlighting, chapter completion, and progress tracking.
- `reader-content`: the authored source format, the build-time enrichment/validation pipeline, and the runtime asset layout for reader content.

### Modified Capabilities
- `firestore-user-data`: adds the `users/{uid}/readerProgress/{readerId}` subcollection, the reader-encountered word document shape (`encounteredAt`, `encounteredIn`), and the `lastRead` profile field.
- `queue-manager`: the new-card pool is defined by "not yet studied" rather than "has no document", so reading-encountered words still surface as new cards.

## Impact

- **New code**: `client/src/pages/ReadersPage.tsx`, `ReaderPage.tsx`, `ChapterPage.tsx`; `client/src/components/ReaderText.tsx`; `client/src/lib/readers.ts`; `scripts/build-readers.ts`; authored content under `content/readers/`.
- **Modified code**: `client/src/App.tsx` (routes), `client/src/components/Sidebar.tsx` (nav entry), `client/src/lib/firestore.ts` (reader progress + encountered-word writes), `client/src/lib/session.ts` (new-card pool fix), `package.json` / `scripts/package.json` / `netlify.toml` (build step), `.gitignore`, `firestore.rules` (documentation of the new subcollection).
- **No new runtime dependencies.** Content is static and offline-capable; nothing calls an external API at runtime.
- **Integration points for parallel work**: the personal-dictionary branch consumes the word documents this feature writes; the dashboard branch consumes the `lastRead` profile field; the monetization branch can gate whole readers because a reader is a single self-contained asset.
