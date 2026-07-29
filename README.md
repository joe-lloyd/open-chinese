# OpenChinese

Open-source Mandarin vocabulary app. Hack Chinese alternative with multi-dimensional SRS, pronunciation assessment, and full data portability. It runs as a static single-page app — your vocabulary lives in your own Firebase project, and there is no backend server to operate.

## Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- A Firebase project with Authentication (Google sign-in) and Cloud Firestore enabled

## Setup

```bash
pnpm install
cp apps/app/.env.example apps/app/.env   # then fill in the VITE_FIREBASE_* values
pnpm build:words-db                  # generates apps/app/public/words.db (gitignored)
pnpm build:readers                   # generates the graded reader assets (gitignored)
pnpm dev                             # everything, on http://localhost:4321
```

**Open `http://localhost:4321` and nothing else.** `pnpm dev` starts both dev
servers, and the site's dev server proxies `/app` to the app's, so one origin
serves the whole product exactly as the deployed site does — browse the marketing
pages, click "Start free", sign in, study, and click back, without changing port.
Hot reload works through the proxy for both.

The app's own server on `:5173` is an implementation detail. Use `pnpm dev:app`
or `pnpm dev:site` if you deliberately want just one.

## Repository layout

A pnpm workspace with two deployable apps and the packages they share.

```
apps/
  app/            the study app — React + Vite SPA, served at /app
  site/           the marketing site — Astro, static, served at /
packages/
  tokens/         design tokens shared by both, so they cannot drift
  build-tools/    builds words.db and the reader assets from source data
content/readers/  authored reader sources (input to build-tools)
netlify/functions/ payment endpoints — checkout, webhook, billing portal
scripts/          repo operations: entitlement CLI, bundle check, dist assembly
openspec/         specs and change history
```

Both apps deploy from one Netlify site and one domain: `pnpm build` builds each
of them and `scripts/assemble-dist.mjs` nests the app's output inside the site's
at `/app`, which is what `netlify.toml` publishes.

`apps/app/.env` must carry the six `VITE_FIREBASE_*` keys from your Firebase project's
web app config. `VITE_ALLOWED_EMAIL` is optional — set it to restrict sign-in to a
single Google account, or leave it blank to allow any account.

`pnpm build:words-db` builds the bundled HSK 1–9 dictionary from
`packages/build-tools/hsk*.json`. HSK 7–9 is the official combined advanced
band. The database must be
run at least once before `pnpm dev`, because `apps/app/public/words.db` is not committed
to the repository.

## Import from Hack Chinese

1. In Hack Chinese: Account → Export → download CSV
2. Open `localhost:5173/import`
3. Drop the CSV file, review the preview, click Confirm

## Pronunciation Assessment

Runs entirely in the browser on the Web Speech API (`SpeechRecognition` at
`lang='zh-CN'`). There is no server, no API key and no environment variable to
set — hold the microphone button on a revealed study card and speak.

**What it checks:** which word the recognizer heard, compared against the card's
characters. Verdicts are `match`, `near-match` (the target appeared in a
lower-ranked alternative), `homophone` (same toneless pinyin, different
character), `mismatch` and `unrecognized`.

**What it does not check: tones.** `SpeechRecognition` returns Han characters
only — never pinyin, never tone marks — and a Mandarin recognizer's language
model silently repairs tone errors, so saying the right word with the wrong tone
usually still returns a `match`. The result is advisory and never affects SRS
scheduling.

**Browser support:** Chrome, Edge and Opera implement it (behind the `webkit`
prefix). Safari implements it but is unreliable. Firefox ships it disabled behind
`dom.webspeech.recognition.enable`, so it is effectively unsupported — the
microphone control is disabled there with an explanatory tooltip and no error.

Chrome streams the audio to Google's servers for recognition, so the feature
requires an internet connection.

## Stack

- **Frontend**: Vite + React 19 + TypeScript + Tailwind CSS
- **Auth**: Firebase Authentication (Google sign-in)
- **Data**: Cloud Firestore, per-user under `users/{uid}`
- **Dictionary**: a static `words.db` SQLite file served from the CDN and queried in-browser via sql.js (read-only)
- **Hosting**: Netlify static hosting — no backend server
- **Package manager**: pnpm workspaces

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start everything. Open **http://localhost:4321** — site at `/`, app at `/app` |
| `pnpm dev:app` / `pnpm dev:site` | Start just one, if you have a reason to |
| `pnpm build` | Build both apps and assemble the deployable `apps/site/dist` |
| `pnpm test:payments` | Run payment configuration, Stripe adapter, and endpoint contract tests |
| `pnpm check:payments-config` | Validate active payment settings without a provider network call |
| `pnpm build:app` / `pnpm build:site` | Build one of them |
| `pnpm preview` | Serve the assembled output exactly as Netlify will |
| `pnpm build:words-db` | Regenerate `apps/app/public/words.db` from `packages/build-tools/hsk*.json` |
| `pnpm import:hsk` | Refresh the committed HSK 3.0 vocabulary bands from their attributed upstream sources |
| `pnpm build:readers` | Regenerate the graded reader assets from `content/readers/` |
| `pnpm entitlement <persona>` | Set your own or a test account's plan — see DEPLOY.md |
