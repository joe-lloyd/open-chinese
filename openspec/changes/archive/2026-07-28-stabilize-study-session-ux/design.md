## Context

`StudyPage.tsx` renders the review loop as a single vertical flex column: progress bar, a `flex-1 … justify-center` card area, and a grading button area. Inside the card area, three of five regions size themselves from content:

- the hanzi uses `fontSize: clamp(7rem, 18vw, 13rem)` with no width constraint, so a three- or four-character word wraps to a second line and doubles the block's height;
- the definition panel's height depends on definition length and on whether `sentenceZh` / `notes` exist;
- the button area is `min-h-28`, so phases with the extra "Mark as fully known" link are taller than phases without.

Because the card area is vertically centred, any of those changes moves the giant hanzi. The existing `opacity-0` reservations (HSK badge, traditional, the `h-40` pinyin block) only fixed the regions that were easiest to fix.

The reveal regions carry `transition-opacity duration-150` unconditionally, so when `phase` resets to `pron-hidden` on advance the answer fades *out* over 150 ms on top of the next card — a genuine answer leak during rapid grading.

There is no in-session exit. `setDone(true)` is only reachable by exhausting the queue.

Example sentences live in the static word DB (`sentence_zh`, `sentence_en` columns, sourced from `scripts/hsk{1..4}.json`) — there is no `client/src/lib/sentences.ts`. 233 of 740 words carry a sentence. No pinyin is stored for them.

## Goals / Non-Goals

**Goals:**

- The giant hanzi renders at identical pixel coordinates for every card and every phase, at mobile and desktop widths.
- Revealed content disappears within a single frame on every advance path; fade-in is preserved.
- The example sentence can reveal an accurate pinyin reading by hover, tap, or key, without moving anything.
- A session can be ended deliberately at any time, keeping already-graded progress and landing on the normal summary.
- TTS volume is adjustable from inside the session and persists.

**Non-Goals:**

- Redesigning the study screen's visual language. This change is about stability, not aesthetics.
- Per-character ruby annotation of the example sentence. A single pinyin line under the sentence is enough to check a reading.
- Touching the "Mark as fully known" control — `feat/personal-dictionary` owns its removal. The layout must simply not depend on it existing.
- Syncing TTS settings to Firestore. They stay per-device, as `audio-playback` already requires.
- Grading the card that is on screen when a session is ended early. Nothing is invented for it.

## Decisions

### 1. Fixed-height grid instead of more opacity reservations

Every region in the card column gets an unconditional height, so the column's total height is a constant and vertical centring becomes deterministic:

| Region | Mobile | ≥ `sm` |
| --- | --- | --- |
| HSK badge | `h-6` | `h-6` |
| Hanzi | `h-36` | `h-48` |
| Traditional | `h-7` | `h-8` |
| Pinyin + assessor | `h-40` | `h-40` |
| Definition + sentence | `h-52` | `h-56` |
| Grading buttons | `h-36` | `h-36` |

Each region is `flex items-center justify-center` (or `justify-start` where content should hang from the top), so content of differing size grows symmetrically about the region's centre and never displaces its neighbours.

The definition region is the one case where the *reserved* height and the *visible* box are separated: the region is fixed height and centres its child, while the box inside is content-sized with `max-h-full overflow-y-auto`. A one-line definition therefore shows a small card rather than a tall empty one, an oversized definition scrolls inside it, and the region's contribution to the column is constant either way.

The failed-write banner is overlaid (`fixed`) rather than being a flex child. As a child it would take height from the centred column and shift the character for as long as it was on screen — breaking the invariant on exactly the path where the user is already having a bad time.

*Alternative considered:* keeping the flex column and reserving space with invisible clones of the tallest possible content. Rejected — it requires knowing the tallest content, which for a free-text definition is unknowable, and it doubles the DOM.

### 2. Hanzi font size derived from its two real constraints

A fixed-height box alone does not stop a four-character word wrapping. Only two things actually bound the character — the width available to the row, and the height of its box — so it is sized from those directly rather than from a hand-tuned ladder:

