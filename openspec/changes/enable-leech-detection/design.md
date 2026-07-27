## Context

`client/src/lib/srs.ts` is the pure SRS engine — no I/O, called from `StudyPage.advance()` and persisted through `client/src/lib/firestore.ts`. Four defects live in it today, all confirmed against the current code:

1. **Leech detection is computed then discarded.** `updateLeechState` (`srs.ts:60-66`) correctly returns `isLeech: consecutiveFails + 1 > 8`, and `applyBinaryReview` (`srs.ts:88-91`) destructures it — but the return object (`srs.ts:100-109`) drops `isLeech` on the floor. `StudyPage.tsx:95` then computes `status` from `deriveStatus`, whose only possible outputs are Unstudied/Weak/Strong/Memorized/Mastered (`srs.ts:51-57`). Consequently the only code path in the repo that ever writes `status: 'Leech'` is the manual `suspendWord` button (`firestore.ts:215-220`). The dashboard leech collection (`DashboardPage.tsx:47`) and `LeechPanel.tsx` are therefore permanently empty in normal use.
2. **Redundant no-op.** `srs.ts:105` reads `consecutiveFails: isLeech ? review.consecutiveFails + 1 : consecutiveFails`. On the only branch where `isLeech` can be true, `consecutiveFails` already equals `review.consecutiveFails + 1`, so both arms are identical.
3. **Fractional intervals truncated.** The interval requirements mandate FLOAT day intervals, and the SM-2 path produces values such as 6.25. `srs.ts:94-95` schedules with `nextReviewDate.setDate(nextReviewDate.getDate() + daysUntilNext)`; `Date.prototype.setDate` coerces its argument to an integer, so 6.25 becomes 6. Every review loses its sub-day component.
4. **Dead function.** `checkMastery` (`srs.ts:68-70`) has zero call sites repo-wide. `Mastered` is produced instead by the equivalent inline branch in `deriveStatus` (`srs.ts:57`) — two independent definitions of the same rule, one of them unreachable.

The downstream leech machinery already exists and works; it has simply never been fed. `session.ts:125` excludes `status === 'Leech'` from the due queue, `firestore.ts:205-213` resets a leech back to `Weak` with 1-day intervals and a due-now `nextReviewDate`, and `firestore.ts:215-220` suspends one for a year.

## Goals / Non-Goals

**Goals:**
- A word that fails both sub-skills 9 consecutive times is persisted with `status: 'Leech'` and disappears from the due queue
- One authoritative status resolver, so no caller can accidentally persist a status that ignores leech state
- One authoritative mastery predicate, with no dead duplicate
- `nextReviewDate` honours fractional day intervals to sub-day precision

**Non-Goals:**
- Changing the leech threshold (stays at `consecutiveFails > 8`) or the definition of a "fail" (still both sub-skills unknown)
- Changing the `calculateNewInterval` graduated-steps-vs-multiplier behaviour — that discrepancy between `srs.ts:37-41` and the spec is a deliberate open design question owned by a different change
- Any new UI: `LeechPanel.tsx` and the dashboard panel already render leeches once the data exists
- Auto-suspending, auto-deleting, or notifying on leeches — tagging only; remediation stays manual

## Decisions

### D1: `applyBinaryReview` returns `isLeech`

The result type becomes `ReviewState & { response: Response; isLeech: boolean }`. `isLeech` is the value already computed by `updateLeechState` for the new `consecutiveFails`.

**Why**: The information is computed one line above the return and thrown away. Returning it is the minimal fix and makes the leech transition observable to callers (persistence, history, future UI toast).

**Alternative**: Have `StudyPage` recompute the predicate from `result.consecutiveFails`. Rejected — it duplicates the threshold constant outside `srs.ts`.

### D2: `resolveStatus` is the single authoritative status resolver

New export in `srs.ts`:

```ts
export function resolveStatus(
  intervalMeaning: number,
  intervalPinyin: number,
  intervalAudio: number,
  consecutiveFails: number,
): WordStatus {
  if (consecutiveFails > LEECH_THRESHOLD) return 'Leech'
  return deriveStatus(intervalMeaning, intervalPinyin, intervalAudio)
}
```

