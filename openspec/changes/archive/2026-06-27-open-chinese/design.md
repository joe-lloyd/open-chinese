## Context

OpenChinese is a greenfield self-hosted web app replacing Hack Chinese for Mandarin vocabulary study. No existing codebase. Target: single-user local deployment. Stack is **Vite + React + TypeScript** SPA frontend + **Hono** local API server + **Prisma + SQLite** backend, managed with pnpm. All packages must be stable releases ≥1 week old.

No SSR, no SEO requirements — this is a fully client-side tool accessed at `localhost`. Next.js was explicitly rejected due to unnecessary complexity and known vulnerability surface for a purely local, client-side app.

## Goals / Non-Goals

**Goals:**
- Full Hack Chinese CSV import with SRS state reconstruction
- Multi-dimensional SRS engine (3 independent sub-skill intervals per word)
- Keyboard-first study session UI
- Real-time pronunciation scoring via Whisper
- Dashboard with heatmap, lifecycle chart, retention chart
- Integrated dictionary with radical decomposition
- Queue manager with drag-and-drop and targeted study modes
- Light/dark mode via Tailwind without hardcoded colors

**Non-Goals:**
- SSR / SEO (local tool, no public indexing needed)
- Multi-user auth system (single user assumed for v1)
- Cloud sync or remote database
- Mobile-native app (web responsive is acceptable)
- Gamification / streaks / social features
- Support for languages other than Mandarin Chinese

## Decisions

### D1: Vite React SPA over Next.js
All functionality is user-interaction driven with no SEO or server-rendering requirements. Vite gives fast HMR, minimal config, and no framework attack surface. Next.js was rejected: it adds SSR complexity, frequent CVEs, and App Router overhead that provide zero value for a local single-user tool.

**Alternatives considered:** Next.js — rejected (CVE history, SSR overhead, unnecessary for client-only app). CRA — rejected (deprecated).

### D2: Hono API server for backend logic
Prisma (SQLite), CSV import, and Whisper calls require a Node.js process. Hono is a lightweight, typed HTTP framework that runs on Node without the overhead of Express. The API server runs on port 3001 alongside the Vite dev server on port 5173. In production both are served from the same `pnpm start` command.

**Alternatives considered:** Express — viable but more boilerplate. tRPC — adds complexity without benefit at this scale. Putting Prisma in the browser — impossible (native binary).

### D3: SQLite via Prisma over PostgreSQL
Single-user local tool. SQLite: zero ops overhead, portable file backup, fast enough for <100k words. Prisma adds typed queries and easy migrations.

**Alternatives considered:** PostgreSQL — rejected (over-engineered, requires daemon). IndexedDB — rejected (no server-side processing for SRS scheduling).

### D4: Multi-dimensional SRS as one `Review` row per word
Each `Word` has exactly one `Review` row tracking three float intervals (meaning, pinyin, audio) plus shared `easeFactor` and `consecutiveFails`. The sub-skill targeted per session is decided by which interval is due soonest.

**Alternatives considered:** One `Review` row per sub-skill (3× row count, more joins). Embedding intervals in `Word` (mixes concerns).

### D5: Whisper for pronunciation — API-first, local fallback
Default: OpenAI Whisper API. Fallback: whisper.cpp binary via child_process. Controlled by `WHISPER_BACKEND=api|local` env var.

**Alternatives considered:** Web Speech API — rejected (no tone-level detail).

### D6: pnpm for package management
Strict hoisting, faster installs, single lockfile. All packages pinned to stable versions ≥1 week old.

### D7: Tailwind CSS with CSS variables for theming
Use Tailwind's `dark:` variant + CSS custom properties mapped to semantic token names (`--color-surface`, `--color-text-primary`). No hardcoded hex values in component classes.

### D8: Radix UI + dnd-kit + recharts
Radix UI for accessible headless components. `@dnd-kit/core` for drag-and-drop queue. `recharts` for dashboard charts. No heavy UI framework (no MUI/Chakra).

## Risks / Trade-offs

- **Whisper API latency** (300–800ms per assessment) → Mitigation: cache result per (audio hash, target pinyin); allow session to continue without blocking on result.
- **SQLite write contention** during bulk CSV import → Mitigation: wrap entire import in single Prisma transaction with batch upserts.
- **Interval reconstruction from Hack Chinese CSV** is lossy (only `Next Review` exported) → Mitigation: derive interval as `nextReview - importDate`; cap at 365 for Mastered. Document this in import UI.
- **whisper.cpp binary OS variance** → Mitigation: document manual install; API mode is zero-config default.
- **CORS** between Vite (5173) and Hono (3001) in dev → Mitigation: Hono CORS middleware configured for localhost origins only.

## Migration Plan

1. User installs: `pnpm install && pnpm db:push`
2. Starts app: `pnpm dev` (launches Vite + Hono concurrently)
3. Exports CSV from Hack Chinese (Account → Export)
4. Uploads CSV via `/import` page in browser
5. Preview screen shows row counts + errors before commit
6. On confirm, import runs in Hono transaction; redirects to dashboard
7. No rollback needed (SQLite file can be deleted and reimported)

## Open Questions

- Radical decomposition data: bundled static JSON vs external API → bundled for offline support.
- Session card limit default: 50 new+review cards, configurable in settings.
- TTS: Web Speech API first (`lang=zh-CN`), structured for swap-out to external TTS endpoint.
