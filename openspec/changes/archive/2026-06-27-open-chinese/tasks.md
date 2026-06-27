## 1. Project Scaffolding

- [x] 1.1 Bootstrap Vite React TypeScript app in `client/` using `pnpm create vite@5.4.11 client --template react-ts`
- [x] 1.2 Bootstrap Hono API server in `server/` with TypeScript: `pnpm init` + install `hono@4.7.11`, `tsx@4.19.4`, `@hono/node-server@1.13.7`
- [x] 1.3 Install and configure Prisma with better-sqlite3 in `server/`: `prisma@5.22.0`, `@prisma/client@5.22.0`, `better-sqlite3@11.10.0`; create `server/prisma/schema.prisma` with all models
- [x] 1.4 Add root-level `package.json` with workspace scripts: `dev` (concurrently runs Vite + Hono), `db:push`, `db:studio`, `db:generate`; install `concurrently@9.1.2` at root
- [x] 1.5 Install Tailwind CSS in `client/`: `tailwindcss@3.4.19`, `postcss@8.5.15`, `autoprefixer@10.4.21`; init config with `darkMode: 'class'`
- [x] 1.6 Install client deps: `@dnd-kit/core@6.3.1`, `@dnd-kit/sortable@8.0.0`, `@dnd-kit/utilities@3.2.2`, `recharts@2.15.3`, `@radix-ui/react-dialog@1.1.6`, `@radix-ui/react-toast@1.2.6`, `next-themes@0.4.6`
- [x] 1.7 Install server deps: `papaparse@5.5.3`, `@types/papaparse@5.3.15`, `@types/better-sqlite3@7.6.13`; configure Hono CORS middleware for `localhost:5173`
- [x] 1.8 Configure Tailwind CSS custom property semantic tokens in `client/src/index.css`: `--color-surface`, `--color-surface-raised`, `--color-text-primary`, `--color-text-muted`, `--color-accent`, `--color-border` — mapped in both `:root` (light) and `.dark` (dark) selectors; extend tailwind.config to use these vars

## 2. Database Schema & SRS Engine

- [x] 2.1 Implement Prisma schema with `Word`, `Review`, `ReviewHistory`, `DeckPriority`, `DailyStats` models in `server/prisma/schema.prisma`; run `pnpm db:push` to generate SQLite file
- [x] 2.2 Write `server/src/lib/srs.ts` — pure functions: `selectSubskill(review)` returns the sub-skill with earliest due date; `calculateNewInterval(current, response, easeFactor)` applies Again/Hard/Good/Easy multipliers
- [x] 2.3 Write `adjustEaseFactor(current, response)` in `server/src/lib/srs.ts`: −0.15 for Hard, +0.15 for Easy, floor at 1.3
- [x] 2.4 Write `deriveStatus(intervalMeaning, intervalPinyin, intervalAudio)` in `server/src/lib/srs.ts`: maps interval thresholds to Unstudied/Weak/Strong/Memorized/Mastered per spec
- [x] 2.5 Write leech detection logic in `server/src/lib/srs.ts`: `updateLeechState(consecutiveFails, response)` — increments on Again, resets on Good/Easy, returns `{ isLeech: true }` when > 8
- [x] 2.6 Write `checkMastery(intervalMeaning, intervalPinyin, intervalAudio)` in `server/src/lib/srs.ts`: returns true when all three > 180 days
- [x] 2.7 Write unit tests in `server/src/lib/srs.test.ts` using Node's built-in `node:test` runner: interval math, ease factor clamping, leech threshold, mastery threshold, status derivation

## 3. CSV Import Pipeline

- [x] 3.1 Write `server/src/lib/import.ts`: parse Hack Chinese CSV with papaparse, validate required headers (`Simplified`, `Traditional`, `Pinyin`, `Definitions`, `List Name`, `Status`, `Next Review`), return typed row array with per-row errors
- [x] 3.2 Write `mapImportRow(row, importDate)` in `server/src/lib/import.ts`: status string → internal state, derive intervals from `nextReviewDate − importDate`, clamp negatives to 1.0, pin Mastered to 365
- [x] 3.3 Write `server/src/routes/import.ts` Hono route: `POST /api/import/preview` accepts multipart CSV, returns JSON summary (counts by status, error rows) — no DB writes
- [x] 3.4 Write `POST /api/import/confirm` Hono route in `server/src/routes/import.ts`: executes full import in a single Prisma transaction; skips duplicates by `simplified`; returns `{ imported, skipped, errors }`
- [x] 3.5 Build `client/src/pages/ImportPage.tsx`: file picker (drag-drop + click), calls `/api/import/preview`, shows preview table (status breakdown + error list), Confirm/Cancel buttons that call `/api/import/confirm`

