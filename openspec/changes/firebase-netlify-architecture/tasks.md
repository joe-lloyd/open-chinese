## 1. Firebase Project Setup

- [x] 1.1 Create Firebase project in console; enable Google Auth provider and Firestore database
- [x] 1.2 Add `firebase` package to `client/package.json`
- [x] 1.3 Create `client/src/lib/firebase.ts` — initialize Firebase app with config from `VITE_FIREBASE_*` env vars
- [x] 1.4 Create `client/.env.example` with all `VITE_FIREBASE_*` and `VITE_ALLOWED_EMAIL` vars documented
- [x] 1.5 Create `firestore.rules` at repo root with per-user isolation rules
- [x] 1.6 Create `firestore.indexes.json` at repo root with composite index on `words: nextReviewDate ASC, status ASC`

## 2. Firebase Auth Module

- [x] 2.1 Create `client/src/lib/auth.ts` — exports `signInWithGoogle()`, `signOut()`, `onAuthChanged()` using Firebase Auth SDK
- [x] 2.2 Update `client/src/App.tsx` — replace `apiFetch('/api/auth/me')` with `onAuthStateChanged`; add email allowlist check; sign out + show error if unauthorized email
- [x] 2.3 Update `client/src/pages/LoginPage.tsx` — replace `href` link to Hono OAuth with `signInWithGoogle()` button; display auth error message from URL param or local state
- [x] 2.4 Update `client/src/components/Sidebar.tsx` — replace server-form logout with `signOut()` from `auth.ts`

## 3. Static Word Database

- [x] 3.1 Add `better-sqlite3` build script at `scripts/build-words-db.ts` that reads `scripts/hsk.json` and writes `client/public/words.db` (schema: `id, simplified, traditional, pinyin, definition, hsk_level, deck_name, notes`)
- [x] 3.2 Add `@sqlite.org/sqlite-wasm` package to `client/package.json`
- [x] 3.3 Create `client/src/lib/worddb.ts` — exports `loadDB()`, `getWord(simplified)`, `getWordsByLevel(level)`, `getAllWords()`, `searchWords(query)`; lazy-loads WASM; caches instance
- [x] 3.4 Run build script to generate `client/public/words.db` (file is gitignored via `*.db`; regenerated on each dev setup and deploy)
- [x] 3.5 Add `netlify.toml` `[[headers]]` rule to cache `/words.db` for 1 year (`Cache-Control: public, max-age=31536000, immutable`)

## 4. Firestore Data Layer

- [x] 4.1 Create `client/src/lib/firestore.ts` — exports `getUserWord(uid, simplified)`, `setUserWord(uid, simplified, state)`, `getDueWords(uid)`, `appendHistory(uid, entry)`, `upsertDailyStats(uid, date, isNew)`, `upsertProfile(uid, user)`
- [x] 4.2 Copy `server/src/lib/srs.ts` to `client/src/lib/srs.ts`; update imports to remove Prisma types; use plain `ReviewState` interface matching Firestore document shape
- [x] 4.3 Create `client/src/lib/session.ts` — builds study queue from Firestore due cards + SQLite Unstudied pool, respecting `dailyNewLimit`

## 5. Study Session Rewrite

- [x] 5.1 Update `client/src/pages/StudyPage.tsx` — replace `apiFetch('/api/session')` with `buildQueue()` from `session.ts`
- [x] 5.2 Update `StudyPage.tsx` `advance()` — replace `apiFetch('/api/session/review', ...)` with `applyBinaryReview` + `setUserWord` + `appendHistory` + `upsertDailyStats`
- [x] 5.3 Update `StudyPage.tsx` card type — add `deckName` field; remove `id` (use `simplified` as key)

## 6. CSV Import Rewrite

