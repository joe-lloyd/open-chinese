## Context

`DictionaryPage.tsx` is a two-pane search UI: type a query, `worddb.searchWords` runs a four-column `LIKE %q%` against the static SQLite corpus, pick a result, see definition + character breakdown + notes. Nothing in the page reflects the user's own vocabulary; the only per-user read is a single `getUserWord` for the selected result.

The user's vocabulary already exists in Firestore at `users/{uid}/words/{simplified}` with everything the personal view needs (`status`, `totalReviews`, `correctMeaningCount`, `firstSeenAt`, `lastReviewedAt`, `hskLevel`, `deckName`). It is simply never surfaced as an inventory.

Separately, `StudyPage.tsx` renders a "Mark as fully known →" link under the grade buttons in two of the four phases. Because it only exists in those two phases, the button block changes height mid-card, and there is no undo. The action itself is worth keeping; the placement is not.

Constraints: no server, sql.js in the browser over a CDN-hosted `words.db`, Firestore accessed directly from the client. Four other branches are editing the same tree, so the footprint outside `DictionaryPage.tsx` must stay small.

## Goals / Non-Goals

**Goals:**
- Dictionary opens on the user's own words, not an empty search box.
- Per-word signal at a glance: status, knowledge %, HSK level, deck, last reviewed.
- Filter by status / HSK level / deck, sort by several keys, stay responsive at a few thousand words.
- Search that finds 朋友 from `friend`, `朋友`, `朋友` (traditional), `péngyou`, `pengyou`, `peng you` and `peng2you3`, and says whether the word is already yours.
- Mark-as-known (single + bulk) and unmark live in the dictionary; the study session loses the control.
- A single write helper that graded readers can call to push encountered words into the same subcollection.

**Non-Goals:**
- Editing the static corpus, or adding user-authored words (CSV import already owns that).
- Real-time sync / live listeners — the page loads on mount and mutates optimistically.
- Reader-side integration itself. Only the helper and its contract.
- Touching the deck-scoped bulk "Mark as Known" in `QueuePage`; it stays.

## Decisions

### Load the whole `words` subcollection once, filter and sort in memory, paginate the rendered slice

Firestore cursor pagination (`orderBy` + `startAfter`) would need a composite index per (equality filter set × sort key) combination. With three independent filters and five sort keys that is a combinatorial index problem for a feature whose whole point is arbitrary slicing — and there is no server to manage index deploys behind.

The rest of the app already reads the full subcollection on every relevant page (`session.buildQueue`, `HskPage`, `getDeckSummaries` all call `getAllUserWords`), so this adds no new order of read cost. At a few thousand docs a single `getDocs` is one round trip; filtering and sorting a few thousand plain objects is sub-millisecond.

What actually has to be bounded is the DOM. The list renders one page of 50 rows at a time with prev/next and a result count. Pagination over virtualization: it is a handful of lines, has no scroll-restoration or measurement pitfalls, adds no dependency, and pairs naturally with a filter bar that shrinks the result set anyway.

*Alternative rejected:* `@tanstack/react-virtual`. A new dependency and a scroll container to babysit, for a list that is already filtered down most of the time.

### Join Firestore docs against `words.db` via a batched `getWords(simplifieds)`