```
font-size: min(calc(var(--hanzi-avail) / <char count>), calc(var(--hanzi-box) * 0.92))
```

Both variables are set by Tailwind classes on the box, so they track the breakpoint automatically:

| Variable | Mobile | ≥ `sm` | ≥ `md` |
| --- | --- | --- | --- |
| `--hanzi-box` | `9rem` | `12rem` | — |
| `--hanzi-avail` | `100vw - 3rem` | — | `100vw - 6.5rem` |

`--hanzi-avail` subtracts the row's `px-6`, and from `md` up also the app sidebar's `w-14`. A CJK glyph's advance width equals its font size exactly, so `avail / count` *is* the largest size that fits on one line — no guessing. The `0.92` leaves the glyph room inside its em square.

This is strictly better than a ladder of clamps. It cannot be wrong at a viewport nobody thought to check (a `clamp(6.5rem, 24vw, 11rem)` first cut overflowed its `h-36` box between 600 px and 639 px, where `24vw` exceeds 144 px but `sm:` has not yet applied), and it is far less conservative: at 390 px a two-character word — the overwhelming majority of HSK 1–4 — now renders at 132.5 px rather than 72 px, in a box that was always 144 px tall.

Both terms are viewport- and count-derived only, never content-derived, so the box height stays constant and the character still cannot move.

*Alternative considered:* a single font size small enough for four characters. Rejected — it wastes the screen for the common 1–2 character case, which is the whole point of the giant hanzi.

### 3. Instant hide via a conditional transition class

Rather than a JS-driven "suppress transitions on advance" flag, the transition is simply not present on the hidden state:

```
visible ? 'opacity-100 transition-opacity duration-150' : 'opacity-0 transition-none'
```

CSS transitions are triggered from the *after-change* computed style. Going hidden → visible, the after-change style has a 150 ms transition, so it animates in. Going visible → hidden, the after-change style has `transition: none`, so the opacity change is applied immediately in the same frame. React batches `setPhase`/`setIndex`, so the class flip and the new card's text land in one commit — there is no frame in which the old answer is visible over the new card.

This is applied to the pinyin block, the definition panel, and the sentence-pinyin line, and therefore covers every advance path (grade buttons, keyboard shortcuts, the fail-reveal "Next card" path, "Mark as fully known", and end-session) because all of them funnel through the same `phase` reset.

*Alternative considered:* a `hiding` state plus a `requestAnimationFrame` dance. Rejected — more state, more ways to desynchronise, and it fixes a CSS problem in JS.

### 4. Sentence pinyin generated at build time, stored in `words.db`

`scripts/build-words-db.ts` gains a `pinyin-pro` dependency and writes a `sentence_pinyin` column. Precedence: an explicit `sentencePinyin` field in `scripts/hsk{n}.json` wins; otherwise it is generated from `sentenceZh`. CJK punctuation is mapped to ASCII and the space before it removed, so `我爱我的家人。` yields `wǒ ài wǒ de jiā rén.`

Rationale: `pinyin-pro` is segmentation-aware, so it gets polyphones right in context (`银行` → `yín háng`, `中国的首都` → `shǒu dū`) — which naive per-character lookup does not. Doing it at build time keeps `scripts/hsk{n}.json` free of 231 hand-authored pinyin strings that would drift from the sentences they annotate, and keeps the ~1 MB pinyin dictionary out of the client bundle. The optional authored override exists for the handful of readings a generator will get wrong (e.g. erhua: `哪儿` generates as `nǎ ér`, not `nǎr`).

**Neutral tones are reconciled against the headword's own `pinyin` column in the same loop.** `pinyin-pro` reads every syllable in its full citation tone, so 谢谢 comes back as `xiè xiè` while the dictionary — and the card's own pinyin block, six rows up the same screen — says `xièxie`. That is not a tail case: it affected 37 of the 231 sentences, including all three 得 sentences, which rendered the structural particle as `dé` when demonstrating precisely that grammar point. A reading aid that contradicts the app's own dictionary teaches the wrong thing.

