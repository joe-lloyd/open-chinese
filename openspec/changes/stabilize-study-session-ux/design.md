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
| Hanzi | `h-36` | `h-52` |
| Traditional | `h-7` | `h-8` |
| Pinyin + assessor | `h-36` | `h-40` |
| Definition + sentence | `h-52` | `h-56` |
| Grading buttons | `h-36` | `h-36` |

Each region is `flex items-center justify-center` (or `justify-start` where content should hang from the top), so content of differing size grows symmetrically about the region's centre and never displaces its neighbours. The definition panel is `overflow-y-auto` internally: an unusually long definition scrolls inside its box rather than resizing it.

*Alternative considered:* keeping the flex column and reserving space with invisible clones of the tallest possible content. Rejected — it requires knowing the tallest content, which for a free-text definition is unknowable, and it doubles the DOM.

### 2. Hanzi font size derived from character count

A fixed-height box alone does not stop a four-character word wrapping. The font size is chosen from `[...card.simplified].length` so the word always fits on one line:

| Chars | `font-size` |
| --- | --- |
| 1 | `clamp(6rem, 24vw, 11rem)` |
| 2 | `clamp(4.5rem, 18vw, 9rem)` |
| 3 | `clamp(3.5rem, 13vw, 7rem)` |
| ≥ 4 | `clamp(2.5rem, 9.5vw, 5.5rem)` |

Combined with `whitespace-nowrap`, `leading-none` and a fixed-height centred box, a 1-char and a 4-char card put their optical centre in the same place. The box is intentionally taller than the largest font size so `leading-none` clipping of descenders cannot occur.

*Alternative considered:* a single font size small enough for four characters. Rejected — it wastes the screen for the overwhelmingly common 1–2 character case, which is the whole point of the giant hanzi.

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

Rationale: `pinyin-pro` is segmentation-aware, so it gets polyphones right in context (`银行` → `yín háng`, `中国的首都` → `shǒu dū`) — which naive per-character lookup does not. Doing it at build time keeps `scripts/hsk{n}.json` free of 233 hand-authored pinyin strings that would drift from the sentences they annotate, and keeps the ~1 MB pinyin dictionary out of the client bundle. The optional authored override exists for the handful of readings a generator will get wrong (e.g. erhua: `哪儿` generates as `nǎ ér`, not `nǎr`).

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

While the drawer is open, `StudyPage`'s `keydown` handler returns early for everything except `Escape` (closes the drawer). Without that, arrow keys would grade cards behind the open drawer.

The trigger button sits top-right of the study screen, next to the progress bar, so it is reachable with a thumb on mobile and does not collide with the fixed `? help` control at the bottom-right or the `BottomNav`.

*Alternative considered:* extending the app-level `Sidebar`. Rejected — the sidebar is `hidden md:flex` and global; the session menu is mobile-first and scoped to a running session.

### 7. "End session now" ends the session, it does not abandon it

Every graded card is already written to Firestore optimistically as it is graded, so "progress already made" is durable before the action runs. The handler therefore only needs to: clear the session interval, close the drawer, and `setDone(true)`. The summary then reports exactly the cards that were graded. The card on screen at the time is left ungraded — it stays due, which is the honest outcome.

### 8. TTS volume in the existing per-device settings blob

`TTSSettings` becomes `{ rate, pitch, volume }` with `volume` defaulting to `1.0`, stored in the same `tts-settings` localStorage key and applied as `utt.volume`. `getSettings()` merges the parsed value over the defaults, so an existing stored `{rate, pitch}` blob from before this change yields `volume: 1.0` rather than `undefined` (which would make `SpeechSynthesisUtterance.volume` throw or silently reset).

Volume is exposed in the drawer (where you need it mid-session) and on the Settings page (next to rate and pitch).

## Risks / Trade-offs

- **Fixed heights make the card column taller than a short viewport (e.g. 667 px) once the button area and `BottomNav` are counted.** → The heights above are tuned so the mobile column plus chrome fits a 740 px viewport; below that the page scrolls, and because every height is a constant the scroll offset is identical on every card, so the hanzi still does not move relative to the page. Verified at 390×844 and 1440×900.
- **A very long definition scrolls inside its panel rather than being fully visible.** → Accepted, and preferable to the current behaviour where it moves the character. The panel is sized to fit every definition currently in the corpus without scrolling.
- **`pinyin-pro` gets some readings wrong (erhua, rare proper nouns, 一/不 tone sandhi).** → The authored `sentencePinyin` override in the source JSON exists precisely for these, and generation happens at build time so a wrong reading is fixable without a client change.
- **New build-time dependency on `pinyin-pro`.** → Dev-only, in the `scripts` workspace, never shipped to the browser. If it were ever unavailable the column falls back to `null` and the UI simply offers no pinyin reveal.
- **`transition-none` on the hidden state relies on the after-change-style rule for CSS transitions.** → This is specified behaviour in CSS Transitions Level 1 and consistent across engines; the fade-in half is directly observable in the browser, so a regression is visible rather than silent.
- **`StudyPage.tsx` is also being edited by `feat/personal-dictionary`.** → Layout changes are confined to the card column's JSX and the button area's height class; the "Mark as fully known" buttons are left byte-identical so their removal is a clean delete on the other branch.