User word documents carry no pinyin or definition. `getAllWords()` + a `Map` would work but pulls every column of the entire corpus to answer a lookup for a subset. Instead `worddb` gains `getWords(simplifieds: string[]): Word[]`, a chunked `WHERE simplified IN (...)` (chunks of 500, SQLite's default parameter ceiling is 999). It is the primitive the personal list wants, and the one graded readers will want when they render a page of text.

Words imported from CSV are not in `words.db`; the join falls back to the document's own `customWordData`, exactly as `session.toCard` and `QueuePage` already do.

HSK level likewise prefers the joined `hsk_level` and falls back to the stored `hskLevel` field, because `hskLevel` is only written on review and older documents predate it.

### Normalized pinyin as a build-time column, not a query-time transform

`pinyin` in the corpus is tone-marked (`péngyou`, `Běijīng`). Matching a toneless query against it requires normalizing every row, which cannot be done inside SQLite without a custom function.

`scripts/build-words-db.ts` therefore writes a `pinyin_normalized` column (indexed) and the client normalizes the query with the same function before a `LIKE` against it. Both sides use one shared implementation, `normalizePinyin`, exported from `worddb.ts` so the build script and the client cannot drift:

1. `NFD` decompose, then drop combining marks `U+0300–U+036F`. NFD is recursive, so `ǜ` → `u` + two combining marks → `u`; tone marks and the umlaut both vanish in one step.
2. Lowercase.
3. `v` → `u` (for people who type `lv` for `lǜ`).
4. Strip tone digits `1–5` and every separator: spaces, apostrophes, hyphens, middle dots.

`péngyou`, `pengyou`, `peng you`, `peng'you`, `peng2you5` and `PENGYOU` all collapse to `pengyou`, which is exactly the stored value for 朋友. Tone digits are stripped as `[0-5]`, not `[1-5]`, because the neutral tone is written either `you5` or `you0`.

The column is a strict addition to the schema. Note that `client/public/words.db` is **tracked in git** despite the `*.db` rule in `.gitignore` — it was committed before that rule was added, so the rule has no effect on it — which means the regenerated binary has to be committed alongside this change. `netlify.toml` also runs `pnpm build:words-db` before `vite build`, so the deployed file is rebuilt regardless; the tracked copy is effectively redundant. Untracking it (`git rm --cached`) is the tidier end state but is out of scope here.

*Alternative rejected:* an FTS5 virtual table. Heavier `words.db`, and substring-in-the-middle matching (`engyo`) is what FTS is worst at.

### Rank search results in SQL, one query

`searchWords` scores each row with a `CASE` and orders by score, then HSK level, then simplified, `LIMIT 50`:

| score | match |
| --- | --- |
| 0 | exact `simplified` or `traditional` |
| 1 | `simplified`/`traditional` prefix |
| 2 | exact `pinyin_normalized` |
| 3 | `pinyin_normalized` prefix |
| 4 | `definition` prefix |
| 5 | any remaining substring hit |

A hanzi query never produces a meaningful normalized-pinyin form, and a latin query never matches the hanzi columns, so the two paths do not interfere and a single query serves both. Results are annotated in the page (not in SQL) with the user's status from the already-loaded word map.

### `markWordsKnown` accepts seeds; `unmarkWordsKnown` restores due-now scheduling

Marking known from *search* can target a word with no Firestore document yet. The existing `markWordsKnown(uid, string[])` would `set(..., {merge:true})` a document with no `deckName` and no `hskLevel`, which then falls out of the dictionary's own deck and level filters. So the signature widens to `(uid, words: (string | WordSeed)[])` where `WordSeed = { simplified, deckName?, hskLevel? }`; plain strings still work, so `QueuePage` is untouched.

Unmarking cannot restore the intervals that mark-as-known overwrote — they were destroyed, not archived. Rather than invent a fake history, `unmarkWordsKnown` puts the word back at the front of the queue the same way `resetLeech` already does: intervals → 1, `status` → `Weak`, `nextReviewDate` → now, `easeFactor` untouched. That satisfies `buildQueue`'s due filter (`status !== 'Unstudied' && intervalMeaning > 0`) so the word reappears in the very next session, which is what "I don't actually know this" means.

*Alternative rejected:* snapshotting the pre-mastery state into the document so unmark could restore it. Extra fields on every mastered document to serve an undo that is nearly always used within seconds of the mistake.

### `ensureUserWords` is the shared write path — and the graded-readers integration point

```ts
export interface WordSeed { simplified: string; deckName?: string; hskLevel?: number | null }
export async function ensureUserWords(uid: string, seeds: WordSeed[]): Promise<string[]>
```

Creates a document at default SRS state (`status: 'Unstudied'`, intervals 0, ease 2.5, `firstSeenAt` server timestamp) for every seed that does not already have one, and returns the simplifieds it created. Existing documents are never touched — that is why it reads before writing rather than blind-merging, which would reset a mastered word to Unstudied.

Existence is checked with chunked `where(documentId(), 'in', chunk)` queries at 30 per chunk, then a single `writeBatch` per 500 creates.

The personal dictionary uses it for "Add to my dictionary" from a search result and as the pre-step when marking an unstudied word known. **Graded readers call the same function** with the words on a page — `{ simplified, deckName: 'Readers', hskLevel }` — and those words then appear in the personal dictionary with `firstSeenAt` set and `totalReviews` absent, which the knowledge-% renderer already treats as "not yet reviewed". No reader-specific collection, field or write path is needed.

### Page structure

`DictionaryPage` keeps its stacked-mobile / back-button shape and gains a `view` state of `'mine' | 'search'`, toggled by a segmented control above the left pane. `'mine'` renders the filter bar + paginated list; `'search'` renders the input + ranked results. Selecting a word in either mode opens the same detail pane. Three components split out of the page so it stays readable: `PersonalWordList`, `WordFilterBar`, `WordDetail`.

Multi-select is a per-row checkbox that only exists in `'mine'` mode, with an action bar (`n selected` · Mark as known · Unmark · Clear) sitting above the scroll container so it stays visible as the list scrolls — the same idiom `QueuePage` already uses for its deck word list, so nothing new to learn. Each row also carries its own mark-known / unmark toggle, so acting on one word does not require selecting it first. Mutations update local state in place; no refetch, with failures surfaced in a dismissible banner.

Selection is cleared when a filter changes, because filters change which words are reachable and a surviving selection could otherwise act on words the user can no longer see. Changing the sort keeps the selection, since it reorders the same set.

### The new-card pool keys off review history, not document existence

`ensureUserWords` writes a document at `status: 'Unstudied'` with zero intervals. `buildQueue` previously excluded every word that had *any* document from the new-card pool, while the due-review filter required `status !== 'Unstudied' && intervalMeaning > 0`. A word added but never studied therefore satisfied neither: not new, not due, reachable only through Cram.

The dead zone predates this change (CSV import can also produce `Unstudied` rows), but "Add to my dictionary" turns it into a button, so it has to be closed here. The fix belongs in `session.ts`, not in `ensureUserWords`: the bug is that `buildQueue` conflates "has a document" with "has been studied", and writing fake intervals to dodge that would corrupt the SRS state instead. The new-card pool is now keyed off `status !== 'Unstudied' || intervalMeaning > 0`.

*Alternative rejected:* having `ensureUserWords` not write a document at all until the word is first reviewed. Then an encountered word could not carry notes, `firstSeenAt`, or appear in the personal dictionary — which is the entire point of the helper.

### Colour tokens are stored as channel triplets

`StatusBadge` needs `bg-incorrect/10`-style tints. Tailwind v3 cannot apply an opacity modifier to a colour declared as a bare `var(--x)`: it cannot split the value into channels, so it drops the class entirely rather than emitting it without alpha. Every such class in the codebase — `bg-accent/10`, `border-incorrect/50`, `ring-incorrect/40` — was compiling to nothing.

Each colour is therefore stored once as an unwrapped `R G B` triplet (`--accent-rgb: 99 102 241`) which `tailwind.config.ts` consumes as `rgb(var(--accent-rgb) / <alpha-value>)`.

The wrapped `--color-*` variables are kept, now derived from the triplets (`--color-accent: rgb(var(--accent-rgb))`). About thirty call sites consume colours outside Tailwind — Recharts props, inline `style` objects, `accent-[var(…)]` arbitrary values — and converting the base variables to raw triplets would have broken every one of them. Deriving instead keeps a single source of truth per colour with no changes outside `index.css` and `tailwind.config.ts`. Because custom properties resolve at use time, `.dark` overrides only the triplets and the derived values follow.

## Risks / Trade-offs

- **Full-collection read on every Dictionary visit** → Same cost the Dashboard, HSK and Study pages already pay; one `getDocs` per page mount, not per interaction. If read volume ever matters, the fix is one shared cached loader across all five callers, not per-page pagination.
- **`pinyin_normalized` is absent until `words.db` is rebuilt** → `searchWords` would throw on a stale local file. `loadDB` probes the column once via `PRAGMA table_info(words)` and falls back to the old tone-marked `LIKE` when it is missing, so a stale file degrades instead of breaking. CI/Netlify run `build:words-db` before every build.
- **A few thousand rows filtered and sorted on every keystroke in the filter bar** → Filters are selects, not free text; the only free-text path is search, which is already debounced at 250 ms and runs in SQLite.
- **`StudyPage.tsx` conflicts with `feat/study-session-ux`** → The edit is deliberately minimal: two JSX blocks, one `useCallback`, one import member. Resolution is a delete-vs-delete or delete-vs-context conflict, trivially resolved in favour of the deletion.
- **`markWordsKnown` signature widening** → Additive union; every existing `string[]` call site keeps compiling and behaving identically.

## Migration Plan

1. `pnpm build:words-db` regenerates `client/public/words.db` with `pinyin_normalized`. The file is tracked in git (see the normalized-pinyin decision above), so the regenerated binary is committed with this change; Netlify also rebuilds it before every deploy.
2. No Firestore migration. Documents missing `hskLevel` or `totalReviews` render from the words.db join and as `—` respectively.
3. Rollback is a straight revert; nothing written by this change is unreadable by the previous code.

**Merge hazard:** `scripts/build-words-db.ts` assigns `words.id` with `randomUUID()`, so every rebuild produces a wholly different binary. Two branches that both regenerate `words.db` conflict irreconcilably on it. The resolution is to union the schema changes in the build script and rebuild exactly once, at merge time — not to merge the binaries.

## Open Questions

None blocking. Left deliberately open for a later change: whether the personal dictionary should also expose "study just these words" from a filtered selection, which overlaps `queue-manager`'s targeted-study modes and should be designed there rather than duplicated here.
