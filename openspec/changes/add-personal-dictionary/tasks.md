## 1. Word database: normalized pinyin and batch lookup

- [x] 1.1 Add `normalizePinyin(value: string): string` to `client/src/lib/worddb.ts` — NFD decompose, strip `U+0300–U+036F`, lowercase, map `v`→`u`, strip tone digits `1–5` and separators (space, apostrophe, hyphen, middle dot). Export it.
- [x] 1.2 Add `pinyin_normalized TEXT` to the `words` table in `scripts/build-words-db.ts`, populate it from the shared `normalizePinyin`, and add `CREATE INDEX idx_pinyin_normalized`.
- [x] 1.3 Add `pinyin_normalized` to the `Word` interface in `worddb.ts`.
- [x] 1.4 Detect whether `pinyin_normalized` exists via `PRAGMA table_info(words)` when the DB is opened, and expose that flag to `searchWords`.
- [x] 1.5 Rewrite `searchWords` to score results with a SQL `CASE` (exact hanzi 0, hanzi prefix 1, exact normalized pinyin 2, pinyin prefix 3, definition prefix 4, other substring 5), order by score then `hsk_level` then `simplified`, `LIMIT 50`. Fall back to matching the tone-marked `pinyin` column when `pinyin_normalized` is absent.
- [x] 1.6 Add `getWords(simplifieds: string[]): Word[]` — chunked `WHERE simplified IN (...)` at 500 per chunk, returning only found rows.
- [x] 1.7 Run `pnpm build:words-db` and confirm `pinyin_normalized` is populated for a tone-marked entry.

## 2. Firestore helpers

- [x] 2.1 Add `WordSeed { simplified: string; deckName?: string; hskLevel?: number | null }` to `client/src/lib/firestore.ts`.
- [x] 2.2 Widen `markWordsKnown(uid, words: (string | WordSeed)[])` to accept seeds, writing `deckName`/`hskLevel` when supplied, keeping the existing mastered semantics (intervals 365, `status` `Mastered`, `nextReviewDate` +1 year). Verify the existing `QueuePage` `string[]` call still type-checks.
- [x] 2.3 Add `unmarkWordsKnown(uid, simplifieds: string[])` — batch set intervals to 1, `status` to `Weak`, `nextReviewDate` to now; leave `easeFactor` untouched.
- [x] 2.4 Add `ensureUserWords(uid, seeds: WordSeed[]): Promise<string[]>` — chunked `where(documentId(), 'in', chunk)` existence check at 30 per chunk, then batched creates (500 per batch) at default SRS state with `firstSeenAt` server timestamp; return the created simplifieds. Never modify existing documents.
- [x] 2.5 Extend `WordState` with the analytics fields the dictionary reads (`totalReviews`, `correctMeaningCount`, `firstSeenAt`, `lastReviewedAt`, `hskLevel`) and populate them in `getAllUserWords` / `getUserWord`, all optional so existing documents stay valid.

## 3. Remove mark-as-known from the study session

- [x] 3.1 Delete both "Mark as fully known →" buttons from `client/src/pages/StudyPage.tsx` (the `revealedByFail` and `!revealedByFail` meaning-revealed blocks).
- [x] 3.2 Delete the now-unused `markAsKnown` `useCallback` and drop `markWordsKnown` from the `firestore` import. Change nothing else in the file.

## 4. Personal dictionary UI

- [x] 4.1 Add `client/src/components/WordFilterBar.tsx` — status, HSK level and deck selects plus a sort select, driven by props, with a clear-filters control.
- [x] 4.2 Add `client/src/components/PersonalWordList.tsx` — paginated rows (50 per page) showing simplified, pinyin, definition, status, HSK badge, deck, knowledge % (placeholder when `totalReviews` is absent) and last reviewed; per-row checkbox and a sticky selection action bar with Mark as known / Unmark / Clear.
- [x] 4.3 Add `client/src/components/WordDetail.tsx` — the existing detail content (hanzi, traditional, pinyin, definition, HSK badge, `CharacterBreakdown`, notes editor) plus status, review stats, and the mark/unmark and add-to-dictionary controls.
- [x] 4.4 Rewrite `client/src/pages/DictionaryPage.tsx`: load `getAllUserWords` + `worddb.getWords` on mount, build the joined view model, hold a `'mine' | 'search'` mode with a segmented toggle, keep the stacked-mobile / back-button pattern, and wire selection, filtering, sorting, pagination and the mutations with optimistic local updates.
- [x] 4.5 Reset pagination to page 1 whenever a filter or sort changes.
- [x] 4.6 Annotate search results with the user's status from the loaded word map, and offer add-to-dictionary / mark-known for results with no document.
- [x] 4.7 Empty states: no words at all, and filters matching nothing.

## 5. Verify

- [x] 5.1 `pnpm --filter client build` passes with zero TypeScript errors.
- [x] 5.2 Re-read the full diff: confirm the `StudyPage` change is limited to the mark-as-known removal, and that no unused imports or dead state remain in `DictionaryPage`.
