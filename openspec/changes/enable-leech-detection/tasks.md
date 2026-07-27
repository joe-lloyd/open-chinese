## 1. SRS Engine — Leech State

- [ ] 1.1 Widen the return type of `applyBinaryReview` in `client/src/lib/srs.ts` to `ReviewState & { response: Response; isLeech: boolean }` and include `isLeech` (from `updateLeechState`) in the returned object
- [ ] 1.2 Replace the no-op ternary at `srs.ts:105` (`consecutiveFails: isLeech ? review.consecutiveFails + 1 : consecutiveFails`) with plain `consecutiveFails` — both branches currently evaluate to the same value
- [ ] 1.3 Add exported `resolveStatus(intervalMeaning: number, intervalPinyin: number, intervalAudio: number, consecutiveFails: number): WordStatus` to `srs.ts` — returns `'Leech'` when `consecutiveFails > LEECH_THRESHOLD`, otherwise delegates to `deriveStatus`
- [ ] 1.4 Keep `LEECH_THRESHOLD` module-private (not exported) so `resolveStatus` remains the only way callers can test for leech state

## 2. SRS Engine — Scheduling Precision

- [ ] 2.1 Replace `nextReviewDate.setDate(nextReviewDate.getDate() + daysUntilNext)` at `srs.ts:94-95` with `const nextReviewDate = new Date(Date.now() + daysUntilNext * 86400000)`
- [ ] 2.2 Add a named `MS_PER_DAY = 86400000` constant in `srs.ts` and use it in the `nextReviewDate` computation

## 3. SRS Engine — Mastery Deduplication

- [ ] 3.1 Change the `Mastered` branch of `deriveStatus` (`srs.ts:57`) to `if (checkMastery(intervalMeaning, intervalPinyin, _intervalAudio)) return 'Mastered'`, removing the duplicated `> MASTERY_THRESHOLD` comparison
- [ ] 3.2 Confirm `checkMastery` is no longer dead by grepping for call sites; leave it exported for direct use and testing

## 4. Study Page Wiring

- [ ] 4.1 In `client/src/pages/StudyPage.tsx` `advance()`, replace the `deriveStatus(result.intervalMeaning, result.intervalPinyin, result.intervalAudio)` call at line 95 with `resolveStatus(result.intervalMeaning, result.intervalPinyin, result.intervalAudio, result.consecutiveFails)`
- [ ] 4.2 Update the `srs` import in `StudyPage.tsx` to pull in `resolveStatus`; drop `deriveStatus` from the import if it has no other use in the file
- [ ] 4.3 Verify `setUserWord` in `client/src/lib/firestore.ts` still writes an explicit field list (lines 96-112) so the new `isLeech` key on the spread result is not persisted as a stray Firestore field
- [ ] 4.4 Confirm the in-session re-queue block in `StudyPage.tsx` (lines 114-129) carries `result.consecutiveFails` onto the requeued `StudyCard` so a card that becomes a leech mid-session is not re-derived as `Weak`

## 5. Verification

- [ ] 5.1 Verify `pnpm --filter client build` completes with no TypeScript errors
- [ ] 5.2 Verify `pnpm --filter client lint` passes (oxlint) with no new warnings in `srs.ts` or `StudyPage.tsx`
- [ ] 5.3 Manually confirm a 9th consecutive double-fail on one word writes `status: 'Leech'` to `users/{uid}/words/{simplified}` in the Firestore console
- [ ] 5.4 Manually confirm the leeched word disappears from the due-mode queue built by `buildQueue` in `client/src/lib/session.ts` (exclusion at line 125) and from the dashboard due count
- [ ] 5.5 Manually confirm the leeched word appears in the dashboard leech panel (`client/src/pages/DashboardPage.tsx:47`, `client/src/components/LeechPanel.tsx`)
- [ ] 5.6 Manually confirm the panel's Reset button (`resetLeech`, `firestore.ts:205-213`) returns the word to `status: 'Weak'` with `consecutiveFails: 0` and that it reappears in the next due-mode queue build
- [ ] 5.7 Manually confirm a reviewed card whose smallest new interval is `6.25` days gets a `nextReviewDate` 6 days and 6 hours out, not 6 days out
