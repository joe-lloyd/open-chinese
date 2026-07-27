# OpenChinese

Open-source Mandarin vocabulary app. Hack Chinese alternative with multi-dimensional SRS, pronunciation assessment, and full data portability. It runs as a static single-page app — your vocabulary lives in your own Firebase project, and there is no backend server to operate.

## Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- A Firebase project with Authentication (Google sign-in) and Cloud Firestore enabled

## Setup

```bash
pnpm install
cp client/.env.example client/.env   # then fill in the VITE_FIREBASE_* values
pnpm build:words-db                  # generates client/public/words.db (gitignored)
pnpm dev                             # starts Vite on localhost:5173
```

`client/.env` must carry the six `VITE_FIREBASE_*` keys from your Firebase project's
web app config. `VITE_ALLOWED_EMAIL` is optional — set it to restrict sign-in to a
single Google account, or leave it blank to allow any account.

`pnpm build:words-db` builds the bundled dictionary from `scripts/hsk.json`. It must be
run at least once before `pnpm dev`, because `client/public/words.db` is not committed
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
| `pnpm dev` | Start the Vite dev server on localhost:5173 |
| `pnpm build` | Build the client for production |
| `pnpm build:words-db` | Regenerate `client/public/words.db` from `scripts/hsk.json` |
