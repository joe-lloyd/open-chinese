## Why

The dashboard is capped at `max-w-5xl` with a `grid-cols-1 sm:grid-cols-2` layout, so on a desktop screen it renders a narrow column of widgets surrounded by empty space — the app is mobile-first but never grows into the width it is given. It also under-uses the data it already pays Firestore to read: every load already fetches the full `users/{uid}/words` collection and 365 days of `dailyStats`, yet only surfaces five numbers from it. And its only calls to action are three generic counters ("Due now", "New available", "Leeches") that say nothing about what *this* learner should do next.

## What Changes

- **Responsive layout.** Replace the single narrow column with a mobile-first layout that progressively expands: stacked at base, two-up at `md`, and a two-region grid (main content + rail) at `xl`, widening the page shell from `max-w-5xl` to a `max-w-[1600px]` container. No horizontal page scroll at any breakpoint; wide content (heatmap) scrolls inside its own container.
- **New derived statistics**, all computed from the data the dashboard *already* fetches — zero additional per-word reads:
  - current and longest study streak, plus reviews today and this week
  - 14-day upcoming review workload forecast (bucketed from `nextReviewDate`)
  - pronunciation-vs-meaning accuracy split (aggregated from per-word `correctPronCount` / `correctMeaningCount`)
  - HSK level progress across the levels present in the static word DB
  - new words learned per week over the last 12 weeks (from `dailyStats.newCardsSeen`)
- **Personalized calls to action.** A rule-based recommender (`client/src/lib/recommendations.ts`) scores a fixed set of candidate actions against the learner's current state and surfaces the top 1–3 as deep-linked cards — clear a backlog with a cram session, keep a streak alive, finish an almost-complete HSK level, tame accumulating leeches, continue an unfinished reader chapter, and so on. The rules are pure functions over a plain context object, not JSX conditionals.
- **`WordState` gains its analytics counters.** `getAllUserWords` currently drops `totalReviews`, `correctMeaningCount`, `correctPronCount`, `firstSeenAt` and `lastReviewedAt` when mapping documents. They are mapped through so the dashboard (and later consumers) can use them without a second read.
- **`UserProfile` gains an optional `lastRead` field**, consumed defensively by the "continue reading" recommendation. The `feat/graded-readers` branch owns writing it; until that lands the field is absent and the recommendation simply never fires.
- Charts are unified onto one visual system: a shared categorical palette keyed by lifecycle status, consistent axis/tooltip/grid treatment, and consistent empty states.

## Capabilities

### New Capabilities
- `dashboard-recommendations`: rule-based selection and ranking of personalized next-action CTAs from the learner's current SRS, activity and reading state, each deep-linking to a route that performs the action.

### Modified Capabilities
- `dashboard`: adds responsive layout requirements, a study-streak requirement, a review-workload forecast requirement, a skill-accuracy split requirement, an HSK progress requirement, a learning-velocity requirement, and a single-fetch read-budget requirement.
- `firestore-user-data`: `getAllUserWords` SHALL surface the per-word analytics counters it already stores; the user profile document gains an optional `lastRead` position field.

## Impact

- **Modified**: `client/src/pages/DashboardPage.tsx`, `client/src/lib/firestore.ts`, `client/src/components/DueSummary.tsx`, `client/src/components/LifecycleChart.tsx`, `client/src/components/RetentionChart.tsx`, `client/src/components/ActivityHeatmap.tsx`.
- **Added**: `client/src/lib/recommendations.ts`, `client/src/lib/dashboardStats.ts`, `client/src/lib/chartTheme.ts`, and dashboard presentation components (`DashboardCard`, `StatTile`, `NextUpPanel`, `ForecastChart`, `SkillSplit`, `HskProgress`, `LearningVelocityChart`).
- **No new dependencies**, no Firestore schema migration, and no change to the number of Firestore reads per dashboard load beyond one already-needed profile document.
- **Cross-branch**: `feat/graded-readers` must write `lastRead` to `users/{uid}`; `feat/personal-dictionary` also touches `client/src/lib/firestore.ts`.