## 4. Study Session

- [x] 4.1 Write `GET /api/session` Hono route in `server/src/routes/session.ts`: returns due cards (`nextReviewDate ≤ now`, status not Mastered/Leech) sorted by `nextReviewDate` asc, limited to `limit` query param (default 50)
- [x] 4.2 Write `POST /api/session/review` Hono route: accepts `{ wordId, subskill, response }`, calls SRS pure functions, updates `Review` row and `ReviewHistory`, updates `Word.status`, returns updated state
- [x] 4.3 Build `client/src/pages/StudyPage.tsx` client component: fetch session queue on mount, show card front (simplified + sub-skill prompt), handle Space-to-reveal
- [x] 4.4 Add card back to `StudyPage.tsx`: definition + pinyin + audio replay button; 1/2/3/4 keyboard handlers call `/api/session/review`; keys 1–4 blocked until reveal
- [x] 4.5 Add progress bar + session timer to `StudyPage.tsx`: `completed/total` fraction bar, elapsed seconds via `setInterval` cleared on unmount
- [x] 4.6 Add session completion summary screen in `StudyPage.tsx`: shown when queue exhausted; displays cards reviewed, accuracy % (Good+Easy / total), session duration

## 5. Audio Playback

- [x] 5.1 Write `client/src/lib/tts.ts`: wrapper around `SpeechSynthesisUtterance` with `lang=zh-CN`, reads `rate` and `pitch` from localStorage (defaults 0.8 / 1.0); graceful no-op if no zh-CN voice found
- [x] 5.2 Wire R key shortcut in `StudyPage.tsx` keydown handler to call `tts.speak(word.simplified)`
- [x] 5.3 Implement auto-play on card reveal in `StudyPage.tsx` when active sub-skill is `audio`
- [x] 5.4 Add audio replay button (speaker icon) to card back; accessible via click and R key
- [x] 5.5 Build `client/src/pages/SettingsPage.tsx` with rate/pitch sliders that write to localStorage; values read by `tts.ts` on each call

## 6. Pronunciation Assessment

- [x] 6.1 Write `server/src/lib/whisper.ts`: `transcribe(audioBuffer, targetPinyin)` — branches on `WHISPER_BACKEND` env var; calls OpenAI Whisper API with `language=zh` or invokes local whisper.cpp binary via `child_process.spawn`; returns raw transcription string
- [x] 6.2 Write `server/src/lib/tone-compare.ts`: `comparePinyin(transcribed, target)` — normalize diacritics to tone numbers (e.g. `péng` → `peng2`), split into syllables, compare each; return `Array<'correct' | 'incorrect' | 'unrecognized'>`
- [x] 6.3 Write `server/src/lib/whisper-cache.ts`: in-memory `Map<string, ToneResult>` keyed by `SHA-256(audioBytes) + ':' + targetPinyin`; `get(key)` / `set(key, result)` with 500-entry LRU cap
- [x] 6.4 Write `POST /api/pronounce` Hono route in `server/src/routes/pronounce.ts`: accept multipart audio blob, check cache, call `transcribe`, call `comparePinyin`, cache result, return per-syllable result array; apply 10s timeout with error response
- [x] 6.5 Build `client/src/components/PronunciationAssessor.tsx`: push-to-talk button using `MediaRecorder` API, visual recording pulse indicator, POSTs WAV blob to `/api/pronounce`, renders color-coded characters (green/red/yellow) below card
- [x] 6.6 Wire `PronunciationAssessor` into card back in `StudyPage.tsx`; on Whisper backend error show Radix toast and continue session normally

## 7. Dashboard

