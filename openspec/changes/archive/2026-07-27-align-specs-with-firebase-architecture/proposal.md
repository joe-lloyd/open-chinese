## Why

The deployed specs still describe a backend that no longer exists. Commit `8850661` deleted the `server/` workspace (Hono + Prisma + SQLite writes) and the app now ships as a pure static SPA on Netlify with Firebase Auth and Firestore. Four capability specs were never updated, so anyone reading `openspec/specs/` is told to build against endpoints, tables and code paths that were removed:

- `openspec/specs/srs-engine/spec.md:102` and `openspec/specs/study-session/spec.md:75` both mandate `POST /api/session/review`. There is no server to receive it — `client/src/pages/StudyPage.tsx:103-112` writes straight to Firestore via `setUserWord` (`client/src/lib/firestore.ts:87-126`) and `upsertDailyStats` (`firestore.ts:143-159`).
- `srs-engine` requires a `ReviewHistory` row per review. That collection and its `appendHistory`/`getHistory` accessors were deleted in commit `5986ae3` and replaced by aggregate counters on the word document (`totalReviews`, `correctMeaningCount`, `incorrectMeaningCount`, `correctPronCount`, `incorrectPronCount`, `lastReviewedAt`, `firstSeenAt` — `firestore.ts:115-125`) plus per-day `users/{uid}/dailyStats/{date}` documents (`firestore.ts:143-159`).
- `csv-import` requires "all database writes in a single SQLite transaction … rolled back" on partial failure. Nothing writes to SQLite: `client/src/lib/worddb.ts:33-50` loads `words.db` read-only into sql.js in memory. Imports go to Firestore as chunked `writeBatch` commits of at most 500 documents (`firestore.ts:285-312`), so a 1000-row import is two independent transactions with no cross-chunk rollback.
- `audio-playback` gates automatic playback on "the targeted sub-skill is `audio`". No code path ever selects a targeted sub-skill — `StudyPage.tsx:10` uses a fixed four-phase model, `StudyPage.tsx:92` hardcodes `lastSubskill: null`, `srs.ts:107` hardcodes `'meaning'`, and `intervalAudio` is ignored as `_intervalAudio` at `srs.ts:51,68`. The precondition can never be true, so the requirement is unreachable and its companion "no auto-play" scenario is actively contradicted by `StudyPage.tsx:163-166` and `StudyPage.tsx:156-161`.

On top of that, all eight files under `openspec/specs/*/spec.md` still carry the placeholder Purpose `TBD - created by archiving change open-chinese. Update Purpose after archive.`, `client/src/lib/api.ts` is a dead API client pointed at `http://localhost:3001` with zero call sites, and `README.md` documents `pnpm db:push`, `pnpm db:studio`, `pnpm db:generate`, Prisma, a Hono backend on port 3001, `server/.env` and `WHISPER_BACKEND` — none of which exist.

## What Changes

- Replace the `srs-engine` `ReviewHistory` requirement with requirements describing the aggregate counters actually written to `users/{uid}/words/{simplified}` and the per-day `users/{uid}/dailyStats/{date}` document, and drop the `POST /api/session/review` trigger
- State explicitly in `srs-engine` that the `Good | Hard | Again` value derived at `client/src/lib/srs.ts:97-98` is computed but never persisted — `StudyPage.tsx:103-108` discards it, and `Easy` is never produced
- Replace `study-session`'s `POST /api/session/review` submission requirement with the direct-to-Firestore write, reusing the wording already drafted at `openspec/changes/firebase-netlify-architecture/specs/study-session/spec.md:26-32` so both changes describe it identically
- Correct `study-session`'s audio replay requirement from "presses R" to "presses ↑ or R" — both are bound at `StudyPage.tsx:203-204` and the in-app help advertises `↑ / R` (`StudyPage.tsx:450`)
- Replace `csv-import`'s "Atomic transactional import" with the real behaviour: per-chunk atomic Firestore `writeBatch` commits of at most 500 documents, no cross-chunk rollback, and idempotent re-runs because writes use `merge: true` with the document id set to `simplified` (`firestore.ts:296-306`); add a scenario for the batch progress callback (`firestore.ts:311` → `ImportPage.tsx:137`)
- Replace `audio-playback`'s unreachable sub-skill-gated auto-play requirement with the real behaviour — audio plays automatically on every pronunciation reveal (`StudyPage.tsx:163-166`) and on every fail (`StudyPage.tsx:156-161`) — and **delete** the "No auto-play for non-audio sub-skills" scenario the code contradicts
- Add an `audio-playback` requirement for the `↓` shortcut that speaks the example sentence, gated on `phase === 'meaning-revealed'` and a non-empty `card.sentenceZh` (`StudyPage.tsx:205-211`)
- Document in `audio-playback` that TTS rate and pitch persist to the `tts-settings` localStorage key per-device (`client/src/lib/tts.ts:8,32`), not to the Firestore user profile
- Write a real one-to-two sentence Purpose for all eight capabilities in `openspec/specs/*/spec.md`, replacing the archive placeholder
- Delete `client/src/lib/api.ts` — `apiFetch` and `API_BASE` have zero call sites anywhere in `client/src`
- Rewrite `README.md` for the shipped stack: Vite + React + TypeScript + Tailwind, Firebase Auth + Firestore, static `words.db` queried in-browser via sql.js, Netlify hosting, pnpm workspace, and the three real root scripts `dev`, `build`, `build:words-db`

