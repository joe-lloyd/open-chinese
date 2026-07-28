## Context

OpenChinese is a fully client-side app: React 18 + TypeScript + Vite, Tailwind, Netlify static hosting, no server of our own. Static word data ships as a SQLite file (`client/public/words.db`, generated at build time from `scripts/hsk{1..4}.json` and fetched into sql.js). Per-user state lives in Firestore under `users/{uid}` with a `words/{simplified}` subcollection where a **missing document means the word is unstudied/unencountered**.

Graded readers are the first feature that needs *prose* content rather than a word list. Two things make that non-trivial:

1. **Where does the prose come from?** The user explicitly asked for this to be brainstormed rather than assumed.
2. **Chinese has no word boundaries.** Per-word hover/tap requires knowing where words start and end.

Four other branches are in flight against the same base (personal dictionary, study-session UX, dashboard redesign, monetization), so this design deliberately keeps its edits to shared files (`App.tsx`, `Sidebar.tsx`, `session.ts`, `firestore.ts`) as small and additive as possible.

## Goals / Non-Goals

**Goals:**

- A first-class Readers section with per-reader and overall completion progress.
- A reading surface that is genuinely pleasant: large text, generous leading, pinyin toggle, per-word lookup by hover on desktop and tap on touch.
- Words the user has never encountered are visually distinct, and finishing a chapter moves them into the personal dictionary.
- A content format and build pipeline that a human author *or* a future generator can both target, with automated quality gates encoding what makes a graded reader good (bounded new-word count, repetition floor, complete glosses).
- Ship real content now — a working HSK 1–2 slice checked into the repo — without waiting on the sourcing decision.

**Non-Goals:**

- No runtime LLM calls, no API keys, no server. Readers must work offline once loaded.
- No entitlement/paywall logic (the monetization branch owns that); the design only avoids making gating hard.
- No SRS scheduling changes. Reader-encountered words enter the pool as unstudied; the existing scheduler decides when they come up.
- No in-app authoring or editing UI.
- No audio narration, no comprehension quizzes. Both are natural follow-ups; neither is in this slice.

## Decisions

### D1. Content sourcing — how do we get the prose?

This is the open question the user asked to have brainstormed. Five realistic options:

**A. Hand-authored, checked into the repo.**
The author writes each chapter against a target HSK word list.
*Cost:* high human time (~1–2 hours per good chapter), zero money.
*Licensing:* clean — we own it outright, no attribution, no share-alike, safe to sell.
*Quality:* highest ceiling. A human can make a story that is actually worth reading and can hit the "repeat every new word ≥3 times" constraint deliberately rather than by luck.
*Offline:* perfect — it is just a static asset.
*Scaling:* poor. This does not get us 50 chapters.

**B. Build-time LLM generation with a human review gate.**
A script prompts a model with a target HSK level, the allowed word list, and the words to introduce; output is written to `content/readers/*.json`, validated by the same script that validates hand-authored content, and **committed to the repo after a human reads it**. Generation happens on a developer machine, never in CI or the browser.
*Cost:* cents per chapter, plus review time (minutes, not hours).
*Licensing:* output of a generation run, committed by us — no third-party licence to propagate. Worth noting model-output ownership varies by jurisdiction, but for our purposes it is ours to ship.
*Quality:* good with a tight prompt and a hard validator, but LLMs reliably drift out of the target vocabulary and produce bland, samey stories. The validator catches vocabulary drift mechanically; blandness needs a human.
*Offline:* perfect — the artifact is still a static asset.
*Scaling:* excellent. This is the only option that gets us to dozens of readers.

**C. Runtime LLM generation via a user-supplied API key.**
The app calls a model from the browser when the user opens a chapter.
*Cost:* pushed onto the user, and it makes the app depend on a third party.
*Licensing:* fine, but a browser-held API key is an exfiltration risk and CORS/proxy pain.
*Quality:* unreviewed and unrepeatable — two users get different stories, so progress tracking, "new words introduced" counts and any future paid pack all become meaningless.
*Offline:* broken outright.
*Verdict:* rejected. It contradicts the app's no-server, offline-capable, static-hosting posture, and it makes content unreviewable.

**D. Public-domain / CC-licensed graded reader corpora.**
Sources like Mandarin Companion (commercial, not licensed for reuse), the Chinese Text Project (classical, far too hard), Tatoeba (CC-BY 2.0 FR, but isolated sentences not stories), and various CC-BY-SA graded reader collections.
*Cost:* zero money, moderate integration time (segmentation, glossing, HSK-level auditing).
*Licensing:* the trap. CC-BY needs per-chapter attribution UI; CC-BY-SA is share-alike and would infect any paid pack; NC clauses kill monetization entirely. Every source needs individual legal review.
*Quality:* variable, and crucially **not graded to our word list** — the "10–20 new words per chapter, each repeated 3+ times" property is exactly what these corpora do not guarantee.
*Offline:* fine once imported.
*Verdict:* useful as raw material or inspiration, not as a primary pipeline. Revisit only for specific well-licensed sources.

