## Context

The repository shipped a full architecture migration across two commits without updating the specs that describe it. Commit `8850661` deleted the `server/` workspace — Hono routes, Prisma, the SQLite user-data store, JWT auth, and the server-side SRS module. Commit `5986ae3` then deleted the per-review `users/{uid}/history/{autoId}` collection along with `appendHistory` and `getHistory`.

`openspec/specs/` was written against the pre-migration design and never caught up. Four capability specs now describe machinery that cannot be found in the codebase: an HTTP endpoint with no server, a Firestore collection that was deleted, a SQLite transaction against a database opened read-only in the browser, and an auto-play precondition that no code path can satisfy. A reader following these specs would implement the wrong system.

This change is documentation repair. The shipped behaviour is correct and is treated as the source of truth; the specs move to match it. The only executable change is deleting `client/src/lib/api.ts`, which is already dead.

## Goals / Non-Goals

**Goals:**
- Every normative statement in the four touched specs can be traced to a line of shipped code
- No spec in `openspec/specs/` references the deleted server, the deleted history collection, or a SQLite write path
- All eight capability specs carry a real Purpose instead of the archive placeholder
- `README.md` describes a stack a new contributor can actually run
- `npx openspec validate align-specs-with-firebase-architecture --strict` passes

**Non-Goals:**
- Changing any runtime behaviour. The study flow, Firestore document shapes, keyboard bindings and TTS behaviour are all left exactly as they are
- Fixing the defects other changes own: the dashboard build break, leech wiring, deck priority, pronunciation assessment
- Resolving the "Good multiplier vs graduated learning steps" discrepancy between `openspec/specs/srs-engine/spec.md:84` and `client/src/lib/srs.ts:37-41`. It is a real inconsistency but it is a scheduling decision, not stale architecture, and belongs to whoever owns the SRS tuning
- Correcting the `csv-import` "Duplicate detection" requirement, which claims duplicate rows are skipped when `merge: true` actually overwrites them. Deferred backlog
- Restoring per-review history in any form

## Decisions

### D1: Rename-and-rewrite is expressed as REMOVED + ADDED, never as MODIFIED with a new header

Three of the four stale requirements need both a new name and a different set of scenarios. The OpenSpec archive step will not accept that under `## MODIFIED Requirements`. Verified empirically against this repo's specs with OpenSpec v1.6.0:

- A `MODIFIED` block whose header does not exist in the deployed spec aborts the archive: `srs-engine MODIFIED failed for header "..." - not found`.
- A `MODIFIED` block that drops a scenario present in the deployed spec also aborts: `current spec contains scenario(s) not present in the modified block: "..." Refresh the change spec before archiving to avoid dropping scenarios.`

Both errors abort with no files changed, and neither is caught by `openspec validate --strict` — validation passes on deltas that will fail to archive. So the rule for this change is:

- Use `## MODIFIED Requirements` **only** when the header text matches the deployed requirement exactly and every existing scenario name is carried through. This is used for `Audio replay`, `TTS audio generation`, `Audio replay button` and `Configurable TTS rate and pitch`, where the edits are prose corrections plus added scenarios.
- Use `## REMOVED Requirements` (with `**Reason**` and `**Migration**`) plus `## ADDED Requirements` whenever the requirement is renamed or loses a scenario. This is used for `ReviewHistory captures per-step knowledge state`, `SRS submission after both phases`, `Atomic transactional import` and `Audio playback on card reveal`.

`## RENAMED Requirements` does work (the rename is applied before `MODIFIED` matching), but it does not exempt the follow-up `MODIFIED` block from the "no dropped scenarios" rule, so it solves only half the problem and is not used.

### D2: Review outcomes are aggregates, not a log

The removed `ReviewHistory` requirement is replaced by three requirements that together describe everything a review durably produces:

1. **Word-document counters** — `totalReviews`, `correctMeaningCount`, `incorrectMeaningCount`, `correctPronCount`, `incorrectPronCount`, `lastReviewedAt`, and `firstSeenAt` on first review (`client/src/lib/firestore.ts:115-125`).
2. **Per-day aggregates** — `totalReviewed`, `correctCount`, `incorrectCount`, `newCardsSeen` on `users/{uid}/dailyStats/{YYYY-MM-DD}` (`firestore.ts:143-159`).
3. **An explicit negative** — no per-review document is written anywhere.