`StudyPage.advance()` calls `resolveStatus` instead of `deriveStatus` when building the object handed to `setUserWord`.

**Why**: Leech is a lifecycle state that is orthogonal to interval length — a leech always has tiny intervals, so `deriveStatus` would happily label it `Weak` and put it straight back in the queue. Putting the precedence rule inside `srs.ts` means the threshold constant stays private and every caller gets the same answer. `deriveStatus` keeps its existing signature and semantics (pure function of intervals), so no other caller has to change.

**Alternative**: Add a fourth parameter to `deriveStatus`. Rejected — it changes an existing exported signature and conflates two concerns; the spec describes `deriveStatus` purely in terms of the interval minimum.

**Alternative**: Persist leech as a separate boolean field rather than a status value. Rejected — `session.ts`, `DashboardPage.tsx`, `HskPage.tsx`, and `getDeckSummaries` all already filter on `status === 'Leech'`, and Firestore documents already carry that value from `suspendWord`.

### D3: Leech state is cleared by any passing review

`updateLeechState` already resets `consecutiveFails` to 0 whenever either sub-skill is known, so `resolveStatus` naturally returns the interval-derived bucket again. A leech is only reachable for review via the manual **Reset** button (`resetLeech`, which zeroes `consecutiveFails` and sets `status: 'Weak'`) or cram mode (`session.ts` cram branch includes any status except `Unstudied`). Both paths therefore rehabilitate a leech automatically on the first successful review — no extra code.

### D4: Millisecond-based scheduling

Replace

```ts
const nextReviewDate = new Date()
nextReviewDate.setDate(nextReviewDate.getDate() + daysUntilNext)
```

with

```ts
const nextReviewDate = new Date(Date.now() + daysUntilNext * 86400000)
```

**Why**: `setDate` truncates its argument to an integer, so the spec-mandated float intervals (e.g. `1.0 × 2.5 × 2.5 = 6.25`) lose their fractional part on every single review. Millisecond arithmetic preserves it. 86 400 000 ms/day is a fixed constant — it ignores DST transitions, which is correct for a spaced-repetition interval (an interval is a duration, not a wall-clock date).

**Trade-off**: A card scheduled at 09:00 with a 1-day interval becomes due at 09:00 the next day rather than at midnight. This matches the existing due test (`nextReviewDate <= now`) and is standard SRS behaviour.

### D5: `deriveStatus` delegates the Mastered branch to `checkMastery`

`checkMastery` is kept, not deleted, and becomes reachable:

```ts
if (checkMastery(intervalMeaning, intervalPinyin, intervalAudio)) return 'Mastered'
```

**Why**: The two definitions are already numerically identical (`min(meaning, pinyin) > 180` ≡ `meaning > 180 && pinyin > 180`), so delegation is behaviour-preserving while eliminating the duplicate rule and the dead export. `checkMastery` is named in the srs-engine spec and is the natural home for the mastery predicate.

**Alternative**: Delete `checkMastery` and keep the inline comparison. Rejected — the spec states mastery in terms of `checkMastery`, and a named predicate is the more testable of the two.

## Risks / Trade-offs

- **Existing users have inflated `consecutiveFails`** → Words that already accumulated more than 8 fails will flip to `Leech` on their next double-fail review and vanish from the due queue. This is the intended behaviour finally working, and the dashboard Leech panel gives a one-click **Reset**. No backfill migration is performed; status is only recomputed on review.
- **Leeches leave the due queue permanently until manually handled** → A user who ignores the dashboard could silently stop seeing words they need. Mitigation: the dashboard leech panel is already surfaced on the home page, and cram mode still includes leeches.
- **Sub-day scheduling shifts due times off midnight** → Cards become due at the same clock time they were reviewed. Accepted; it is more accurate than truncation and no code depends on midnight boundaries (`dailyStats` keys off the review date, not the due date).
- **Return type of `applyBinaryReview` widens** → `StudyPage.advance()` spreads the whole result into `setUserWord`. `setUserWord` (`firestore.ts:96-112`) writes an explicit field list, so the extra `isLeech` key is ignored the same way the existing `response` key already is — but any future `setDoc(ref, state)` that spreads blindly would leak it. Mitigation: keep `setUserWord`'s explicit field list; do not switch it to a spread.
