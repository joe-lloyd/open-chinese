## Context

`buildQueue` (`client/src/lib/session.ts:35-154`) is the single entry point for every study session. It takes `{ hskLevel?, mode? }`, loads the user's whole `users/{uid}/words` collection via `getAllUserWords`, joins it against the static `words.db` through `worddb`, and returns at most `sessionSize` `StudyCard`s. Everything the queue manager exposes — deck priority, per-deck modes — has to enter the session through that one function or it does not exist.

Today it enters nowhere. `QueuePage` writes `deckPriority` to Firestore and `buildQueue` reads the same profile document (`session.ts:44`) but pulls only `dailyNewLimit` out of it. The per-deck mode select never leaves React state. There is no `deck` search param and no navigation from `/queue` to `/study`.

The data needed is already persisted. `users/{uid}.deckPriority` is a `{ deckName: index }` rank map written by `saveDeckPriority` (`firestore.ts:270-274`). Every word document carries `deckName` (`firestore.ts:107`), `status`, `easeFactor`, and `consecutiveFails` (`firestore.ts:99-104`). The static dictionary carries `deck_name` per row, so the Unstudied pool can be deck-filtered too. No schema migration is required by this change.

## Goals / Non-Goals

**Goals:**
- One deck-scoped session launch path: `/study?deck=<name>&mode=<mode>`, reachable from each deck row
- Deck priority is the primary ordering of a mixed (no `deck` param) due session
- All four queue-manager modes are implementable against data the app already writes
- Every requirement in the `queue-manager` spec that survives this change is true of the code after it

**Non-Goals:**
- Per-deck daily new-card limits, and surfacing `dailyNewLimit` in `SettingsPage` — the limit stays global
- Persisting a per-review response history (deliberately removed in commit `5986ae3`; not reintroduced)
- Multi-deck selection, deck creation/rename/delete outside CSV import
- Leech detection, the dashboard build break, pronunciation assessment

## Decisions

### D1: `deckName` is an option on `buildQueue`, not a separate function

`buildQueue(uid, sessionSize, { hskLevel?, deckName?, mode? })`. When `deckName` is present, every source is filtered to it: user word documents by `w.deckName === deckName`, and the Unstudied pool from `worddb` by `w.deck_name === deckName`.

**Why**: `hskLevel` already establishes the "optional scope filter" pattern in this function (`session.ts:51-55`, `101`, `111`, `121`, `145`). A second scope filter costs one predicate, shared by all five modes. A parallel `buildDeckQueue` would duplicate the toCard/toNewCard mapping and the daily-limit logic.

**Interaction with `hskLevel`**: both filters apply if both are given (intersection). No caller passes both today; the behaviour is defined rather than guarded.

### D2: Deck priority is a sort key, not a filter

Due cards are sorted by `rank(deckName)` ascending, then `nextReviewDate` ascending. `rank` reads `profile.deckPriority[deckName]`, defaulting unranked decks to a sentinel that sorts last — matching how `QueuePage.tsx:145` already defaults to `99` when rendering the deck list.

**Why**: A filter would starve low-priority decks entirely. A sort key means the `sessionSize` cap (`session.ts:131`) does the truncation, so a high-priority deck's backlog is drained first and lower decks appear once it is empty. This is what "presented first in a mixed review session" means in the requirement.

**Consequence, stated deliberately**: with a large enough backlog in deck rank 0, decks further down may not appear in a session at all. That is the intended meaning of priority, not a defect.

**Alternative rejected**: weighted interleave (e.g. 3 cards from rank 0 per 1 from rank 1). More code, harder to explain, and no user has asked for a mix.

### D3: Hard-Only is respecced against `consecutiveFails > 0`

The current spec says "last response was `Again` or `Hard`". No such field is persisted: `ReviewState` (`srs.ts:5-13`) has no response member, `setUserWord` (`firestore.ts:96-112`) writes none, and `Response` is internal to `srs.ts`. `applyBinaryReview` computes a `response` (`srs.ts:98-99`) and returns it, but `StudyPage` discards it.

Two ways out were considered:

1. **Persist `lastResponse` on every review.** Add it to `ReviewState`, write it in `setUserWord`, and filter on `lastResponse in ('Again','Hard')`.
2. **Respec against `consecutiveFails`** — already written on every review, already in every existing document.

**Chosen: option 2.** `consecutiveFails` is maintained by `applyBinaryReview` (`srs.ts:88-91`): it resets to `0` when the user knew *either* pinyin or meaning, and increments only when both were missed. So `consecutiveFails > 0` is exactly "the user's most recent review of this card was a full miss, and it has not been recovered since". That is a persisted, migration-free, already-correct signal.

**What this changes semantically, and why it is acceptable**: `consecutiveFails > 0` corresponds to a derived `Again`, not to `Again` *or* `Hard`. A partial miss (one subskill known — derived `Hard` at `srs.ts:99`) leaves no persisted trace at all: it resets `consecutiveFails` to `0` and leaves `easeFactor` untouched (`srs.ts:80-83` only lowers ease when both are missed). So option 1's "or `Hard`" half cannot be recovered from existing data under any predicate — it would only start working for reviews performed after the field is added, meaning Hard-Only would silently return an empty queue for every existing card until it is reviewed again. Option 2 works immediately against the whole collection. The requirement is reworded to describe the real signal rather than pretending to a distinction the binary study UI does not persist.