**E. User-imported text.**
The user pastes or uploads their own text and the app segments and glosses it.
*Cost:* zero content cost; needs runtime segmentation (see D2) and a much more forgiving unknown-word path.
*Licensing:* the user's problem, not ours.
*Quality:* whatever the user brings — by definition not graded.
*Offline:* fine.
*Verdict:* a genuinely good **future feature**, but it is a different product surface ("read anything") from graded readers ("read something calibrated to you"). Out of scope here; the token format below is deliberately compatible with it.

**Decision: A now, B next, E later; D opportunistically; C never.**

Ship hand-authored HSK 1–2 content in this change so the feature is real and the format is proven against actual prose. Structure the pipeline so that a generator (B) is a drop-in producer of the same authored source format — the validator does not care whether a human or a model wrote the file, which is precisely what makes the review gate cheap. That keeps the feature unblocked while leaving the scaling path open.

### D2. Segmentation — pre-segment at authoring time

Chinese text has no spaces, so `你在哪儿工作` must become `你 / 在 / 哪儿 / 工作` before any per-word interaction is possible. Options:

- **Runtime segmentation** with a JS port of jieba or a maxmatch pass over `words.db`. Costs a dictionary load and a nontrivial bundle; maxmatch is wrong often enough to be annoying (`我的` vs `我 / 的`, `没有` vs `没 / 有`), and errors surface directly in the reading UI where they are most damaging.
- **Pre-segmentation at authoring time** — the chapter *is* an array of tokens. Zero runtime cost, zero ambiguity, and segmentation errors are caught in review rather than in front of the learner.

**Decision: pre-segment.** The authored source stores each paragraph as an array of token strings; the build script attaches pinyin and gloss to each. Runtime segmentation is only needed for user-imported text (option E above), which is out of scope — and if it lands later it can produce the same token array, so the reading UI does not change.

### D3. Content format and pipeline

Two layers, mirroring how `words.db` is already handled:

```
content/readers/<readerId>.json      # authored source, committed
  → scripts/build-readers.ts         # enrich + validate
    → client/public/data/readers/    # runtime assets, gitignored
```

**Authored source** (`content/readers/my-day.json`) holds reader metadata plus chapters. A paragraph is an array of tokens, where a token is either a bare string (looked up in the HSK data) or an object carrying an inline gloss for anything not in `words.db` — proper nouns, characters outside HSK 1–4:

```json
{
  "id": "my-day", "title": "我的一天", "titleEn": "My Day", "hskLevel": 1,
  "chapters": [{
    "id": "ch1", "title": "早上", "titleEn": "Morning",
    "paragraphs": [{
      "tokens": ["我", "叫", { "text": "小明", "pinyin": "Xiǎo Míng", "definition": "Xiao Ming (given name)" }, "。"],
      "translation": "My name is Xiao Ming."
    }]
  }]
}
```

Deriving pinyin and definitions from `scripts/hsk*.json` rather than retyping them means tone marks and glosses are correct by construction and stay consistent with the dictionary and flashcards. It also makes authoring dramatically cheaper: the author writes only the story.

**Runtime asset**: one JSON file per reader (chapters are short; a whole reader is a few tens of KB) plus an `index.json` manifest. One-file-per-reader matters beyond convenience — a reader is the natural unit for a future content pack or paid product, so gating or CDN-hosting one is a single-asset decision.

Generated output is **gitignored and built in CI**, exactly like `words.db`, so the authored source stays the single source of truth and generated files never turn up in diffs.

**Validation gates** (build fails, not warns):

| Gate | Rule | Why |
| --- | --- | --- |
| Gloss coverage | every word token resolves to a pinyin + definition | a token with no popover is broken UI |
| New-word count | 10–20 words first introduced per chapter | the user's explicit grading requirement |
| Repetition floor | every newly-introduced word appears ≥3× in its chapter | this *is* the reinforcement mechanic; without it a "graded reader" is just a story |
| Translation coverage | every paragraph has an English translation | the translation toggle must never show blanks |
| Level fit | tokens resolved from HSK data are at or below the reader's level | otherwise the HSK label lies |

Making these hard errors rather than warnings is the point of the pipeline: they are the machine-checkable half of "is this a good graded reader?", and they are what makes an LLM generator (D1 option B) safe to adopt later — the reviewer only has to judge whether the story reads well, because everything else is already enforced.

### D4. "Not yet encountered" and what completion writes

A word is **encountered** iff a document exists at `users/{uid}/words/{simplified}`. That is already the model's meaning of "not unstudied", it needs no new field, and it unifies "studied in flashcards" with "met in a reader" exactly as the user described ("not yet encountered in reading **or** studying").

On chapter completion the app batch-writes a document for every new word in the chapter:

```
status: 'Unstudied', intervals 0, easeFactor 2.5, nextReviewDate: epoch,
deckName: <HSK deck from words.db, else 'Readers'>,
encounteredAt: serverTimestamp(), encounteredIn: '<readerId>/<chapterId>',
customWordData: { … }   // only for words absent from words.db
```

Writing `status: 'Unstudied'` rather than inventing a new status value keeps the existing `WordStatus` union and every `status`-based filter in the app untouched — a deliberate choice given four branches are editing those same surfaces concurrently.

**This exposes a latent bug.** `buildQueue` computes its new-card pool as "words in `words.db` with no user document". A reader-encountered word has a document, so it would silently become unstudiable forever. The fix is to define the pool by *not yet studied* instead of *no document*:

```ts
const startedSimplifieds = new Set(
  allUserWords.filter((w) => w.status !== 'Unstudied' || w.intervalMeaning > 0).map((w) => w.simplified)
)
```

This is a strict improvement independent of readers — a word touched only by `saveNotes()` is currently excluded from new cards for the same wrong reason.

### D5. Reader progress storage

New subcollection `users/{uid}/readerProgress/{readerId}`:

```
readerId, completedChapters: string[], lastChapterId, lastReadAt, updatedAt
```

Plus a denormalised pointer on the profile document `users/{uid}`:

```
lastRead: { readerId, chapterId, readerTitle, chapterTitle, at }
```

The duplication is intentional. The dashboard's "continue reading your last story" needs one document read, and it already reads the profile — without the pointer it would have to fetch the whole `readerProgress` collection and sort it. The subcollection remains authoritative for progress; `lastRead` is a cache.

`completedChapters` as an array is safe here: chapters per reader are in the single digits to low tens, so the array stays far from Firestore's 1 MiB document limit, and `arrayUnion` makes re-completion idempotent without a read.

`firestore.rules` already matches `users/{userId}/{document=**}`, so the new subcollection is covered without a rule change; the rules file comment is updated so the enumeration stays honest.

**Reading position within a chapter is not stored.** Chapters are short by design — a screen or two. Persisting scroll offsets buys nothing and would need throttled writes.

### D6. Reading UI

- **Routes**: `/readers` (all readers) → `/readers/:readerId` (chapter list) → `/readers/:readerId/:chapterId` (the reading surface). Three routes rather than a single expanding page so the dashboard can deep-link straight into a chapter.
- **Pinyin** uses native `<ruby>`/`<rt>`. The browser handles the annotation baseline and line-box growth, which hand-rolled stacked flex columns get wrong as soon as text wraps.
- **Hover vs tap**: one popover element at page level, positioned from the active token's `getBoundingClientRect()` and clamped to the viewport. Tap/click always toggles it; `matchMedia('(hover: hover)')` additionally opens it on pointer enter, so desktop gets hover without touch devices firing a phantom hover on tap. Closes on Escape, outside click, or scroll.
- **Unknown words** render with an `bg-accent/15` wash and a dotted underline. Only `accent` is used — `--color-correct` / `--color-incorrect` / `--color-unrecognized` exist in `index.css` but are *not* registered in `tailwind.config.ts`, so classes like `text-correct` used elsewhere in the app currently emit nothing. Fixing that config is a separate concern and would conflict with concurrent branches.
- **Completion** is an explicit "Mark as finished" button at the end of the chapter, not a scroll heuristic. It then shows exactly which words were added to the dictionary and offers the next chapter.

### D7. Not blocking on monetization

Gating stays possible without being built: readers are addressed by id, content is one asset per reader, and the manifest is the single place a `free: boolean` or entitlement check would land. No gating code ships here.

## Risks / Trade-offs

- **Hand-authored content does not scale** → accepted deliberately. The slice proves the format; D1 option B (build-time generation behind the same validator) is the scaling path and needs no format change.
- **Pre-segmentation cannot handle arbitrary user text** → accepted. User-imported reading is a separate feature; if built, a runtime segmenter emits the same token array and the reading UI is unchanged.
- **Hard validation gates could block a legitimate chapter** (e.g. a deliberately dense chapter introducing 22 words) → the thresholds live in one constant block in `build-readers.ts` and the failure message names the offending chapter and words, so loosening is a one-line, reviewed change rather than a silent slide in quality.
- **`lastRead` can drift from `readerProgress`** if a write partially fails → the cache is display-only; the readers list and progress bars always read the authoritative subcollection, so drift degrades one dashboard CTA and nothing else.
- **Bulk word writes on completion** — up to ~20 documents in one `writeBatch`, well inside the 500-op limit, one round trip.
- **Concurrent-branch conflicts on `App.tsx` and `Sidebar.tsx`** → both edits are single-line additions to a route table and a nav array; conflicts will be trivially resolvable.
- **`buildQueue` pool change affects study behaviour** → it can only *add* cards to the new-card pool (documents that are `Unstudied` with zero interval), never remove them, so the blast radius is bounded and the direction is the intended one.