The negative is stated as a requirement rather than left implicit because the deleted collection is exactly the thing a reader of the old spec would try to reinstate. It also pins the constraint that motivated the deletion: one write per review with unbounded growth and no read path.

**Alternative considered**: describe only the counters and stay silent about history. Rejected — silence is what let `DashboardPage.tsx` keep importing `getHistory` after the collection was gone.

### D3: The derived response value is specified as non-persisted

`client/src/lib/srs.ts:97-98` computes `response: Good | Hard | Again` and returns it from `applyBinaryReview`. `StudyPage.tsx:103-108` spreads the result into `setUserWord` but `setUserWord` writes an explicit field list (`firestore.ts:96-112`) that does not include `response`, so the value is discarded on every review.

Rather than delete the mention or pretend the value is stored, the spec states plainly that it is a computation detail with no persisted representation, and that `Easy` is never produced. This matters because two other changes reason about it: `fix-dashboard-retention` had to redefine retention away from "answered Good or Easy" precisely because no such rating is ever stored. Documenting the value's status once, here, stops the next reader from assuming a `response` field exists in Firestore.

### D4: Import atomicity is per-chunk, and idempotency is the compensating property

The old requirement promised all-or-nothing semantics that the implementation cannot provide. `importWordsToFirestore` (`firestore.ts:285-312`) slices entries into chunks of 500, builds a `writeBatch` per chunk, and awaits `batch.commit()` in sequence. A Firestore batch is atomic, so each chunk is all-or-nothing — but there is no coordination between chunks. A 1000-row import that fails on the second commit leaves the first 500 words written.

The new requirement states that boundary exactly, and then states the property that makes it acceptable: every write is `batch.set(ref, {...}, { merge: true })` with `ref` addressed by `simplified` as the document id (`firestore.ts:291-307`). Re-running the same CSV re-derives the same document ids and merges the same values, so a partially-failed import is repaired by importing the file again. Idempotency is the design's answer to the missing rollback, so the spec says both things in the same requirement rather than leaving the gap looking like an unmitigated defect.

The progress callback gets its own scenario because it is the only externally observable signal of the chunk boundary: `onProgress?.(batch, total)` at `firestore.ts:311` drives `Writing batch N of M…` at `ImportPage.tsx:137`. Speccing it prevents someone "simplifying" the loop into a single unreported pass.

**Alternative considered**: spec a client-side rollback that deletes previously-written chunks on failure. Rejected — it doubles the write cost, cannot be made atomic either, and would destroy pre-existing SRS state for words that happened to appear in an earlier chunk.

### D5: Auto-play is unconditional; the targeted sub-skill concept is dropped, not repaired

`Audio playback on card reveal` is gated on "the targeted sub-skill is `audio`". Nothing selects a targeted sub-skill: `StudyPage.tsx:10` fixes the flow to `pron-hidden → pron-revealed → meaning-hidden → meaning-revealed`, `StudyPage.tsx:92` hardcodes `lastSubskill: null` when building the state passed to `applyBinaryReview`, `srs.ts:107` hardcodes `lastSubskill: 'meaning'` on the way out, and `intervalAudio` is accepted and ignored as `_intervalAudio` by both `deriveStatus` (`srs.ts:51`) and `checkMastery` (`srs.ts:68`). The precondition is unsatisfiable, which makes the requirement untestable.

The replacement describes the two real triggers: `revealPron` calls `speak(card.simplified)` on every pronunciation reveal (`StudyPage.tsx:163-166`), and `failAndReveal` calls it on every fail at any phase (`StudyPage.tsx:156-161`, added in `5986ae3`).

The `No auto-play for non-audio sub-skills` scenario is **deleted** rather than reworded. It asserts audio must not play when the sub-skill is `meaning` or `pinyin`; the shipped code plays audio on every reveal. Keeping any form of it would leave a scenario that the app fails by design, and dropping a scenario is precisely why this requirement is handled as REMOVED + ADDED under D1.

