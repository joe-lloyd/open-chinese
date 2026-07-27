# OpenChinese

Self-hosted, open-source Mandarin vocabulary app. Hack Chinese alternative with multi-dimensional SRS, pronunciation assessment, and full data portability.

## Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)

## Setup

```bash
pnpm install
pnpm db:push      # creates server/prisma/dev.db
pnpm dev          # starts Vite (localhost:5173) + Hono API (localhost:3001)
```

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

- **Frontend**: Vite + React + TypeScript + Tailwind CSS
- **Backend**: Hono + Node.js
- **Database**: SQLite via Prisma ORM (local file, no server required)
- **Package manager**: pnpm

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start frontend + backend concurrently |
| `pnpm build` | Build client for production |
| `pnpm db:push` | Sync schema to SQLite |
| `pnpm db:studio` | Open Prisma Studio (database UI) |
| `pnpm db:generate` | Regenerate Prisma client after schema changes |
