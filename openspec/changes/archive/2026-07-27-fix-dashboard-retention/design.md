## Context

Commit `5986ae3` ("remove history, add mark-as-known, timer expiry + audio on fail") deleted the `users/{uid}/history/{autoId}` collection and its accessors `appendHistory` / `getHistory` from `client/src/lib/firestore.ts`. `DashboardPage.tsx` was not updated, so it still imports `getHistory` and still computes the retention series from per-review documents. The result is a hard TypeScript failure on the `/` route — the app has not compiled since that commit.

The per-review history collection was removed deliberately (one Firestore write per review, unbounded growth, no read path other than this chart). Reinstating it is not on the table. The replacement data already exists: `upsertDailyStats` (`firestore.ts:143-159`) increments `totalReviewed`, `correctCount` and `incorrectCount` on `users/{uid}/dailyStats/{date}` on every review, where "correct" is `finalKnewPron && finalKnewMeaning` (`StudyPage.tsx:96,110`). One document per day, already indexed by date, already fetched by the dashboard for the activity heatmap.

## Goals / Non-Goals

**Goals:**
- `npx tsc -b` in `client/` exits clean; `/` renders again
- Retention chart plots real data sourced from `dailyStats`, with no new Firestore reads
- The `dashboard` spec's retention wording matches what the app actually measures

**Non-Goals:**
- Restoring per-review history in any form
- Per-word or per-skill retention breakdowns (pinyin-only vs meaning-only)
- Backfilling retention for days reviewed before `correctCount` existed
- The lifecycle chart stacking / Unstudied-count defects and the `DueSummary` new-card cap — separate changes

## Decisions

### D1: Retention is sourced from `dailyStats`, not a review log

Retention for a day is `correctCount / totalReviewed * 100`, read from `users/{uid}/dailyStats/{date}`.

**Why**: The aggregate is already written on every review and already fetched by `DashboardPage` for the activity heatmap, so the chart costs zero additional Firestore reads. A daily bucket is exactly the granularity the chart plots — the old code's first act was to bucket history docs by `reviewedAt.slice(0,10)` anyway, so no information is lost at chart resolution.

**Alternative**: Reinstate `appendHistory` and query the last 30 days of review documents. Rejected — it re-adds a write per review and unbounded storage growth to serve a single 30-point line chart.

### D2: Retention means "knew both pinyin and meaning"

The spec's existing wording — "percentage of reviews answered Good or Easy (not Again or Hard)" — describes a four-button Anki-style rating this app does not have. `srs.ts:97-98` derives the response as `knewPronunciation && knewMeaning ? 'Good' : !knewPronunciation && !knewMeaning ? 'Again' : 'Hard'`; `Easy` is never produced. The study UI collects two booleans, not a 1–4 rating.

The `correct` flag written to `dailyStats` is `finalKnewPron && finalKnewMeaning` — identical to the `Good` branch. So the new definition is numerically the same measurement the old code intended (`h.response === 'Good'`), just stated in terms the app actually implements and read from a source that still exists.

### D3: Days with zero reviews are omitted, not plotted as 0%

A day the user did not study is an absence of data, not 0% retention. Plotting it as zero drags the line to the floor and makes the 85–90% target band useless.

In practice a `dailyStats` document only exists for days that had at least one review, so the filter is defensive: skip any document where `totalReviewed` is missing, zero, or otherwise non-positive. This also guards against a divide-by-zero producing `NaN` in the Recharts series.

**Alternative**: Interpolate across gaps. Rejected — invents data; a broken line correctly communicates "no study that day".

### D4: Widen `getDailyStats`, keep `count` for the heatmap

`getDailyStats` currently returns `{ date, count }` where `count` is `totalReviewed`. The fix returns `{ date, count, totalReviewed, correctCount, incorrectCount }` — `count` is retained verbatim so `ActivityHeatmap`'s prop shape (`{ date, count }[]`) and its existing call site need no change, while the retention computation reads the new fields.

Missing fields default to `0` (documents written before `5986ae3`, or by the pre-`11.4` `upsertDailyStats`, may lack `correctCount`). Under D3 such a day has `totalReviewed > 0` but `correctCount === 0`, which would plot a false 0%; treat a day as plottable only when `totalReviewed > 0` **and** the document actually carries a `correctCount` field.

### D5: 30-day window derived client-side from the 365-day fetch

`DashboardPage` already calls `getDailyStats(uid, 365)` for the heatmap. The retention series slices the last 30 days out of that same result rather than issuing a second query. This preserves the spec's "last 30 days" window with no extra read.

## Risks / Trade-offs

- **No pre-existing retention data** → `correctCount` was added in task `11.4` of `firebase-netlify-architecture`; days recorded before that have no correct/incorrect split. Mitigation: D4's field-presence check omits them rather than plotting them as 0%. The chart backfills naturally as the user studies.
- **Coarser granularity than history** → Per-review timestamps are gone, so intra-day retention or per-word retention can never be reconstructed from `dailyStats`. Accepted: no feature currently asks for it.
- **Sparse chart early on** → A user studying a few days a month gets a chart with few points. Accepted; still more informative than a permanent "No review history yet".
- **`correct` semantics are locked to the write path** → If the study flow ever adds a third skill or partial credit, `upsertDailyStats`'s `correct` boolean and this requirement must move together. Documented in the spec delta so the coupling is explicit.
