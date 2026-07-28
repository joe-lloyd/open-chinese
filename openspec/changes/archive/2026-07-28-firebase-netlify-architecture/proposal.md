## Why

Running a self-hosted Hono server requires a VPS, process management, and HTTPS config — ongoing ops burden for a personal tool. Netlify static hosting + Firebase removes all infrastructure: free tier, zero maintenance, automatic multi-user support.

## What Changes

- **BREAKING** Remove Hono API server from production; app becomes a static SPA
- Add Firebase Authentication (Google OAuth) — replaces Hono JWT cookie auth
- Add Firestore per-user SRS data layer — replaces server-side SQLite writes
- Deploy word dictionary as static SQLite file on Netlify CDN, queried in-browser via sql.js
- Move SRS computation to client-side (pure functions already in `srs.ts`)
- Replace `apiFetch` API calls with direct Firebase SDK calls
- Add `netlify.toml` for build config and SPA redirect rules
- Add Firestore security rules
- Keep Hono server for local dev only (no auth required in dev mode — unchanged)

## Capabilities

### New Capabilities

- `firebase-auth`: Firebase Authentication with Google sign-in, replacing Hono OAuth flow. Client-side SDK; no server redirect needed.
- `firestore-user-data`: Per-user SRS state stored in Firestore at `users/{uid}/words/{simplified}`. Lazy-initialized on first review (absence = Unstudied). Replaces server SQLite writes for user progress.
- `static-word-db`: HSK vocabulary SQLite file (`words.db`) served from Netlify CDN, loaded in-browser via sql.js. Read-only; same content for all users.

### Modified Capabilities

- `srs-engine`: Storage adapter changes — SRS state now read/written via Firestore instead of Prisma/SQLite. Pure computation functions unchanged.
- `study-session`: Queue built client-side from Firestore (due cards) + SQLite (word content + Unstudied pool). No server API calls.
- `csv-import`: Client-side CSV parsing (Papa Parse) + Firestore batch writes. Server route removed.
- `dashboard`: Stats aggregated from Firestore `users/{uid}/words` collection. No server API.

## Impact

- **Removed**: `server/` package not deployed to production (kept for local dev)
- **Removed**: Prisma, SQLite writes, Hono routes for `/api/session`, `/api/session/review`, `/api/words`, `/api/import`, `/api/auth/*`
- **Added**: `firebase` npm package in client; `sql.js` + `@sqlite.org/sqlite-wasm` in client
- **Added**: `client/.env` vars for Firebase project config
- **Added**: `firestore.rules` and `firestore.indexes.json` at repo root
- **Added**: `netlify.toml` at repo root
- **Changed**: `client/src/lib/api.ts` → `client/src/lib/firebase.ts`, `firestore.ts`, `worddb.ts`
- **Changed**: `App.tsx` auth guard uses `onAuthStateChanged` instead of `/api/auth/me`
- **Changed**: `Sidebar.tsx` logout calls `firebase.auth().signOut()`
- **Deferred**: Whisper pronunciation assessment requires a Cloud Function or separate server; not in scope for this change
