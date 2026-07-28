## Why

The Dictionary tab is search-first: it shows nothing until the user types, so the words they have actually encountered — the vocabulary that defines their progress — are invisible. At the same time the "Mark as fully known" control sits under the study grade buttons, where it shifts the layout on every card and offers no way to undo. Both problems point at the same missing surface: a personal dictionary that owns the user's word inventory and the actions on it.

## What Changes

- The Dictionary tab defaults to a **personal dictionary** — every word in `users/{uid}/words`, with status, knowledge % (`correctMeaningCount / totalReviews`), HSK level, deck and last-reviewed date.
- The personal list is filterable by status, HSK level and deck, sortable by several keys, and paginated so a few thousand words never render at once.
- **Search becomes a secondary mode.** It gains normalized-pinyin matching (`pengyou`, `péngyou`, `peng you`, `peng2you3` all find 朋友), keeps hanzi (simplified + traditional) and English definition matching, ranks exact/prefix matches first, and annotates each result with the user's status for that word.
- `words.db` gains a `pinyin_normalized` column plus an index; `scripts/build-words-db.ts` derives it at build time. **BREAKING** for the generated artifact only — `pnpm build:words-db` must be re-run before deploy (the file is gitignored and already regenerated per deploy).
- **Mark as fully known moves out of the study session.** The two controls under the grade buttons in `StudyPage.tsx` are removed; the personal dictionary gains per-word and bulk multi-select "Mark as known", plus an **unmark** that returns a word to normal scheduling.
- A word detail view is reachable from both the personal list and search results, carrying the existing character breakdown and notes plus the new mastery controls and per-word stats.

## Capabilities

### New Capabilities
- `personal-dictionary`: the user's own word inventory as the primary Dictionary view — overview list, per-word signal, filtering/sorting/pagination, mark-as-known and unmark (single and bulk), and the detail view.

### Modified Capabilities
- `dictionary`: search is no longer the landing view; search matching is extended to normalized pinyin and results annotated with personal status.
- `static-word-db`: `words` table gains `pinyin_normalized`; `WordDB` exposes normalized-pinyin search and a batch `getWords(simplifieds)` lookup.
- `firestore-user-data`: "User can mark words as fully known" moves from the study card to the personal dictionary and gains an unmark path. (`study-session` needs no delta — it never specified the in-session control.)

## Impact

- `client/src/pages/DictionaryPage.tsx` — rewritten around list-first navigation.
- New components under `client/src/components/` for the personal word list, filter bar and word detail.
- `client/src/lib/worddb.ts` — pinyin normalization, extended `searchWords`, new `getWords` batch lookup.
- `scripts/build-words-db.ts` — emits `pinyin_normalized`; requires `pnpm build:words-db` before the next deploy.
- `client/src/lib/firestore.ts` — `unmarkWordsKnown`, and a paged/queryable read over `users/{uid}/words`.
- `client/src/pages/StudyPage.tsx` — surgical removal of the two `markAsKnown` call sites and the now-unused callback/import.
- Downstream: graded readers will push encountered words into the same subcollection through the shared helper, so no reader-specific write path is needed.
