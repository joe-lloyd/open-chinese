## 1. Widen the daily stats read path

- [x] 1.1 Change the return type of `getDailyStats` in `client/src/lib/firestore.ts:166` from `{ date: string; count: number }[]` to `{ date: string; count: number; totalReviewed: number; correctCount: number; incorrectCount: number }[]`
- [x] 1.2 Map `correctCount` and `incorrectCount` out of each document in the `snap.docs.map` at `firestore.ts:176-179`, defaulting each to `0`; keep `count` populated from `totalReviewed` so `ActivityHeatmap`'s existing `{ date, count }[]` prop shape is unchanged
- [x] 1.3 Include a `hasCorrectCount` boolean (or equivalent presence flag) in each row so days written before `correctCount` existed can be distinguished from days with genuinely zero correct answers

## 2. Fix the DashboardPage build break

- [x] 2.1 Remove `getHistory` from the import at `client/src/pages/DashboardPage.tsx:2`, leaving `getAllUserWords` and `getDailyStats`
- [x] 2.2 Remove `getHistory(uid, 30)` from the `Promise.all` at `DashboardPage.tsx:28-33` and drop the now-unused `history` binding
- [x] 2.3 Add an explicit type annotation to the `filter` callback parameter at `DashboardPage.tsx:58` (`allWords.filter((w: UserWord) => …)`) to clear `TS7006`

## 3. Recompute retention from daily aggregates

- [x] 3.1 Delete the `byDate` history-bucketing loop and the `retention` map at `DashboardPage.tsx:61-72`
- [x] 3.2 Build the retention series from the existing `getDailyStats(uid, 365)` result: slice to the last 30 days, and for each day emit `{ date, rate: Math.round((correctCount / totalReviewed) * 100) }`
- [x] 3.3 Filter out any day where `totalReviewed <= 0` or the `correctCount` field is absent, so zero-review days are omitted rather than plotted at 0% and no `NaN` reaches Recharts
- [x] 3.4 Verify `RetentionChart` needs no change — its `{ date, rate }[]` prop and the 85–90% `ReferenceArea`/`ReferenceLine` band at `RetentionChart.tsx:37-39` already satisfy the requirement

## 4. Verify

- [x] 4.1 Run `npx tsc -b` in `client/` and confirm it exits 0 with no `TS2305` or `TS7006` errors
- [x] 4.2 Run `pnpm --filter client build` and confirm the production build completes
- [ ] 4.3 Load `/` signed in with at least two days of review data and confirm the retention chart renders points instead of "No review history yet"
- [ ] 4.4 Confirm a day with no reviews leaves a gap in the line rather than a 0% point
- [x] 4.5 Run `npx openspec validate fix-dashboard-retention --strict` and confirm it passes
