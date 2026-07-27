## Why

Leech detection is computed and then thrown away. `applyBinaryReview` calls `updateLeechState` and derives `isLeech`, but never returns it, and `StudyPage` sets word status purely from `deriveStatus` — which can only ever return Unstudied/Weak/Strong/Memorized/Mastered. No review can ever produce `status: 'Leech'`, so the dashboard's Leech panel is permanently empty and the whole leech feature is dead for every real user. The same function also truncates fractional intervals to whole days, silently discarding the sub-day precision the interval spec mandates.

## What Changes

- Return `isLeech` from `applyBinaryReview` and persist `status: 'Leech'` when a word crosses the threshold of 8 consecutive double-fails
- Add `resolveStatus(intervalMeaning, intervalPinyin, intervalAudio, consecutiveFails)` to `srs.ts` as the single authoritative status resolver — Leech takes precedence over the interval-derived bucket
- Fix `nextReviewDate` scheduling to preserve fractional days — millisecond arithmetic (`Date.now() + days * 86400000`) instead of `setDate(getDate() + days)`, which truncated 6.25 days to 6
- Remove the redundant no-op ternary on `consecutiveFails` in the `applyBinaryReview` return object (both branches evaluate to `consecutiveFails + 1`)
- Resolve the dead `checkMastery` function: `deriveStatus` SHALL call it for the Mastered branch instead of duplicating the `> 180` comparison inline, making `checkMastery` the single definition of mastery
- No change to the manual leech controls (`resetLeech`, `suspendWord`) or the queue exclusion in `session.ts` — both already work and are now reachable by automatic detection

## Capabilities

### New Capabilities

<!-- None — this change modifies existing behavior only. -->

### Modified Capabilities

- `srs-engine`: Leech detection now produces a persisted `Leech` status; `nextReviewDate` preserves sub-day precision; status resolution and mastery gain a single authoritative implementation.

## Impact

- **Changed**: `client/src/lib/srs.ts` — `applyBinaryReview` returns `isLeech`; new exported `resolveStatus`; `deriveStatus` delegates the Mastered branch to `checkMastery`; `nextReviewDate` computed by millisecond arithmetic
- **Changed**: `client/src/pages/StudyPage.tsx` — `advance()` uses `resolveStatus` instead of `deriveStatus` when writing `status` to Firestore
- **Unchanged (now reachable)**: `client/src/lib/session.ts` queue exclusion of `status === 'Leech'`; `client/src/lib/firestore.ts` `resetLeech` / `suspendWord`; `client/src/components/LeechPanel.tsx`; `client/src/pages/DashboardPage.tsx` leech collection
- **Out of scope**: the Good multiplier vs graduated learning steps discrepancy in `calculateNewInterval` (deliberate design question, handled separately); the dashboard `getHistory` build break and retention chart; the stale `POST /api/session/review` reference in the srs-engine spec
