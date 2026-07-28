## Context

`DashboardPage.tsx` is a ~120-line component that fetches the whole word collection and a year of daily stats, derives five numbers, and renders them in a `max-w-5xl` column with a `grid-cols-1 sm:grid-cols-2` split. On a phone that is correct. On a 1440px display it is a ribbon of content with ~40% of the viewport unused.

Three constraints shape everything below:

1. **There is no server.** Every statistic is derived in the browser from Firestore documents and the static SQLite word DB.
2. **Firestore reads cost money and latency.** The page already reads the entire `users/{uid}/words` collection — one document per word the learner has touched. Any new statistic that needs another fan-out is not worth it.
3. **There is no test runner in the repo.** `client/package.json` has no `test` script and no test framework. "Testable" therefore has to mean *structurally* testable — pure, dependency-free functions — rather than "has tests".

## Goals / Non-Goals

**Goals:**
- A layout that is genuinely mobile-first and genuinely fills a desktop viewport, with real decisions at `md`, `lg` and `xl` rather than one `sm:` breakpoint.
- More statistics with **zero** additional Firestore reads beyond one profile document that is needed anyway.
- Personalized, deep-linked calls to action selected by readable rules living outside JSX.
- Charts that read as one system in both themes.

**Non-Goals:**
- Building the graded-readers feature. This change only *consumes* a `lastRead` field and degrades to nothing when it is absent.
- Introducing a test framework, a charting library swap, or a component library. Recharts and Tailwind stay.
- Real-time dashboard updates or Firestore aggregation queries (`count()`); the single-fetch-on-mount model is retained.
- Changing the SRS algorithm, status thresholds, or what a "due" card is.

## Decisions

### D1 — Derive everything from one fetch; add exactly one document read

The dashboard issues three queries and nothing else:

| Query | Feeds |
|---|---|
| `getDocs(users/{uid}/words)` | lifecycle counts, due count, leeches, forecast, skill split, HSK progress |
| `getDailyStats(uid, 365)` | heatmap, retention, streak, reviews today/this week, learning velocity |
| `getDoc(users/{uid})` | `dailyNewLimit`, `lastRead` |

Only the third is new, and it is a single document. Every added statistic is a fold over arrays already in memory, extracted into `client/src/lib/dashboardStats.ts` as pure functions.

*Alternative considered:* a maintained `users/{uid}/aggregates/dashboard` document updated on every review. Rejected — it doubles the write cost of the hot path (every single review) to save reads on a page visited far less often, and it introduces a consistency problem (a failed aggregate write silently corrupts the dashboard forever). The full-collection read already exists for the study queue, so the marginal cost here is zero.

*Alternative considered:* Firestore `getCountFromServer()` aggregation queries. Rejected — one aggregation query per statistic is *more* round trips than one collection read, and the collection read is needed anyway for the leech list and lifecycle chart.

### D2 — `WordState` carries its analytics counters

`getAllUserWords` currently discards `totalReviews`, `correctMeaningCount`, `incorrectMeaningCount`, `correctPronCount`, `incorrectPronCount`, `firstSeenAt` and `lastReviewedAt` when mapping. They are already in the snapshot; not mapping them is the only reason the pronunciation-vs-meaning split would need a second read. They are added to `WordState` as a nested `analytics` object with defaulted numbers and `Date | null` timestamps.

Timestamps map to `null` rather than `new Date(0)` — the existing `tsToDate` epoch fallback is right for `nextReviewDate` (epoch means "due now") but wrong for `firstSeenAt` (epoch would mean "first seen in 1970"). A separate `tsToDateOrNull` handles the analytics fields.

Nesting under `analytics` rather than flattening onto `WordState` keeps the change additive: `feat/personal-dictionary` is editing the same file and no existing field name moves.

### D3 — Streak counts backwards and forgives today

A naive "consecutive days including today" streak reads 0 every morning until the learner studies, which is exactly when the number should be motivating them. So the current streak walks backwards from today; if today has no reviews, it starts from yesterday instead. The streak only breaks once a full day has been skipped. Longest streak is the longest run anywhere in the fetched window.

Days are keyed by local-date string, not UTC, because the learner experiences "today" locally. The existing `getDailyStats` writes and queries `YYYY-MM-DD` keys derived from `toISOString()` (UTC); this change does not alter the write path, so streaks inherit that boundary. Fixing the UTC/local key mismatch app-wide is out of scope here and noted as a risk.

### D4 — Recommendations are scored rules over a plain context

`client/src/lib/recommendations.ts` exports:

