## Why

The app does not build. `client/src/pages/DashboardPage.tsx:2` imports `getHistory` from `../lib/firestore`, but commit `5986ae3` deleted `appendHistory`/`getHistory` along with the per-review history collection. `npx tsc -b` in `client/` fails with `TS2305: Module '"../lib/firestore"' has no exported member 'getHistory'` and `TS7006: Parameter 'w' implicitly has an 'any' type`. `DashboardPage` is the `/` route (`client/src/App.tsx:23`), so the landing page is dead and no deploy can succeed.

Even once it compiles, the retention chart has no data source: `DashboardPage.tsx:61-72` derives `retention` by bucketing history documents that no longer exist, so `RetentionChart.tsx:17-19` short-circuits to "No review history yet" forever. The data needed to fix it is already being written — `upsertDailyStats` (`client/src/lib/firestore.ts:143-159`) records `correctCount`, `incorrectCount` and `totalReviewed` per day at `users/{uid}/dailyStats/{date}` — but `getDailyStats` (`firestore.ts:166-180`) throws those fields away and returns only `{ date, count }`.

## What Changes

- **BREAKING** Remove the `getHistory` import and the history-derived retention computation from `DashboardPage.tsx`; the per-review history collection is gone and is not coming back
- Widen `getDailyStats` to return `{ date, count, totalReviewed, correctCount, incorrectCount }` instead of discarding the aggregate fields
- Compute retention on the dashboard as `correctCount / totalReviewed * 100` per day from the daily aggregates, over a rolling 30-day window
- Skip days with `totalReviewed === 0` rather than plotting them as 0% retention
- Fix the implicit `any` on the `allWords.filter((w) => …)` callback at `DashboardPage.tsx:58`
- Restate the retention requirement in the `dashboard` spec: retention is the percentage of reviews where the user knew **both** pinyin and meaning, not "answered Good or Easy". The app has no four-button Anki rating — `client/src/lib/srs.ts:97-98` only ever derives `Good | Hard | Again` and never `Easy`, and the study UI (`StudyPage.tsx:96,110`) is binary knew-pinyin / knew-meaning
- Restore `npx tsc -b` to a clean exit in `client/`

## Capabilities

### New Capabilities

<!-- None. This change fixes an existing capability. -->

### Modified Capabilities

- `dashboard`: The **Retention rate line chart** requirement is rewritten. Retention is redefined from "percentage of reviews answered Good or Easy (not Again or Hard)" to "percentage of reviews where the user knew both pinyin and meaning", and its source is changed from the deleted per-review history collection to the `users/{uid}/dailyStats/{date}` aggregates. Days with zero reviews are omitted from the series.

## Impact

- **Changed**: `client/src/pages/DashboardPage.tsx` — drop `getHistory` import, replace the `byDate` history loop with a map over daily stats, annotate the `filter` callback parameter
- **Changed**: `client/src/lib/firestore.ts` — `getDailyStats` return type widened to include `totalReviewed`, `correctCount`, `incorrectCount`
- **Unchanged**: `client/src/components/RetentionChart.tsx` — its `{ date, rate }[]` prop shape and the 85–90% target band (`RetentionChart.tsx:37-39`) already match the new requirement
- **Unchanged**: `upsertDailyStats` and the `StudyPage` write path — the correct/incorrect counters are already written on every review
- **Out of scope**: the vocabulary lifecycle chart not being stacked and its dictionary-wide Unstudied count; the `DueSummary` new-card count ignoring `dailyNewLimit`. Both are real defects but are deferred to separate changes so this one stays a build fix.