The correction is narrow by construction. Each headword's dictionary reading is split into one syllable per character (by walking it against the generator's own toneless syllabification, and bailing out entirely if the two disagree). Only *neutral-toned* dictionary syllables are recorded, and a syllable in a sentence is only replaced when its toneless base already matches. So the reconciliation can only ever drop a tone the dictionary says is absent — it can never change which syllable is read, and never swaps one tone for another. Longest match wins, so 了解 is read before 了 and 着急 before 着.

That safety net is what keeps everything the generator already gets right: sandhi (`yí gè`, `yì zhī`, `bú dào`, `bù yuǎn`), polyphones (`yín háng`, `shǒu dū`, `dōu`, `cháng`, `hái`, `zhòng yào`, `jiào shì`), and the two places where the *sentence* is more correct than the dictionary (便宜 `pián yi` against a `piányí` headword; 一直 `yì zhí` against the `yīzhí` citation form) are all left untouched.

*Alternative considered:* hand-authoring `sentencePinyin` overrides for the affected sentences. Rejected — 37 today, and every future sentence would need its own, which is the maintenance tax this decision exists to avoid. Reconciliation makes the class of error impossible rather than patched.

*Alternatives considered:*
- *Hand-author `sentencePinyin` for all 233 sentences.* Rejected — a maintenance tax on every future sentence edit, and silent drift when the hanzi changes but the pinyin doesn't.
- *Derive client-side from the word DB per word.* Rejected — the DB is keyed by HSK vocabulary items, and a sentence contains characters and particles that are not themselves entries, so coverage would be full of holes.
- *Bundle `pinyin-pro` into the client and derive at render time.* Rejected — a megabyte of dictionary shipped to every user to annotate at most one sentence per card.

`words.db` is gitignored and rebuilt by `pnpm build:words-db`, so the column appears without a migration. `worddb.ts` uses `SELECT *`, so only the `Word` interface needs the new field.

### 5. Sentence pinyin reveal: pointer-driven, plus an explicit key

`ExampleSentence` holds `hovered` and `pinned`:

- `onPointerEnter` / `onPointerLeave` set `hovered`, but only when `e.pointerType === 'mouse'` — this stops touch's synthesised hover from latching the pinyin on permanently after a tap.
- `onClick` toggles `pinned`, which is what a tap does.
- Visible when `hovered || pinned`.

The control is a `<button>` for semantics but carries `tabIndex={-1}`, so Tab never lands on it and a Space press during study can never be routed to it — study is keyboard-driven and Space means "reveal". Keyboard access is instead a first-class shortcut: `P` toggles the sentence pinyin when the meaning is revealed and the card has a sentence, listed in the help overlay. Both the reveal state and `pinned` reset when the card index changes.

The pinyin line's height is reserved unconditionally inside the example block, so revealing it never reflows the definition panel.

### 6. Session drawer as a local component, not a router surface

`StudySessionDrawer` is a presentational component rendered by `StudyPage` — no route, no context, no global store. It takes `open`, `onClose`, `onEndSession`, and renders a right-anchored panel (`fixed inset-y-0 right-0 w-80 max-w-[85vw]`) over a backdrop, with sections so future entries slot in without restructuring.

Being modal takes three things, not one, and the first cut only did the first:

1. **Keys** — `StudyPage`'s `keydown` handler returns early for everything except `Escape`. The same guard was extended to the keyboard help overlay, which had always let arrow keys grade the card behind it.
2. **Focus** — the study column carries `inert` while the drawer is open, and the drawer moves focus to its close button on open and returns it to the trigger on close. Guarding the key handler alone does nothing about Tab: focus would still walk onto the grading buttons behind the backdrop, where Enter activates them. The closed drawer is itself `inert` for the mirror-image reason.
3. **Paint order** — the drawer sits at `z-[60]`, not `z-50`. `BottomNav` is `fixed … z-50` and is rendered *after* `<main>` in `AppShell`; neither `AppShell`'s root nor `<main>` establishes a stacking context, so at equal z-index the later sibling wins and the mobile nav paints over the drawer and stays tappable — navigating out of the very session "End session now" exists to leave cleanly.