```ts
export interface RecommendationContext { … }   // plain data, includes `now: Date`
export interface Recommendation { id, title, detail, cta, to, tone, priority }
export function recommend(ctx: RecommendationContext): Recommendation[]
```

Each rule is an entry in a `RULES` array: `(ctx) => Recommendation | null`. `recommend` maps over them, drops nulls, sorts by `priority` descending, de-duplicates by destination, and slices to three. There is a terminal fallback rule that always fires, so the panel is never empty.

The module imports nothing — no React, no Firestore, no router, no `Date.now()`. `now` is on the context. That makes it a pure function of its input, which is the only thing needed for a test file to be dropped in later without any harness beyond a runner.

*Alternative considered:* a weighted-scoring model where every rule always returns a score. Rejected as over-engineering for eight rules; a rule that does not apply returning `null` is far more readable, and the priority constants are visible in one place.

*Alternative considered:* rules living in the component as `{cond && <Card/>}`. Rejected — this is the thing the brief explicitly asked to avoid, and ordering/dedupe logic cannot be expressed that way.

Rule set and priorities (higher wins):

| Priority | Rule | Fires when | Destination |
|---|---|---|---|
| 100 | `first-steps` | no words studied at all | `/hsk` |
| 90 | `backlog-cram` | due ≥ 100 | `/study?mode=cram&minutes=15` |
| 80 | `streak-at-risk` | streak ≥ 2, nothing reviewed today, local hour ≥ 17 | `/study?minutes=5` |
| 70 | `due-review` | due > 0 | `/study` |
| 60 | `leeches` | leeches ≥ 5 | `/study?mode=hardOnly` |
| 50 | `continue-reading` | valid `lastRead` present | `/readers/{readerId}/{chapterId}` |
| 40 | `finish-hsk-level` | a level ≥ 70% and < 100% studied | `/study?hsk=N&mode=new` |
| 30 | `refresh-weak` | ≥ 20 Weak words and nothing due | `/study?mode=refreshWeak` |
| 20 | `learn-new` | nothing reviewed today and nothing due | `/study?mode=new` |
| 10 | `keep-going` | terminal fallback | `/study` |

`backlog-cram` outranks `due-review` and both resolve to `/study`-family routes; the dedupe key is the full destination string, so `/study?mode=cram&minutes=15` and `/study` are distinct entries — deliberate, since they are genuinely different sessions. Rules that would produce an identical destination collapse to the highest priority one.

### D5 — `lastRead` is read defensively from the profile document

`feat/graded-readers` owns writing it. This change only defines the shape and reads it:

```ts
export interface LastReadPosition {
  readerId: string
  chapterId: string
  readerTitle?: string
  chapterTitle?: string
  progress?: number        // 0..1
  updatedAt?: Date
}
```

stored at `users/{uid}.lastRead`. A `normalizeLastRead(value: unknown): LastReadPosition | null` guard rejects anything that is not an object with non-empty string `readerId` and `chapterId`, and rejects `progress >= 1` (finished). Until the readers branch lands, the field is absent, the guard returns `null`, and the rule never fires — no error, no placeholder card. The route `/readers/{readerId}/{chapterId}` is the contract to confirm at merge time; it is produced by a single `readerRoute()` helper so retargeting is a one-line change.

### D6 — Layout: stack → two-up → main + rail

| Breakpoint | Layout |
|---|---|
| base | one column, every widget full width |
| `sm` | stat tiles go 2-up |
| `md` (≥768) | recommendation cards 2-up; secondary widgets 2-up; charts 2-up |
| `lg` (≥1024) | recommendation cards 3-up; roomier padding and gaps |
| `xl` (≥1280) | page splits into a `col-span-2` primary region and a 1-column rail; rail widgets return to a single column |

Container widens from `max-w-5xl` to `max-w-[1600px] mx-auto`. Regions:

- **Header** — title, hero streak figure.
- **Next up** — 1–3 recommendation cards, full width, `md:grid-cols-2 lg:grid-cols-3`.
- **Primary (xl: 2/3)** — stat tile row, activity heatmap card, then retention + forecast side by side at `md`.
- **Rail (xl: 1/3)** — due/new/leech counters, lifecycle chart, skill split, HSK progress. At `md`/`lg` this region sits below the primary and lays itself out 2-up so it does not become a long thin ribbon.
- **Leeches** — full width below the grid, because its rows have three action buttons and cramping them into a 1/3 rail forces truncation.

The `md`-and-below rail behaviour (`md:grid-cols-2 xl:grid-cols-1`) is the piece that makes tablet widths not look broken; a plain `xl:col-span-1` would leave four half-height cards stacked on a 1024px screen.