- [x] 7.1 Write `GET /api/dashboard` Hono route in `server/src/routes/dashboard.ts`: returns `{ dailyCounts: [{date, count}]` (365 days), `statusCounts: {Unstudied,Weak,Strong,Memorized,Mastered}`, `retention: [{date, rate}]` (30 days), `dueCount`, `newCount`, `leeches: Word[]` }`
- [x] 7.2 Build `client/src/components/ActivityHeatmap.tsx`: 52-week SVG grid, intensity scale from daily count, tooltip on hover (date + cards reviewed)
- [x] 7.3 Build `client/src/components/LifecycleChart.tsx`: recharts stacked `BarChart` with 5 segments (one bar = current snapshot of all word statuses)
- [x] 7.4 Build `client/src/components/RetentionChart.tsx`: recharts `LineChart` with 30-day rolling retention rate, shaded `ReferenceArea` between 85%–90%
- [x] 7.5 Build `client/src/components/DueSummary.tsx`: three large number widgets (Due Now / New Available / Leeches); each links to relevant action
- [x] 7.6 Build `client/src/components/LeechPanel.tsx`: list of leech words from dashboard response; Reset (`consecutiveFails=0`, status→Weak), Suspend (status→Suspended), Delete actions; wire to `PATCH /api/words/:id` and `DELETE /api/words/:id` Hono routes
- [x] 7.7 Write `PATCH /api/words/:id` and `DELETE /api/words/:id` routes in `server/src/routes/words.ts`
- [x] 7.8 Build `client/src/pages/DashboardPage.tsx`: compose all chart + summary components, fetch from `/api/dashboard` on mount

## 8. Dictionary

- [x] 8.1 Create `client/public/data/radicals.json`: bundled character decomposition data — array of `{ char, pinyin, meaning, radical, radicalMeaning }` entries for common Mandarin characters (seed from public-domain Unihan-compatible dataset)
- [x] 8.2 Write `GET /api/dictionary` Hono route in `server/src/routes/dictionary.ts`: `q` param, queries Word table with case-insensitive LIKE on simplified, traditional, pinyin, definition; returns array of matching words
- [x] 8.3 Build `client/src/components/CharacterBreakdown.tsx`: fetches `radicals.json` (cached in module scope), renders per-character rows with radical + meaning
- [x] 8.4 Build `client/src/components/HskBadge.tsx`: pill badge showing HSK level or "—" if null
- [x] 8.5 Build `client/src/pages/DictionaryPage.tsx`: search input, debounced calls to `/api/dictionary?q=`, results list, word detail panel with `CharacterBreakdown` + `HskBadge` + user notes textarea
- [x] 8.6 Write `POST /api/words/:id/notes` Hono route in `server/src/routes/words.ts`: upsert `notes` field on Word; wire notes display into `DictionaryPage.tsx` and card back in `StudyPage.tsx`

## 9. Queue Manager

- [x] 9.1 Write `GET /api/decks` Hono route in `server/src/routes/decks.ts`: returns all distinct deck names with word count, due count, priority from `DeckPriority` table
- [x] 9.2 Write `POST /api/decks/priority` Hono route: accepts `{ order: string[] }` (deck names in priority order), upserts `DeckPriority` rows
- [x] 9.3 Build `client/src/pages/QueuePage.tsx`: deck list rendered with `@dnd-kit/sortable`, drag-end calls `/api/decks/priority`
- [x] 9.4 Add study mode selector to each deck row in `QueuePage.tsx` (dropdown: Standard / Refresh Weak / Cram / Hard-Only); persist selection to localStorage keyed by deck name; pass `mode` param to `/api/session`
- [x] 9.5 Update `GET /api/session` to accept `mode` param and filter accordingly: Refresh Weak → `status=Weak`; Cram → ignore `nextReviewDate`; Hard-Only → last response was Again or Hard (from ReviewHistory)
- [x] 9.6 Add word list view within each deck in `QueuePage.tsx`: checkboxes for bulk selection + "Mark as Known" button → `POST /api/decks/:name/mark-known` (sets status=Mastered, all intervals=365)
- [x] 9.7 Write `POST /api/decks/:name/mark-known` Hono route in `server/src/routes/decks.ts`: accepts `{ wordIds: string[] }`, bulk updates Word + Review rows in transaction
- [x] 9.8 Enforce new cards per day limit in `GET /api/session`: read `DailyStats` for today + deck, subtract from configurable daily limit (default 20); exclude Unstudied cards beyond limit

## 10. Navigation & Polish

- [x] 10.1 Build `client/src/components/Sidebar.tsx`: persistent left nav with links to Dashboard, Study, Queue, Dictionary, Import, Settings using React Router `NavLink`; install `react-router-dom@6.30.1`
- [x] 10.2 Build `client/src/App.tsx`: wrap in `ThemeProvider` from `next-themes`, set up React Router routes for all pages, render Sidebar + page outlet
- [x] 10.3 Implement light/dark toggle button in Sidebar using `next-themes` `useTheme`; verify all components reference only CSS var-based Tailwind tokens
- [x] 10.4 Add `?` keydown listener in `StudyPage.tsx` to toggle a Radix `Dialog` showing keyboard shortcut reference (Space=reveal, 1–4=respond, R=audio, ?=help)
- [x] 10.5 Write root `README.md`: prerequisites (Node 18+, pnpm), `pnpm install`, `pnpm db:push`, `pnpm dev`, Whisper env var setup, CSV export + import walkthrough

## 11. Study Session Redesign (Two-Phase Reveal)

- [x] 11.1 Update `openspec/changes/open-chinese/specs/study-session/spec.md`: specify two-phase reveal flow (pronunciation self-assess → reveal → meaning self-assess → reveal), centered layout, per-step data capture, session summary with per-dimension accuracy
- [x] 11.2 Update `openspec/changes/open-chinese/specs/srs-engine/spec.md`: specify binary per-subskill grading (`knewPronunciation` + `knewMeaning`), derived SRS response per interval independently, `deriveStatus` uses `min(intervalMeaning, intervalPinyin)` excluding audio, `checkMastery` excludes audio
- [x] 11.3 Update `server/prisma/schema.prisma`: add `knewPronunciation Boolean?` and `knewMeaning Boolean?` to `ReviewHistory` model; run `prisma db push` to apply
- [x] 11.4 Update `server/src/lib/srs.ts`: `deriveStatus` uses `min(meaning, pinyin)` (audio excluded); `checkMastery` excludes audio; add `applyBinaryReview(review, knewPronunciation, knewMeaning)` pure function that applies Good/Again per interval independently
- [x] 11.5 Fix `calculateNewInterval` in `srs.ts`: treat `current === 0` as 1 before multiplying so Good from new word gives 6.25 days, not 1
- [x] 11.6 Update `POST /api/session/review` in `server/src/routes/session.ts`: accept `{ wordId, knewPronunciation, knewMeaning }` instead of `{ wordId, subskill, response }`; use `applyBinaryReview`; write `ReviewHistory` with both boolean fields
- [x] 11.7 Fix root `package.json` workspace filter: change `--filter server` to `--filter open-chinese-server` to match the server package name

## 12. HSK Vocabulary Seed

- [x] 12.1 Create `server/src/data/hsk.json`: ~725 deduplicated HSK 1–4 vocabulary entries (simplified, traditional, pinyin, definition, hskLevel); covers HSK 1 (~150), HSK 2 (~150), HSK 3 (~300), HSK 4 (~600)
- [x] 12.2 Create `server/src/lib/seed.ts`: `seedHsk()` function that loads `hsk.json`, builds a Set of existing `simplified` values, deduplicates within JSON, inserts only new words with their `Review` rows in a single Prisma transaction
- [x] 12.3 Update `server/src/index.ts`: call `seedHsk()` after server starts so HSK words auto-populate on first run; subsequent runs skip existing words

## 13. StudyPage Rewrite (Centered Two-Phase UI)

- [x] 13.1 Rewrite `client/src/pages/StudyPage.tsx`: centered full-viewport layout (`min-h-screen` flex column); character at `clamp(5rem, 15vw, 9rem)` font size
- [x] 13.2 Implement 4-phase state machine in `StudyPage.tsx`: `pron-claim → pron-grade → meaning-claim → meaning-grade`; "Show me" auto-fails the sub-skill and advances phase without a grade step; "I think I know" reveals answer and shows grade buttons
- [x] 13.3 Wire keyboard shortcuts in `StudyPage.tsx`: Y = claim/I knew it, Space/Enter = show me, N = I didn't know, R = replay audio, ? = help modal
- [x] 13.4 Session summary screen: separate accuracy stats for pronunciation %, meaning %, and "fully known" (both) %; displayed after last card
