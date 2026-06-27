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

## Whisper Pronunciation Assessment

Set `WHISPER_BACKEND` in `server/.env`:

```
# Use OpenAI Whisper API (default)
WHISPER_BACKEND=api
OPENAI_API_KEY=sk-...

# Or use local whisper.cpp binary (install separately)
WHISPER_BACKEND=local
```

With `api` mode and no API key set, pronunciation assessment is silently skipped.

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
