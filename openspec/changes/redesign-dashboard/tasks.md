## 1. Data layer

- [ ] 1.1 Add a `tsToDateOrNull` helper to `client/src/lib/firestore.ts` and a `WordAnalytics` interface (`totalReviews`, `correctMeaningCount`, `incorrectMeaningCount`, `correctPronCount`, `incorrectPronCount`, `hskLevel`, `firstSeenAt`, `lastReviewedAt`)
- [ ] 1.2 Extend `WordState` with `analytics: WordAnalytics` and map it in `getUserWord`, `getAllUserWords` and `getDeckWords` via a shared `dataToWordState` mapper, defaulting counters to 0 and timestamps to `null`
- [ ] 1.3 Add `LastReadPosition` and `normalizeLastRead(value: unknown): LastReadPosition | null` to `client/src/lib/firestore.ts`; extend `UserProfile` with `lastRead?: unknown` and confirm `upsertProfile` never clears it
- [ ] 1.4 Verify `pnpm --filter client build` still passes with the `WordState` shape change (existing consumers: `session.ts`, `DictionaryPage`, `QueuePage`, `HskPage`)

## 2. Chart theme

- [ ] 2.1 Add validated `--chart-*` custom properties to `client/src/index.css` under `:root` and `.dark`: the 5-step ordinal lifecycle ramp, categorical slots 1–2, status good/warning/critical, and chart ink/grid/surface roles
- [ ] 2.2 Create `client/src/lib/chartTheme.ts` exporting role-named constants (`LIFECYCLE_RAMP`, `SERIES_1`, `SERIES_2`, `STATUS_*`, `AXIS_TICK`, `GRID`, `TOOLTIP_STYLE`) that reference the CSS variables, plus a shared `ChartEmpty` message constant
- [ ] 2.3 Create `client/src/components/ChartFrame.tsx` (or equivalent) providing the fixed-height empty state so every chart's no-data case renders at the same height

## 3. Derived statistics

- [ ] 3.1 Create `client/src/lib/dashboardStats.ts` with pure functions and no imports from React, Firestore or the router
- [ ] 3.2 Implement `computeStreak(days, today)` returning `{ current, longest }`, counting backwards from today and falling back to yesterday when today has no reviews
- [ ] 3.3 Implement `computeForecast(words, now, days = 14)` bucketing due reviews by day, folding overdue into the first bucket and excluding `Mastered`, `Leech` and `Unstudied`
- [ ] 3.4 Implement `computeSkillSplit(words)` summing the pronunciation and meaning counters, returning `null` when there are no graded attempts
- [ ] 3.5 Implement `computeHskProgress(worddb, wordMap)` returning `{ level, studied, total, pct }[]` for every level present in the static DB
- [ ] 3.6 Implement `computeVelocity(days, now, weeks = 12)` summing `newCardsSeen` per week with zero-filled gaps
- [ ] 3.7 Implement `computeActivityTotals(days, now)` returning reviews today and reviews over the last 7 days

## 4. Recommendation engine

- [ ] 4.1 Create `client/src/lib/recommendations.ts` with `RecommendationContext`, `Recommendation`, exported threshold constants, and a `readerRoute()` helper
- [ ] 4.2 Implement the ten rules from design D4 as an ordered `RULES` array of `(ctx) => Recommendation | null`
- [ ] 4.3 Implement `recommend(ctx)`: run rules, drop nulls, sort by priority descending, de-duplicate by destination, slice to 3, and guarantee at least one result
- [ ] 4.4 Confirm the module has zero imports and that `now` is supplied on the context rather than read from the clock

## 5. Presentation components

- [ ] 5.1 Create `client/src/components/DashboardCard.tsx` — titled surface with one border/radius/padding treatment and an optional header action slot
- [ ] 5.2 Create `client/src/components/StatTile.tsx` — label, value (proportional figures), optional sub-line and tone
- [ ] 5.3 Create `client/src/components/NextUpPanel.tsx` — renders 1–3 `Recommendation`s as deep-linked cards with tone-driven accents
- [ ] 5.4 Create `client/src/components/ForecastChart.tsx` — 14-day column chart, slot-1 hue, overdue bucket in status-warning with a label, tooltip, no legend
- [ ] 5.5 Create `client/src/components/SkillSplit.tsx` — two labelled meters (pronunciation, meaning) using categorical slots 1 and 2 with visible values
- [ ] 5.6 Create `client/src/components/HskProgress.tsx` — per-level meter rows linking to `/study?hsk=N`
- [ ] 5.7 Create `client/src/components/LearningVelocityChart.tsx` — 12-week column chart, slot-1 hue, tooltip, no legend

## 6. Existing component updates

- [ ] 6.1 Repoint `LifecycleChart` at the ordinal lifecycle ramp, add the 2px surface gap between bars, cap bar thickness, and apply the shared tooltip/axis styling
- [ ] 6.2 Repoint `RetentionChart` at slot 1 and the shared axis/tooltip/grid styling; keep the 85–90% target band
- [ ] 6.3 Repoint `ActivityHeatmap` at the sequential chart ramp instead of `bg-accent` opacity steps, and keep its own `overflow-x-auto` container
- [ ] 6.4 Rework `DueSummary` so its three counters read correctly both as a full-width row and inside the `xl` rail without label truncation
- [ ] 6.5 Make `LeechPanel` rows wrap on narrow viewports so the three action buttons never overflow

## 7. Dashboard page

- [ ] 7.1 Rewrite the `DashboardPage` load path to fetch words, daily stats and the profile in one `Promise.all`, then derive all statistics through `dashboardStats.ts`
- [ ] 7.2 Build the `RecommendationContext` from the derived state and render `NextUpPanel` from `recommend(ctx)`
- [ ] 7.3 Implement the responsive shell: `max-w-[1600px]` container, header with hero streak figure, full-width Next up row, `xl:grid-cols-3` body with a `xl:col-span-2` primary region and a `md:grid-cols-2 xl:grid-cols-1` rail, and full-width leeches below
- [ ] 7.4 Place widgets per design D6 and verify no region exceeds its container at 375px, 768px, 1024px, 1280px and 1920px

## 8. Specs and verification

- [ ] 8.1 Run `pnpm --filter client build` and confirm zero TypeScript errors
- [ ] 8.2 Re-read the full diff for dead code, unused imports, comment spam and accidental scope creep into other branches' files
- [ ] 8.3 Confirm the dashboard still issues exactly three Firestore queries per load
- [ ] 8.4 Run `openspec validate --change redesign-dashboard --strict`