`intervalAudio` itself is left alone. Two existing `srs-engine` requirements already say it is not assessed and does not block mastery, which is accurate; removing the field is a code change and this change is behaviour-preserving.

### D6: TTS settings are specified as per-device, not per-account

`client/src/lib/tts.ts:8` reads rate and pitch from the `tts-settings` localStorage key and `tts.ts:32` writes it. Nothing syncs them to `users/{uid}` — the profile document holds `email`, `name`, `picture`, `dailyNewLimit` and `deckPriority` (`firestore.ts:33-39`). Since every other user-scoped setting in this app lives in Firestore, an unqualified "the system SHALL expose settings" reads as if these do too. The requirement now names the storage key and states the per-device consequence, so nobody is surprised when their reading speed does not follow them to a second browser.

### D7: Purpose lines are tasks, not delta content

An OpenSpec delta file carries requirement operations only; there is no operation for the `## Purpose` section, and inventing a `## MODIFIED Purpose` heading would be silently ignored at archive time. The eight placeholder Purposes are therefore fixed by tasks that edit `openspec/specs/<capability>/spec.md:4` directly.

This is the one place the change writes outside its own directory into deployed specs, and it covers all eight capabilities — including the four this change does not otherwise touch (`dashboard`, `dictionary`, `pronunciation-assessment`, `queue-manager`) — because a placeholder that says "update Purpose after archive" is stale documentation by the same standard as everything else here, and fixing four of eight would leave the inconsistency looking deliberate.

### D8: `study-session`'s replacement text is copied verbatim from the pending change

`openspec/changes/firebase-netlify-architecture/specs/study-session/spec.md:26-32` already contains a `Review result written directly to Firestore` requirement describing exactly this. That change is unarchived, so the text has never reached `openspec/specs/`. Rather than write a second, differently-worded description of the same behaviour, this change reuses the requirement body and its `Card graded and Firestore updated` scenario verbatim. If both changes archive, the deployed spec ends up with identical text either way.

The one deviation is the delta operation: `firebase-netlify-architecture` files it under `MODIFIED` with a renamed header, which D1 shows will abort its archive. This change files the same text as `REMOVED` + `ADDED`.

## Risks / Trade-offs

- **Overlap with `firebase-netlify-architecture`** → That change has unarchived deltas against `srs-engine`, `study-session` and `csv-import`, and several of its `MODIFIED` headers do not exist in the deployed specs (`SRS state read and written via Firestore adapter`, `Graduated initial learning steps for new cards`, `CSV parsed client-side and written to Firestore`, `Review result written directly to Firestore`). Per D1 those will abort its archive regardless of this change. Mitigation: whichever archives first, the other must be refreshed against the resulting spec before archiving; this change's own deltas are written to be archive-clean today. Worth flagging to whoever archives `firebase-netlify-architecture`.
- **Deleting `api.ts` is the one irreversible action** → Mitigation: the deletion task is preceded by an explicit grep task, and the module is recoverable from git history if a local-dev HTTP fallback is ever wanted again.
- **Specs now pin implementation details** → Naming the 500-document chunk size, the `tts-settings` key and specific Firestore field names couples the spec to the current code, so a future refactor must update both. Accepted deliberately: vague specs are what produced this backlog, and these particular details are externally observable (batch progress UI, per-device settings, dashboard reads).
- **README rewrite loses the Whisper setup instructions** → The `WHISPER_BACKEND` / `OPENAI_API_KEY` block describes a server that no longer exists, so it cannot be followed as written. `client-side-pronunciation-assessment` owns the replacement; until it lands, the README simply will not mention pronunciation setup. The equivalent `DEPLOY.md:232-233` lines are left in place for that change to handle.
- **Purpose text is a judgement call** → Eight one-to-two sentence summaries written from the current requirement sets. If a capability's scope shifts, its Purpose is now something that has to be maintained rather than an obviously-ignorable placeholder. That is the intended trade.