- [x] 6.1 Update `client/src/pages/ImportPage.tsx` — remove `apiFetch('/api/import', ...)` call; add `importToFirestore(uid, rows)` function that batches Firestore writes in chunks of 500
- [x] 6.2 Add custom word handling in import: words not found in SQLite (`getWord(simplified) === null`) include `customWordData` field in Firestore document
- [x] 6.3 Add batch progress UI to ImportPage ("Writing batch N of M…")

## 7. Dashboard Rewrite

- [x] 7.1 Update `client/src/pages/DashboardPage.tsx` — replace server API calls with Firestore queries for vocabulary distribution, daily stats heatmap, and retention rate
- [x] 7.2 Compute Unstudied count as: `getAllWords().length - firestoreWordCount` where firestoreWordCount excludes documents with `status == 'Unstudied'`

## 8. Dictionary & Queue Pages

- [x] 8.1 Update `client/src/pages/DictionaryPage.tsx` — replace `apiFetch('/api/words')` with `searchWords(query)` from `worddb.ts`; overlay SRS status from Firestore for known words
- [x] 8.2 Update `client/src/pages/QueuePage.tsx` — fetch queue from Firestore + SQLite join via `session.ts`; remove server API call

## 9. Netlify Deployment Config

- [x] 9.1 Create `netlify.toml` at repo root with `[build]` command (`pnpm --filter client build`), publish dir (`client/dist`), and `[[redirects]]` rule for SPA fallback (`/* → /index.html, 200`)
- [x] 9.2 Update `DEPLOY.md` — add Netlify + Firebase deployment section; keep VPS section as "self-hosted alternative"

## 10. Cleanup

- [x] 10.1 Remove `client/src/lib/api.ts` (or keep only for local dev fallback — confirm and decide) — kept unused; no longer imported by any page
- [x] 10.2 Verify `pnpm --filter client build` completes with no TypeScript errors after all changes
- [x] 10.3 Delete `server/` workspace (Hono, Prisma, Prisma dev.db, JWT auth, old SRS, Whisper); move build script + hsk.json to `scripts/` workspace
- [x] 10.4 Deploy to Netlify; Firebase Auth live on `open-chinese.joe-lloyd.com`; domain added to Firebase Auth authorized domains

## 11. SRS & Data Quality

- [x] 11.1 Fix `calculateNewInterval` initial steps: 0→1→4→10 days before SM-2 kicks in (was jumping to 6.25 days on first Good)
- [x] 11.2 Extend `setUserWord` to write per-word analytics: `totalReviews`, `correctMeaningCount`, `incorrectMeaningCount`, `correctPronCount`, `incorrectPronCount`, `firstSeenAt` (first review only), `lastReviewedAt`, `hskLevel`
- [x] 11.3 Extend `appendHistory` to capture full before/after SRS snapshot: `intervalMeaning/PinyinBefore/After`, `easeFactorBefore/After`, `nextReviewDateAfter`, `hskLevel`
- [x] 11.4 Extend `upsertDailyStats` to track `correctCount` and `incorrectCount` per day

## 12. UX Improvements

- [x] 12.1 Mobile layout: sidebar `hidden md:flex`; `BottomNav` component fixed at bottom (`md:hidden`)
- [x] 12.2 Responsive DashboardPage grid (`grid-cols-1 sm:grid-cols-2`)
- [x] 12.3 Responsive DictionaryPage: stacked layout on mobile, back button when word selected
- [x] 12.4 HSK Levels page (`/hsk`): per-level progress bars, due badge, "Study HSK N" button
- [x] 12.5 `buildQueue` HSK filter option: bypasses daily new-card limit, filters to level words
- [x] 12.6 StudyPage keyboard redesign: `←` at any phase → fail and reveal full card (`revealedByFail`); `↑`/R → replay audio; `↓` → speak example sentence
- [x] 12.7 StudyPage layout stability: opacity-based show/hide for pinyin and definition (no layout shift); fixed-height button area
- [x] 12.8 Example sentences (`client/src/lib/sentences.ts`): ~150 HSK 1-2 sentences shown in definition card when meaning revealed; `↓` plays sentence via TTS