The trigger button sits top-right of the study screen, next to the progress bar, so it is reachable with a thumb on mobile and does not collide with the fixed `? help` control at the bottom-right or the `BottomNav`.

*Alternative considered:* extending the app-level `Sidebar`. Rejected — the sidebar is `hidden md:flex` and global; the session menu is mobile-first and scoped to a running session.

### 7. "End session now" ends the session, it does not abandon it

Every graded card is already written to Firestore optimistically as it is graded, so "progress already made" is durable before the action runs. The handler therefore only needs to: clear the session interval, close the drawer, and `setDone(true)`. The summary then reports exactly the cards that were graded. The card on screen at the time is left ungraded — it stays due, which is the honest outcome.

### 8. TTS volume in the existing per-device settings blob

`TTSSettings` becomes `{ rate, pitch, volume }` with `volume` defaulting to `1.0`, stored in the same `tts-settings` localStorage key and applied as `utt.volume`. `getSettings()` merges the parsed value over the defaults, so an existing stored `{rate, pitch}` blob from before this change yields `volume: 1.0` rather than `undefined` (which would make `SpeechSynthesisUtterance.volume` throw or silently reset).

Volume is exposed in the drawer (where you need it mid-session) and on the Settings page (next to rate and pitch).

## Risks / Trade-offs

- **Fixed heights make the card column taller than a short viewport (e.g. 667 px) once the button area and `BottomNav` are counted.** → The heights above are tuned so the column is a *constant* 820 px, which fits 390×844 and 1440×900 without scrolling; on a 667 px-tall phone the grading buttons sit below the fold and the study area scrolls. That is still an improvement on the current layout, which ranges from 667 px to 964 px depending on the card. Measured in headless Chrome across fourteen card/phase/banner variants at 390×844, 390×667, 600×800, 639×800, 640×800, 768×800 and 1440×900: hanzi centre spread 0.0 px and column-height spread 0 px at every one, against 60 / 56 / 88 px today.
- **A very long definition scrolls inside its panel rather than being fully visible.** → Accepted, and preferable to the current behaviour where it moves the character. The panel is sized to fit every definition currently in the corpus without scrolling.
- **`pinyin-pro` reads neutral-toned syllables in their full citation tone**, contradicting the app's own headword pinyin on the same screen. → Reconciled at build time against the `pinyin` column (decision 4); 37 sentences corrected, 0 regressions. This was the real defect — the first cut of this register named erhua and 一/不 sandhi instead, which the generator already handles correctly. The lesson is that the risk was findable by querying the corpus, and wasn't guessed at.
- **Reconciliation could in principle force a wrong reading onto a sentence** (a headword with a different reading in context). → Prevented structurally, not by review: a syllable is only rewritten when the dictionary marks it neutral *and* the toneless bases already match, so the transformation is only ever "drop a tone". Verified by diffing every changed reading — all 37 are full-tone → neutral and none touch a polyphone or a sandhi.
- **`pinyin-pro` still gets erhua wrong** (`哪儿` → `nǎ ér`, not `nǎr`). → Genuinely a tail case; the authored `sentencePinyin` override exists for it, and generation is build-time so a fix needs no client change.
- **New build-time dependency on `pinyin-pro`.** → Dev-only, in the `scripts` workspace, never shipped to the browser. If it were ever unavailable the column falls back to `null` and the UI simply offers no pinyin reveal.
- **`transition-none` on the hidden state relies on the after-change-style rule for CSS transitions.** → This is specified behaviour in CSS Transitions Level 1 and consistent across engines; the fade-in half is directly observable in the browser, so a regression is visible rather than silent.
- **`StudyPage.tsx` is also being edited by `feat/personal-dictionary`.** → Layout changes are confined to the card column's JSX and the button area's height class; the "Mark as fully known" buttons are left byte-identical so their removal is a clean delete on the other branch.
