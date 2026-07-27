## 1. Queue builder: deck scope and new modes

- [x] 1.1 Widen `StudyMode` in `client/src/lib/session.ts:33` to `'due' | 'new' | 'cram' | 'refreshWeak' | 'hardOnly'`
- [x] 1.2 Add `deckName?: string` to the `options` parameter of `buildQueue` (`session.ts:35-40`) and destructure it alongside `hskLevel` and `mode`
- [x] 1.3 Add a `matchesDeck(w)` predicate in `buildQueue` that returns `true` when `deckName` is undefined, else `w.deckName === deckName`; apply it to the `allUserWords` filters in the cram branch (`session.ts:99-103`) and the due branch (`session.ts:120-129`)
- [x] 1.4 Add the equivalent deck filter for the Unstudied pool: filter `worddb.getWordsByLevel(...)` / `worddb.getAllWords()` results by `w.deck_name === deckName` in the `new` branch (`session.ts:111-115`) and in the due branch's new-card top-up (`session.ts:145-149`)
- [x] 1.5 Read `profile.deckPriority` in `buildQueue` (the profile is already loaded at `session.ts:44`) into a `rank = (deck: string) => profile?.deckPriority?.[deck] ?? Number.MAX_SAFE_INTEGER` helper
- [x] 1.6 Replace the due-card sort at `session.ts:130` with a deck-priority-primary comparator: `rank(a.deckName) - rank(b.deckName)` first, `a.nextReviewDate.getTime() - b.nextReviewDate.getTime()` as tiebreaker
- [x] 1.7 Fix the cram branch (`session.ts:97-107`): remove the `w.status === 'Unstudied'` exclusion at `session.ts:100` so all cards in the deck are included; keep the `easeFactor` ascending sort and the `sessionSize` cap
- [x] 1.8 Add a `refreshWeak` branch before the due branch: filter `allUserWords` by `matchesDeck` and `w.status === 'Weak'`, ignore `nextReviewDate`, sort by `easeFactor` ascending, cap at `sessionSize`, map with `toCard(w, false)`
- [x] 1.9 Add a `hardOnly` branch: filter `allUserWords` by `matchesDeck`, `w.consecutiveFails > 0`, and `w.status !== 'Unstudied'`, ignore `nextReviewDate`, sort by `consecutiveFails` descending then `easeFactor` ascending, cap at `sessionSize`
- [x] 1.10 Confirm neither new branch calls `getNewCardsSeen` or touches `dailyNewLimit` — only the `due` branch (`session.ts:134-151`) consults the daily allowance

## 2. Persist per-deck mode selection

- [x] 2.1 Add `deckModes?: Record<string, StudyMode>` to the `UserProfile` interface in `client/src/lib/firestore.ts:33-39`, importing `StudyMode` as a type from `./session`
- [x] 2.2 Add `saveDeckMode(uid: string, deckName: string, mode: StudyMode): Promise<void>` to `firestore.ts`, writing `{ deckModes: { [deckName]: mode } }` to `doc(db, 'users', uid)` with `{ merge: true }`, following the `saveDeckPriority` pattern at `firestore.ts:270-274`
- [x] 2.3 Verify `saveDeckMode` writes only plain values (no `FieldValue` transforms mixed into the same `setDoc`), consistent with the separation established in commit `f1275f6`

## 3. Queue manager UI

- [x] 3.1 In `client/src/pages/QueuePage.tsx`, delete the local `MODES` / `Mode` / `MODE_LABELS` declarations (`QueuePage.tsx:36-44`) and replace them with a `MODE_OPTIONS: { value: StudyMode; label: string }[]` list covering `due` ("Standard"), `refreshWeak` ("Refresh Weak"), `cram` ("Cram"), `hardOnly` ("Hard Only")
- [x] 3.2 Retype the `mode` / `onModeChange` props of `SortableDeck` (`QueuePage.tsx:64-65`) and the `deckModes` state (`QueuePage.tsx:133`) from `Mode` to `StudyMode`
- [x] 3.3 Hydrate `deckModes` from `profile.deckModes` inside `loadDecks` (`QueuePage.tsx:140-147`), which already fetches the profile at `QueuePage.tsx:143`; default any deck with no saved mode to `'due'`
- [x] 3.4 Change the select's `onModeChange` handler (`QueuePage.tsx:226`) to call `saveDeckMode(uid, deck.deckName, m)` after updating local state
- [x] 3.5 Add a "Start session" button to the `SortableDeck` header row (`QueuePage.tsx:74-94`), next to the mode select, with `e.stopPropagation()` so it does not toggle the deck expansion or start a drag
- [x] 3.6 Wire the button to `useNavigate()` from `react-router-dom`, navigating to `/study?deck=${encodeURIComponent(deck.deckName)}&mode=${mode}`
- [x] 3.7 Update the page's helper text (`QueuePage.tsx:210`) to describe both drag priority and the per-deck start control

## 4. Study page wiring

- [x] 4.1 Read `const deck = searchParams.get('deck') ?? undefined` in `StudyPage.tsx:22-24` alongside `hsk` / `mode` / `minutes`
- [x] 4.2 Pass `deckName: deck` into the `buildQueue(uid, 50, { hskLevel, mode })` call at `StudyPage.tsx:48` and add `deck` to that effect's dependency array (`StudyPage.tsx:63`)
- [x] 4.3 Validate the `mode` param against the `StudyMode` union at `StudyPage.tsx:23`, falling back to `'due'` for unrecognised values
- [x] 4.4 Preserve the `deck` param when `SessionPicker` rebuilds the URL (`StudyPage.tsx:264-268`): add `if (deck) params.set('deck', deck)` before the `navigate` call
- [x] 4.5 Add `refreshWeak` and `hardOnly` entries to the exhaustive `modeDesc: Record<StudyMode, string>` in `SessionPicker` (`StudyPage.tsx:524-528`) — this is a compile error until done
- [x] 4.6 Add `refreshWeak` and `hardOnly` entries to the `MODES` picker list (`StudyPage.tsx:496-500`) with labels "Refresh Weak" / "Hard Only" and descriptions matching the spec ("Cards with status Weak, ignoring schedule" / "Cards you missed on your last review")
- [x] 4.7 Show the deck name in the `SessionPicker` empty state when `deck` is set, with a "← Back to queue" link to `/queue`, mirroring the existing HSK back-link at `StudyPage.tsx:538-540`

## 5. Verification

- [x] 5.1 Run `npx tsc -b` in `client/` and confirm a clean exit — in particular that every exhaustive `Record<StudyMode, …>` site compiles
- [ ] 5.2 Manually verify deck priority: drag a deck to position 1 in `/queue`, start a mixed session at `/study` with no `deck` param, and confirm the first cards come from that deck
- [ ] 5.3 Manually verify each mode from `/queue`: `due`, `refreshWeak`, `cram`, `hardOnly` on a deck, confirming the URL is `/study?deck=<name>&mode=<mode>` and the queue contents match the spec's filters
- [ ] 5.4 Manually verify mode persistence: select "Cram" on a deck, reload `/queue`, and confirm the select still reads "Cram"
- [ ] 5.5 Verify `hardOnly` returns a non-empty queue for a card that was just failed on both subskills, and drops it after a review where either subskill is answered correctly (`consecutiveFails` resets to 0)
- [ ] 5.6 Verify a deck-scoped `cram` session includes `Unstudied` cards from that deck
- [x] 5.7 Run `npx openspec validate wire-deck-targeted-study --strict` and confirm it passes
