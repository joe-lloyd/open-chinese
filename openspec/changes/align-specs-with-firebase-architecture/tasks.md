## 1. Delete the dead API client

- [ ] 1.1 Re-confirm zero call sites before deleting: `rg -n "apiFetch|API_BASE|lib/api|VITE_API_URL" client/src` must return matches only inside `client/src/lib/api.ts` itself — if any other file matches, stop and do not delete
- [ ] 1.2 Delete `client/src/lib/api.ts`
- [ ] 1.3 Confirm `VITE_API_URL` appears nowhere else in the repo: `rg -n "VITE_API_URL" --glob '!node_modules'` returns no matches after the deletion (it is already absent from `client/.env.example`, so no env file edit is required)
- [ ] 1.4 Run `npx tsc -b` in `client/` and confirm the deletion introduces no new errors

## 2. Rewrite README.md for the shipped stack

- [ ] 2.1 Delete the `pnpm db:push` line from the Setup block at `README.md:14` and correct the `pnpm dev` comment at `README.md:15` — it starts Vite on `localhost:5173` only; there is no API on `localhost:3001`
- [ ] 2.2 Delete the entire `## Whisper Pronunciation Assessment` section (`README.md:24-37`) — it configures `WHISPER_BACKEND` and `OPENAI_API_KEY` in `server/.env`, and neither the file nor the server exists. Do not add a replacement; `client-side-pronunciation-assessment` owns that documentation
- [ ] 2.3 Rewrite the `## Stack` section (`README.md:39-44`) as: Frontend — Vite + React 19 + TypeScript + Tailwind CSS; Auth — Firebase Authentication (Google sign-in); Data — Cloud Firestore, per-user at `users/{uid}`; Dictionary — static `words.db` SQLite file served from the CDN and queried in-browser via sql.js (read-only); Hosting — Netlify static hosting, no backend server; Package manager — pnpm workspaces
- [ ] 2.4 Replace the `## Scripts` table (`README.md:46-54`) with the three scripts that exist in the root `package.json`: `pnpm dev` (start the Vite dev server), `pnpm build` (build the client for production), `pnpm build:words-db` (regenerate `client/public/words.db` from `scripts/hsk.json`). Delete the `pnpm db:push`, `pnpm db:studio` and `pnpm db:generate` rows
- [ ] 2.5 Add a short setup note that `client/.env` must be populated from `client/.env.example` (the `VITE_FIREBASE_*` keys and optional `VITE_ALLOWED_EMAIL`) and that `pnpm build:words-db` must be run once before `pnpm dev`, since `client/public/words.db` is gitignored
- [ ] 2.6 Update the intro line at `README.md:3` so it no longer describes the app as "self-hosted" with a database that requires a server
- [ ] 2.7 Grep the finished file to confirm no stale references survive: `rg -n "Prisma|db:push|db:studio|db:generate|Hono|3001|server/\.env|WHISPER" README.md` returns nothing
- [ ] 2.8 Leave `DEPLOY.md:232-233` (`WHISPER_BACKEND`, `OPENAI_API_KEY`) untouched — the `client-side-pronunciation-assessment` change owns the pronunciation docs

## 3. Replace the placeholder Purpose in all eight deployed specs

Each file's line 4 currently reads `TBD - created by archiving change open-chinese. Update Purpose after archive.` Replace that single line in each file; do not alter any requirement in these files as part of this section.

- [ ] 3.1 `openspec/specs/audio-playback/spec.md` — "Speaks Mandarin words and example sentences aloud in the browser using the Web Speech API, so the learner hears correct pronunciation during study. Requires no audio assets, no network calls, and no server."
- [ ] 3.2 `openspec/specs/csv-import/spec.md` — "Migrates an existing Hack Chinese vocabulary export into the user's Firestore word collection, reconstructing each word's SRS state from the CSV's status and next-review columns."
- [ ] 3.3 `openspec/specs/dashboard/spec.md` — "Summarises the learner's progress on the landing page — study activity, vocabulary lifecycle distribution, retention and due workload — from per-word and per-day Firestore aggregates."
- [ ] 3.4 `openspec/specs/dictionary/spec.md` — "Provides search and browse over the static HSK word database, showing definitions, character breakdown and HSK level alongside the user's own SRS status and notes for each word."
- [ ] 3.5 `openspec/specs/pronunciation-assessment/spec.md` — "Records the learner speaking a word and scores the attempt against the expected pinyin, giving per-syllable tone feedback. Degrades silently when speech capture or transcription is unavailable."
- [ ] 3.6 `openspec/specs/queue-manager/spec.md` — "Gives the learner control over what gets studied: deck listing and priority order, targeted study modes, the daily new-card limit, and marking words as already known."
- [ ] 3.7 `openspec/specs/srs-engine/spec.md` — "Computes the spaced-repetition schedule from binary knew / didn't-know grades: per-sub-skill intervals, ease factor, next review date, derived word status and leech state. Pure client-side computation with no I/O."
- [ ] 3.8 `openspec/specs/study-session/spec.md` — "Drives the review loop: building the card queue, the two-phase pronunciation-then-meaning reveal, grading, re-queuing failed cards, and the end-of-session summary."
- [ ] 3.9 Confirm the placeholder is gone everywhere: `rg -n "TBD - created by archiving" openspec/specs` returns no matches

## 4. Verify the change

- [ ] 4.1 Run `npx openspec validate align-specs-with-firebase-architecture --strict` and confirm it reports the change is valid
- [ ] 4.2 Run `pnpm --filter client build` and confirm the production build completes with no TypeScript errors
- [ ] 4.3 Confirm no file under `client/src` other than the deleted `client/src/lib/api.ts` appears in `git status` — this change is behaviour-preserving in code
- [ ] 4.4 Re-read each rewritten requirement against its cited source line (`firestore.ts:115-125`, `firestore.ts:143-159`, `firestore.ts:285-312`, `srs.ts:97-98`, `StudyPage.tsx:156-166`, `StudyPage.tsx:203-211`, `tts.ts:8,32`) and confirm every normative statement still matches the code
- [ ] 4.5 Before archiving, check the archive applies cleanly — `MODIFIED` headers must match a requirement that still exists in `openspec/specs/` and must carry every scenario that requirement currently has, or `npx openspec archive` aborts. Note that `firebase-netlify-architecture` has overlapping unarchived deltas on `srs-engine`, `study-session` and `csv-import`; whichever change archives second must be refreshed against the resulting specs first
