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

- [x] 3.1 Add `better-sqlite3` build script at `scripts/build-words-db.ts` that reads `server/src/data/hsk.json` and writes `client/public/words.db` (schema: `id, simplified, traditional, pinyin, definition, hsk_level, deck_name, notes`)
- [x] 3.2 Add `@sqlite.org/sqlite-wasm` package to `client/package.json`
- [x] 3.3 Create `client/src/lib/worddb.ts` — exports `loadDB()`, `getWord(simplified)`, `getWordsByLevel(level)`, `getAllWords()`, `searchWords(query)`; lazy-loads WASM; caches instance
- [x] 3.4 Run build script to generate `client/public/words.db` and commit it
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
- [x] 10.3 Test local dev: `pnpm dev` (Hono server still runs; auth bypass still works in dev mode)
- [ ] 10.4 Deploy to Netlify and verify Firebase Auth sign-in, Firestore writes, study session, and import all work on the live URL
