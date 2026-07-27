## Why

The queue manager is a facade. Three of its four documented behaviours have no effect on what the user actually studies:

- **Targeted study modes are dead UI.** `client/src/pages/QueuePage.tsx:36` declares `MODES = ['Standard','RefreshWeak','Cram','HardOnly']` and renders a per-deck `<select>`. Its `onChange` writes `deckModes` state (`QueuePage.tsx:226`) which is read in exactly one place — to repopulate that same `<select>` (`QueuePage.tsx:225`). The selection is never persisted, never put in a URL, and never reaches the queue builder. QueuePage has no "start session" control and no link to `/study` at all, so a chosen mode cannot be acted on even in principle.
- **Deck priority never reaches a session.** Drag-reorder persists correctly (`QueuePage.tsx:171-182` → `saveDeckPriority`, `client/src/lib/firestore.ts:270-274`) and is re-read on load (`QueuePage.tsx:144-146`), but that is where it stops. `buildQueue` loads the profile (`client/src/lib/session.ts:44`) and consumes only `dailyNewLimit` (`session.ts:138`); due cards are sorted purely by `nextReviewDate` (`session.ts:130`). The spec sentence "priority order SHALL determine which deck's cards are presented first" is currently false.
- **`buildQueue` has no deck concept.** Its options are `{ hskLevel?, mode? }` (`session.ts:35-40`) and `StudyMode` is `'due' | 'new' | 'cram'` (`session.ts:33`). There is no deck parameter anywhere in the queue-building path, and no `refreshWeak` or `hardOnly` mode to select.

Two of the spec's own mode definitions are also wrong. **Cram** is specified as "all cards in the deck" but the implementation (`session.ts:97-107`) filters by `hskLevel` only and explicitly excludes `Unstudied` (`session.ts:100`). **Hard-Only** is specified as "last response was `Again` or `Hard`", but no last-response field is ever persisted: `ReviewState` (`client/src/lib/srs.ts:5-13`) carries only `lastSubskill`, `setUserWord` (`firestore.ts:87-126`) writes no response field, and `Response` is a transient type internal to `srs.ts`. As written, Hard-Only is unimplementable.

## What Changes

- Extend `StudyMode` to `'due' | 'new' | 'cram' | 'refreshWeak' | 'hardOnly'` and add a `deckName` option to `buildQueue`, so every mode can be scoped to a single deck
- Make `buildQueue` read `profile.deckPriority` and sort due cards by deck rank ascending as the **primary** key, with `nextReviewDate` ascending as the tiebreaker — deck priority finally decides what is presented first
- Add `refreshWeak` (cards with `status === 'Weak'`, ignoring `nextReviewDate`) and `hardOnly` to the queue builder
- **BREAKING (spec)** Respec Hard-Only from "last response was `Again` or `Hard`" to `consecutiveFails > 0` — the already-persisted signal for "the user missed both subskills on the most recent review". No schema change, no migration (see `design.md` D3)
- Fix deck-scoped Cram to match its own requirement: all cards in the deck regardless of `nextReviewDate` **and** regardless of status, including `Unstudied`, hardest (lowest `easeFactor`) first
- Persist the per-deck mode selection to `users/{uid}.deckModes` via a new `saveDeckMode` in `firestore.ts`; extend `UserProfile` with `deckModes?: Record<string, StudyMode>` and hydrate the selects from it on load
- Add a per-deck "Start session" button in `QueuePage` that navigates to `/study?deck=<name>&mode=<mode>`
- Read the new `deck` search param in `StudyPage.tsx:22-24` alongside the existing `hsk` / `mode` / `minutes`, pass it into `buildQueue`, and preserve it when `SessionPicker` rewrites the URL (`StudyPage.tsx:264-268`)
- Drop the "or created manually" clause from the Deck list view requirement — no code path creates a deck outside CSV import

## Capabilities

### New Capabilities

<!-- None. This change wires up an existing capability. -->

### Modified Capabilities

- `queue-manager`: **Deck list view** loses the unimplemented "or created manually" clause and gains the saved-priority ordering it already performs. **Drag-and-drop deck priority ordering** is restated to say exactly how priority enters the queue (primary sort key in `buildQueue`, ahead of `nextReviewDate`, unranked decks last). **Targeted study modes** is restated end to end: modes are persisted per deck, launched from a per-deck "Start session" control via `/study?deck=&mode=`, Cram is corrected to include `Unstudied` cards, and Hard-Only is redefined against `consecutiveFails > 0` so it is implementable against data the app already writes.

## Impact

- **Changed**: `client/src/lib/session.ts` — `StudyMode` union widened; `buildQueue` gains `deckName`; deck-rank sort added; `refreshWeak` and `hardOnly` branches added; cram branch made deck-scoped and status-inclusive
- **Changed**: `client/src/lib/firestore.ts` — `UserProfile.deckModes` added; `saveDeckMode(uid, deckName, mode)` added
- **Changed**: `client/src/pages/QueuePage.tsx` — local `Mode` / `MODES` / `MODE_LABELS` replaced by `StudyMode` values; mode selection persisted and hydrated; "Start session" button added per deck
- **Changed**: `client/src/pages/StudyPage.tsx` — reads the `deck` param, forwards it to `buildQueue`, preserves it on session restart, and extends the exhaustive `modeDesc: Record<StudyMode, string>` (`StudyPage.tsx:524-528`) and the `MODES` picker list (`StudyPage.tsx:496-500`), both of which fail to compile the moment `StudyMode` grows
- **Unchanged**: `saveDeckPriority` and the `deckPriority` document shape (`{ deckName: index }`) — already correct; only its consumer changes
- **Unchanged**: `srs.ts` — no new persisted field, no migration; Hard-Only reads `consecutiveFails`, which `setUserWord` already writes (`firestore.ts:103`)
- **Out of scope**: the **New cards per day limit** requirement is untouched. `dailyNewLimit` stays a single global value on the user profile — it is *not* made per-deck by this change, and it is still not exposed in `SettingsPage`. Deck-scoped Standard sessions draw new cards from the same global daily allowance; a per-deck limit and its settings UI belong to a separate change
- **Out of scope**: leech detection, the dashboard build break, and pronunciation assessment are each owned by their own change
