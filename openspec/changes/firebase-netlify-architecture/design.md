## Context

Current stack runs Hono API + Prisma + SQLite on a VPS. Auth is Google OAuth via Hono, with JWT cookies. All SRS state (word intervals, review history) lives in server-side SQLite. The word dictionary (HSK 1–4, ~730 words) is also in SQLite.

Word data is static and identical for all users. User data (SRS state) is small and user-specific — a single user reviewing HSK 1–4 will have at most ~1200 Firestore documents, each ~100 bytes.

The SRS engine (`srs.ts`) is already pure TypeScript with no I/O — moving computation to the client requires no algorithmic change.

## Goals / Non-Goals

**Goals:**
- Zero-server production deployment (Netlify static + Firebase)
- Multi-user by design (each user owns their Firestore subcollection)
- Local dev unchanged (no Firebase credentials needed; auth bypassed)
- All existing study, import, dashboard, and dictionary features preserved

**Non-Goals:**
- Whisper pronunciation assessment (requires server; deferred)
- Real-time sync across devices (Firestore offline persistence is sufficient)
- Social features, word sharing, or public vocabulary lists
- Migrating existing SQLite data (single-user personal tool; fresh start acceptable)

## Decisions

### D1: Firestore document keyed by `simplified` character

Each user's word state is stored at `users/{uid}/words/{simplified}` where `simplified` is the Chinese character string (e.g., `"爱"`, `"朋友"`).

**Why**: Simplified is the natural join key between the static word dictionary and user SRS data. Using it as the Firestore doc ID eliminates a lookup step and makes Firestore paths human-readable. It's already `UNIQUE` in SQLite.

**Alternative**: UUID from SQLite `words.id`. Rejected because it adds a SQLite lookup before every Firestore read/write.

### D2: Lazy Firestore initialization (absence = Unstudied)

Words that have never been reviewed have no Firestore document. A missing document is treated as `{ intervalMeaning: 0, intervalPinyin: 0, intervalAudio: 0, easeFactor: 2.5, consecutiveFails: 0, nextReviewDate: epoch }`.

**Why**: Avoids writing 1200+ documents when a new user logs in. Firestore charges per document write; creating all words upfront would cost ~$0.002 per new user but is unnecessary. The study session can query due + unstudied words without materializing all of them.

**Alternative**: Initialize all words in Firestore on first login. Rejected for cost and latency reasons.

### D3: Static SQLite served as Netlify CDN asset, loaded via sql.js

`words.db` is a SQLite3 file generated at build time from `server/src/data/hsk.json`. Placed in `client/public/` so Netlify serves it from the CDN. Loaded in-browser via `@sqlite.org/sqlite-wasm` (the official WebAssembly SQLite port).

**Why**: SQLite is ~730 rows and ~50KB — trivially small for a CDN asset. sql.js gives full SQL query support in the browser. The file is cached aggressively (no change between deploys unless HSK data changes).

**Alternative**: Convert HSK data to a static JSON array. Rejected because SQL queries (filter by HSK level, sort by `nextReviewDate`, exclude already-in-Firestore words) are much more convenient than client-side array filtering.

**Alternative**: Fetch word data from Firestore. Rejected because word content is static; paying Firestore read costs on every session start is unnecessary.

### D4: Session queue built entirely client-side

The study session loads all due Firestore documents (querying `nextReviewDate <= now`) and all Unstudied word IDs from SQLite, then merges them into a prioritized queue. New cards (Unstudied) are limited by a daily new-card cap stored in the user's Firestore profile.

**Why**: No server needed for queue construction. Firestore queries support the necessary filter + sort. SQLite in-memory supports the Unstudied pool query.

**Constraint**: Firestore queries require a composite index on `(nextReviewDate, status)`. Must be defined in `firestore.indexes.json`.

### D5: Firestore security rules restrict per-user access

Rules enforce: authenticated users can only read/write their own `users/{uid}/**` subcollection. No cross-user access.

```
match /users/{userId}/{document=**} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

### D6: SRS computation moves to client, no server-side validation

SRS intervals are computed by the same `srs.ts` pure functions, now imported in `client/src/lib/srs.ts`. The client writes the computed state directly to Firestore.

**Why**: No server to validate. The app is single-user (restricted by Firebase Auth allowed email) so malicious self-modification is not a concern.

**Alternative**: Firebase Cloud Function to validate SRS writes. Rejected as over-engineering for a personal tool.

### D7: Firestore data model

```
users/{uid}/
  profile: {
    email: string
    name: string
    picture: string
    dailyNewLimit: number   // default 20
  }

users/{uid}/words/{simplified}/
  intervalMeaning: number    // days (float)
  intervalPinyin: number     // days (float)
  intervalAudio: number      // days (float)
  easeFactor: number         // default 2.5
  consecutiveFails: number   // default 0
  nextReviewDate: Timestamp  // epoch for Unstudied
  status: string             // Unstudied|Weak|Strong|Memorized|Mastered|Leech
  deckName: string           // e.g. "HSK 1" — copied from SQLite at first review

users/{uid}/history/{autoId}/
  simplified: string
  knewPronunciation: boolean
  knewMeaning: boolean
  response: string           // Good|Again|Hard (derived)
  reviewedAt: Timestamp

users/{uid}/dailyStats/{date}/  // date = YYYY-MM-DD
  newCardsSeen: number
  totalReviewed: number
```

History documents are append-only. `dailyStats` is upserted (increment) on each review.

### D8: CSV import uses client-side Papa Parse + Firestore batch writes

The existing `ImportPage` already uses Papa Parse. Remove the server `POST /api/import` call; write parsed rows directly to `users/{uid}/words/{simplified}` via Firestore batch (500 docs per batch, chunked).

Custom words (not in SQLite HSK data) embed their word content in the Firestore document as `customWordData: { simplified, traditional, pinyin, definition }`.

## Risks / Trade-offs

- **Firestore cold-start latency** → First session load queries Firestore + fetches SQLite. On slow connections this may feel slow. Mitigation: cache SQLite in IndexedDB after first fetch; use Firestore offline persistence.
- **words.db cache staleness** → If HSK data changes, users may get stale word content until browser cache expires. Mitigation: version the filename (`words-v2.db`) or use `Cache-Control: no-cache` with ETag.
- **Firestore composite index required** → Querying `nextReviewDate <= now WHERE status != Mastered` needs a composite index. Missing index = query failure. Mitigation: commit `firestore.indexes.json` with the required index.
- **sql.js WASM bundle size** → `@sqlite.org/sqlite-wasm` adds ~700KB to the client bundle. Mitigation: lazy-load the WASM module only when the study session or dictionary page is accessed.
- **No review history migration** → Existing SQLite review history is not migrated to Firestore. Mitigation: acceptable for personal tool; user starts fresh.

## Migration Plan

1. Set up Firebase project (Auth + Firestore) — manual step
2. Add Firebase config to `client/.env`
3. Build and deploy to Netlify with `netlify.toml`
4. Verify Firebase Auth sign-in works on Netlify domain
5. Add Netlify domain to Firebase Auth authorized domains
6. Existing VPS server: shut down PM2 and Nginx after successful Netlify deploy verification

Rollback: keep VPS running for 1 week after Netlify deploy; revert DNS if issues.

## Open Questions

- Should `words.db` include a `notes` column (currently in SQLite words table)? → Yes, carry it through.
- Daily new-card limit: stored in Firestore profile or `client/.env`? → Firestore profile (user-configurable per-device).