### D7 — One chart system, colors chosen by the data's job

Colors were selected by job and **validated with the dataviz palette validator against this app's actual chart surface** (`--color-surface-raised`: `#f8f9fa` light, `#1f2937` dark), not eyeballed.

- **Lifecycle status is ordinal, not categorical.** `Unstudied → Weak → Strong → Memorized → Mastered` is a progression; reordering it would change its meaning. It therefore takes a **one-hue ramp with monotone lightness** so the progression is visible in the color itself, replacing today's arbitrary gray/red/amber/blue/green. This also stops "Weak" wearing the danger red that "Leech" should own.
  - light: `#86b6ef #5598e7 #2a78d6 #1c5cab #104281` — validator: all ordinal checks PASS (light-end 2.00:1 vs surface).
  - dark: `#256abf #3987e5 #6da7ec #9ec5f4 #cde2fb` — anchor flips; all checks PASS (light-end 2.72:1). The first attempt at the dark ramp (`#184f95`…) **FAILED** the 2:1 light-end floor at 1.81:1 against this app's lighter `#1f2937` surface and was re-stepped — which is exactly why the surface must be passed to the validator rather than assumed.
- **Skill split is categorical, two series** (pronunciation vs meaning): slots 1 and 2 — `#2a78d6`/`#eb6834` light, `#3987e5`/`#d95926` dark. Validator with `--pairs all`: all checks PASS in both modes (worst CVD ΔE 24.7 light / 26.8 dark).
- **Single-series charts take slot 1 and no legend** — retention line, forecast bars, velocity bars, heatmap intensity. The title names the series; a one-swatch legend box would restate it.
- **Leech is status, not a series** — `#d03b3b` (critical), always with a label, never color alone. Overdue-today in the forecast wears `#fab219` (warning) with a label, per the fixed status scale.

These land in `client/src/index.css` as `--chart-*` custom properties defined once under `:root` and overridden under `.dark`, mirroring how the existing design tokens work, and are surfaced to TS via `client/src/lib/chartTheme.ts` so Recharts `fill`/`stroke` props reference roles rather than hex.

Mark specs applied uniformly: 2px lines with no per-point dots, ≤24px bar thickness with 4px rounded data-ends, hairline recessive gridlines, area fills at ~10% opacity, tooltips on every chart, and a consistent `No data yet` empty state at a fixed height so cards do not jump.

### D8 — Small shared presentation primitives, not a component framework

`DashboardCard` (title + optional action + body, one border/radius/padding treatment) and `StatTile` (label + value + optional sub) are extracted because they are each used 5+ times and the alternative is copy-pasting the same `bg-surface-raised border border-border rounded-2xl p-4` string a dozen times and having it drift. Nothing else is abstracted; the individual widgets stay concrete components.

## Risks / Trade-offs

- **Date keys are UTC, streaks are experienced locally** → `dailyStats` documents are keyed by `toISOString().slice(0,10)` today, so a learner studying at 23:00 UTC-5 writes to "tomorrow". This change does not make it worse and does not fix it; it is called out here so the streak number's edge case is known. Fixing it means a migration of existing day keys and belongs in its own change.
- **Full-collection read stays O(words)** → unchanged from today, and unavoidable without a maintained aggregate. Acceptable while a learner's studied vocabulary is in the low thousands; if it grows past that, D1's rejected aggregate-document option becomes the right answer.
- **Recommendation thresholds are guesses** → 100 due for "backlog", 5 leeches, 70% for "nearly complete", 17:00 for "evening". They are exported as named constants in one block so they can be tuned in one place once there is real usage data.
- **`lastRead` contract is unverified until `feat/graded-readers` merges** → the field name, the profile-document location, and the `/readers/{readerId}/{chapterId}` route are all asserted by this branch, not agreed. Mitigation: the guard returns `null` for anything unexpected so a mismatch degrades to a missing card rather than a crash, and the route is built in one helper.
- **No automated tests** → the recommender is pure and side-effect free, so the risk is bounded to "the rules were reasoned about, not executed". Adding `vitest` was considered and rejected for this change: it would add a devDependency and a `pnpm-lock.yaml` churn across five branches currently rebasing on the same base, for a payoff that is better taken as its own change once the parallel work has merged.
- **Rail content at `md` is a compromise** → a 2-up rail below the primary region means the lifecycle chart and skill split are half-width on tablets, which is tighter than ideal for the lifecycle chart's five x-axis labels. Mitigated by short status labels and a 12px tick size; if it still crowds, the lifecycle chart is the one to promote to full width at `md`.
