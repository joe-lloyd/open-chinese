## Why

Hack Chinese is a proprietary SaaS with no export portability, limited customization, and an opaque SRS algorithm. Learners need a self-hosted, open-source alternative that preserves their study data, runs offline, and supports the same multi-dimensional SRS model without vendor lock-in.

## What Changes

- Greenfield Vite + React + TypeScript SPA frontend + Hono local API server, bootstrapped with pnpm
- SQLite database via Prisma ORM for fully local, portable data storage
- Custom multi-dimensional SRS engine tracking three independent sub-skill intervals per word (meaning, pinyin, audio)
- Hack Chinese CSV import pipeline with status mapping and interval reconstruction
- Study session UI with two-phase self-assessment flow (pronunciation → meaning), centered layout, per-dimension SRS update
- Real-time pronunciation assessment via Whisper API / whisper.cpp with tone-level feedback
- Dashboard with activity heatmap, lifecycle stack chart, and retention line chart
- Integrated dictionary with radical decomposition and user notes
- Queue manager with drag-and-drop deck prioritization and targeted study modes
- Tailwind CSS theming with automatic light/dark mode (no hardcoded colors)

## Capabilities

### New Capabilities

- `srs-engine`: Multi-dimensional SM-2 variant tracking meaning/pinyin/audio intervals independently per word, with 5-state lifecycle, leech detection, and mastery promotion
- `csv-import`: Hack Chinese CSV parser with validation, status mapping, and interval reconstruction into SQLite
- `study-session`: Two-phase self-assessment UI (claim pronunciation → reveal → grade → claim meaning → reveal → grade); centered layout; per-dimension accuracy summary; binary SRS grading per sub-skill
- `hsk-seed`: Bundled HSK 1–4 vocabulary (~725 words) auto-seeded on first run; each deck named "HSK N"; new words due immediately
- `pronunciation-assessment`: Audio capture via MediaRecorder → Whisper transcription → pinyin/tone comparison → color-coded feedback
- `dashboard`: Activity heatmap, vocabulary lifecycle stack chart, and retention rate line chart
- `dictionary`: Inline character breakdown with radical decomposition and user-attached notes
- `queue-manager`: Drag-and-drop deck priority ordering with targeted study modes (Refresh Weak, Cram, Hard-Only)
- `audio-playback`: Native-speaker TTS for vocabulary cards with offline fallback

### Modified Capabilities

## Impact

- **New project**: no existing code — all files created from scratch
- **Dependencies**: Vite, React, TypeScript, Hono, Prisma, better-sqlite3, Tailwind CSS, Whisper API client, Radix UI or similar headless components, recharts or similar charting lib — all must be ≥1 week old stable releases
- **Package manager**: pnpm throughout (no npm/yarn)
- **Database**: SQLite file, local only — no network database
- **External services**: OpenAI Whisper API (optional, fallback to whisper.cpp binary)
