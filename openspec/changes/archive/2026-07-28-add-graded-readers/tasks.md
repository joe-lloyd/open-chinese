## 1. Content pipeline

- [x] 1.1 Define the authored source format and add `content/readers/` with a `README.md` describing the token schema, the quality gates and how a generator should target the format
- [x] 1.2 Write `scripts/build-readers.ts`: load `hsk{1..4}.json`, resolve bare tokens to pinyin + definition, classify punctuation, compute per-chapter introduced vocabulary, emit one JSON asset per reader plus `index.json`
- [x] 1.3 Implement the validation gates in the build script (gloss coverage, 10–20 new words per chapter, ≥3 repetitions of each introduced word, translation coverage, level fit) with failures naming reader/chapter/token and a non-zero exit code
- [x] 1.4 Add `build:readers` to `scripts/package.json` and the root `package.json`, wire it into `netlify.toml`, and gitignore `client/public/data/readers/`

## 2. Authored content

- [x] 2.1 Author the HSK 1 reader `content/readers/my-day.json` (3 chapters) using only HSK 1 vocabulary plus inline-glossed proper nouns
- [x] 2.2 Author the HSK 2 reader `content/readers/new-friend.json` (2 chapters) using HSK 1–2 vocabulary
- [x] 2.3 Run the build script and iterate on the prose until every gate passes for both readers

## 3. Client data layer

- [x] 3.1 Add `client/src/lib/readers.ts` with the runtime token/chapter/reader types, a cached manifest fetch and a cached per-reader fetch (cache-busted with `VITE_BUILD_ID` like `words.db`)
- [x] 3.2 Add helpers to derive a chapter's distinct vocabulary and, given the user's encountered-word set, its unencountered words
- [x] 3.3 Add reader progress reads/writes to `client/src/lib/firestore.ts`: `getReaderProgress`, `getAllReaderProgress`, `markChapterComplete` (arrayUnion, idempotent), `recordChapterOpened`, and `getLastRead` for the dashboard
- [x] 3.4 Add `addEncounteredWords` to `client/src/lib/firestore.ts` writing unstudied word documents in a batch with `encounteredAt`, `encounteredIn`, deck name and `customWordData` for words absent from `words.db`
- [x] 3.5 Fix the unstudied pool in `client/src/lib/session.ts` so it keys off "not yet studied" rather than "no document exists"
- [x] 3.6 Update the `firestore.rules` comment to enumerate the new `readerProgress` subcollection

## 4. Reading UI

- [x] 4.1 Add `client/src/components/ReaderText.tsx` rendering paragraphs of tokens with optional ruby pinyin, unencountered-word highlighting and per-token activation
- [x] 4.2 Implement the word popover: single viewport-clamped element positioned from the active token's bounding rect, opened on tap/click everywhere and additionally on pointer enter where `(hover: hover)` matches, dismissed on Escape, outside click and scroll
- [x] 4.3 Add `client/src/pages/ChapterPage.tsx`: chapter fetch, pinyin and translation toggles persisted for the session, unencountered-word count, last-read write on open, "Mark as finished" flow showing the added words and offering the next chapter
- [x] 4.4 Add `client/src/pages/ReaderPage.tsx`: reader header, chapter list with completion state and per-user new-word counts, not-found state for an unknown reader id
- [x] 4.5 Add `client/src/pages/ReadersPage.tsx`: overall chapters-finished counter and a card per reader with HSK level, chapter count and progress bar

## 5. Navigation and wiring

- [x] 5.1 Add the `/readers`, `/readers/:readerId` and `/readers/:readerId/:chapterId` routes to `client/src/App.tsx`
- [x] 5.2 Add the Readers entry and its icon to the nav array in `client/src/components/Sidebar.tsx` (covers both sidebar and bottom nav)

## 6. Verification

- [x] 6.1 Generate `client/public/words.db` and the reader assets, then confirm `pnpm --filter client build` completes with zero TypeScript errors
- [x] 6.2 Confirm the build script fails as specified when a gate is deliberately violated, then restore the content
- [x] 6.3 Re-read the full diff for scope creep, dead code and accidental edits to other branches' surfaces