**Alternatives rejected**: `easeFactor < 2.5` — it is cumulative and never rises (`EASE_DELTA.Good === 0`, `srs.ts:22-27`), so it means "has ever fully failed", not "is currently failing"; a card missed once a year ago and answered correctly twenty times since would still match. `status === 'Weak'` — that is Refresh Weak's filter (`deriveStatus` buckets on interval length, `srs.ts:51-58`), and Hard-Only must not be a duplicate of it.

### D4: Refresh Weak and Hard-Only ignore `nextReviewDate` and never introduce new cards

Both are remedial modes over already-studied cards: they filter the user's word documents (`refreshWeak`: `status === 'Weak'`; `hardOnly`: `consecutiveFails > 0`), exclude `Unstudied`, ignore the schedule, sort by `easeFactor` ascending (hardest first), and cap at `sessionSize`.

**Why ignore the schedule**: the point of "refresh my weak cards" is to study them *now*, ahead of schedule. A due-date filter would make both modes return empty on the days the user most wants them.

**Why no new cards**: introducing unseen words into a remedial session contradicts the mode's name, and it would consume the global daily new-card allowance for a session the user did not intend as new-material study.

### D5: Cram includes `Unstudied`; Standard is the only mode bound by the daily new-card limit

Cram is respecced to match its existing requirement text — "all cards in the deck regardless of `nextReviewDate`" — which the implementation contradicts by excluding `Unstudied` (`session.ts:100`). Deck-scoped Cram returns every word document in the deck, any status, ordered by `easeFactor` ascending.

Only `due` (Standard) consults `dailyNewLimit`. `new` already bypasses it (`session.ts:110-116`), and `cram` never consulted it. `refreshWeak` and `hardOnly` introduce no new cards at all, so the question does not arise for them.

**Why**: a deliberate cram of a specific deck before a test is an explicit user instruction to see that deck's material; the daily pacing limit exists to stop *automatic* introduction of new words in a Standard session. Keeping the limit on exactly one mode also keeps the global-vs-per-deck limit question (out of scope here) confined to one branch.

### D6: Mode identity is the `StudyMode` string, everywhere

`QueuePage`'s local `Mode` type and `MODES` / `MODE_LABELS` tuple (`QueuePage.tsx:36-44`) use display-flavoured values (`'Standard'`, `'RefreshWeak'`) that do not match `StudyMode`. They are replaced by `StudyMode` values (`'due'`, `'refreshWeak'`, `'cram'`, `'hardOnly'`) with a label map for display, so the selected value can go straight into the URL, straight into Firestore, and straight into `buildQueue` with no translation table.

**Why**: three representations of the same concept (select value, URL param, `StudyMode`) is where wiring bugs live. `'Standard'` maps to `'due'`, which is the sort of mapping that gets written once and then diverges.

**Persistence shape**: `users/{uid}.deckModes: Record<string, StudyMode>`, alongside `deckPriority` on the same profile document, written by `saveDeckMode(uid, deckName, mode)` using a merged `setDoc` with a dotted field path so one deck's write cannot clobber another's — the same technique `saveDeckPriority` uses for the profile document (`firestore.ts:270-274`).

**Unknown values**: a `deck`/`mode` pair in the URL that does not parse to a known deck or a member of `StudyMode` falls back to `'due'` and to "all decks" respectively, rather than erroring — the URL is user-editable.

## Risks / Trade-offs

- **Low-priority decks can be starved** → intended (D2), but surprising if a user has one huge backlogged deck at rank 0. Mitigation: the queue manager shows per-deck due counts, so the backlog is visible; a per-deck Standard session bypasses priority entirely.
- **Hard-Only no longer means what the old spec said** → it now means "failed both subskills last time" (D3). Mitigation: the UI label stays "Hard Only" but the spec and the mode description in `SessionPicker` state the real rule; the alternative was a mode that returns nothing for months.
- **Cram including `Unstudied` can return a very large deck** → capped by `sessionSize` (50) like every other mode, but the ordering (`easeFactor` ascending, all Unstudied cards sharing the 2.5 default) makes which unstudied cards appear effectively arbitrary. Mitigation: acceptable for a cram session; studied cards sort ahead of unstudied ones anyway wherever ease has dropped.
- **`StudyMode` is used in an exhaustive `Record`** → widening the union breaks the build at `StudyPage.tsx:524-528` (`modeDesc`). That is a feature: the compiler names every site that must handle the new modes. Both new modes must be added there and to the `MODES` picker list (`StudyPage.tsx:496-500`).
- **No new Firestore index needed** → `buildQueue` already reads the full `users/{uid}/words` collection with `getAllUserWords` and filters in memory (`session.ts:43`). Deck filtering adds a predicate, not a query.