## Capabilities

### New Capabilities

<!-- None. This change corrects the written description of four existing capabilities. -->

### Modified Capabilities

- `srs-engine`: The `ReviewHistory captures per-step knowledge state` requirement is removed and replaced by three requirements covering the aggregate word-document counters, the non-persisted derived response value, and the per-day `dailyStats` aggregates. The `POST /api/session/review` trigger is gone.
- `study-session`: The `SRS submission after both phases` requirement is removed and replaced by `Review result written directly to Firestore`. The `Audio replay` requirement is corrected to `↑ or R`.
- `csv-import`: The `Atomic transactional import` requirement is removed and replaced by `Chunked Firestore import with per-batch atomicity`, which states the 500-document chunk boundary, the absence of cross-chunk rollback, idempotent re-runs via `merge: true` on a `simplified` document id, and the batch progress callback.
- `audio-playback`: The `Audio playback on card reveal` requirement is removed and replaced by `Audio plays automatically on pronunciation reveal and on fail`. A new `Example sentence playback` requirement is added for `↓`. The `TTS audio generation`, `Audio replay button` and `Configurable TTS rate and pitch` requirements are corrected for the `↑ / R` binding and localStorage persistence.

## Impact

This change is **behaviour-preserving in code**. The only code deletion is `client/src/lib/api.ts`, an unreferenced module. Everything else is spec text catching up to what already shipped, plus the `README.md` rewrite and the eight `Purpose` edits. No runtime file under `client/src` other than the deleted `api.ts` is touched, and no Firestore document shape, keyboard binding, or study flow changes.

- **Deleted**: `client/src/lib/api.ts` (`apiFetch`, `API_BASE`, the `VITE_API_URL ?? 'http://localhost:3001'` default). Verified zero call sites: `apiFetch`/`API_BASE`/`lib/api` appear nowhere in `client/src` except inside `api.ts` itself. `VITE_API_URL` is not referenced anywhere else and is already absent from `client/.env.example`.
- **Rewritten**: `README.md` — remove `pnpm db:push`, `pnpm db:studio`, `pnpm db:generate`, Prisma, the Hono backend on port 3001, `server/.env` and the `WHISPER_BACKEND` section; document the real stack and the three root scripts from `package.json`
- **Edited**: the `## Purpose` line of all eight `openspec/specs/*/spec.md` files (`audio-playback`, `csv-import`, `dashboard`, `dictionary`, `pronunciation-assessment`, `queue-manager`, `srs-engine`, `study-session`). OpenSpec change deltas only carry requirement changes, so these are handled as explicit tasks that edit the deployed spec files directly rather than being encoded in the delta specs.
- **Unchanged**: `client/src/lib/firestore.ts`, `srs.ts`, `tts.ts`, `worddb.ts`, `StudyPage.tsx`, `ImportPage.tsx` — the specs are being corrected to match them, not the other way round
- **Out of scope**: `DEPLOY.md:232-233` also lists the dead `WHISPER_BACKEND` and `OPENAI_API_KEY` environment variables, but the `client-side-pronunciation-assessment` change owns the pronunciation documentation, so those two lines are deliberately left alone here.
- **Out of scope**: the `dashboard` `getHistory` build break and retention chart (`fix-dashboard-retention`); leech detection wiring and fractional interval truncation (`enable-leech-detection`); deck priority and targeted study modes (`wire-deck-targeted-study`); anything about Whisper, `SpeechRecognition`, or the `pronunciation-assessment` spec (`client-side-pronunciation-assessment`); the "Good multiplier vs graduated learning steps" discrepancy at `srs.ts:37-41`; `radicals.json` coverage and CSV duplicate detection, both deferred backlog.
