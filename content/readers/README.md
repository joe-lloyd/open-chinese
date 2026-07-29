# Reader content

Authored source for the graded readers. One JSON file per reader, filename `<id>.json`
matching the reader's `id` field. `pnpm build:readers` validates these and emits the
runtime assets into `apps/app/public/data/readers/` (gitignored — these sources are the
only committed source of truth).

## Format

```jsonc
{
  "id": "my-day",
  "title": "我的一天",
  "titleEn": "My Day",
  "description": "Xiao Ming walks you through an ordinary school day.",
  "hskLevel": 1,
  "order": 1,
  "goal": "Xiao Ming wants to make a new friend.",
  "conflict": "He is too nervous to start a conversation.",
  "resolution": "A shared book gives them something to talk about.",
  "cover": {
    "image": "reader-covers/my-day",
    "alt": "Two students reach for the same book in a quiet classroom.",
    "focalPosition": "50% 44%",
    "accent": "#B84A3A"
  },
  "chapters": [
    {
      "id": "ch1",
      "title": "上午",
      "titleEn": "Morning",
      "focusWords": ["学校", "学生", "学习"],
      "paragraphs": [
        {
          "tokens": ["我", "叫", { "text": "小明", "pinyin": "Xiǎo Míng", "definition": "Xiao Ming (a given name)" }, "。"],
          "translation": "My name is Xiao Ming."
        }
      ]
    }
  ]
}
```

`cover` is optional. When present, its extensionless `image` base must have committed
`-480.webp` (480×720) and `-960.webp` (960×1440) variants in
`apps/app/public/reader-covers/`. `alt` describes the artwork without repeating the
visible title, `focalPosition` contains two percentages, and `accent` is a six-digit
hex colour. Readers without art use the deterministic UI fallback. See
`content/reader-covers/README.md` for the generation and review workflow.

A paragraph is an **array of tokens**, not a string. Chinese has no word boundaries, so
segmentation is decided here, at authoring time, rather than guessed in the browser.
Write one token per word, with punctuation as its own token.

A token is either:

- **a bare string** — looked up in `packages/build-tools/hsk{1..9}.json`, which supplies its pinyin and
  definition. Never retype those; deriving them keeps readers consistent with the
  dictionary and flashcards, and keeps tone marks correct.
- **an object** with `text`, `pinyin` and `definition` — for proper nouns or anything outside HSK 1–9,
  typically proper nouns. `pinyin` and `definition` must both be non-empty: this is the
  one path the HSK data cannot cross-check, so it is where the gloss gate matters most.
  Inline tokens skip the level-fit check only when the HSK data does not know the word.
  Known later-stage words stay bare strings and are counted as contextual stretch
  vocabulary.

## Quality gates

`build:readers` **fails the build** — it does not warn — when a chapter violates any of:

| Gate | Rule |
| --- | --- |
| Gloss coverage | every word token resolves to a pinyin and a definition, inline tokens included |
| Story structure | every reader declares a goal, conflict and resolution and contains at least three chapters |
| Level sequence | every level has a unique, consecutive `order` starting at 1 |
| Scene depth | every chapter contains at least two translated paragraphs and 30–220 word tokens |
| Focus vocabulary | every chapter identifies 3–8 at-level words it uses deliberately |
| Translation coverage | every paragraph has a non-empty English translation |
| Level fit | later-stage vocabulary is limited to eight distinct words and 20% of word-token occurrences per chapter |
| Originality | identical Chinese paragraphs cannot appear twice in the library |

The old validator required every newly introduced token—including function words—to
appear three times. That rewarded drill-like repetition and is intentionally gone.
Authors now choose focus words that matter to the scene, while a small stretch allowance
lets a story use an essential concrete word without pretending it belongs to an earlier
level. Runtime chapter data exposes both `focusWords` and `stretchWords`.

Thresholds live in one constant block at the top of
`packages/build-tools/build-readers.ts`.

The official advanced vocabulary source is a single HSK 7–9 band. Reader metadata
uses OpenChinese's documented HSK 7, 8 and 9 editorial stages; see
`packages/build-tools/HSK_DATA.md`.

## Workflow

Write a draft, run `pnpm build:readers`, and let the failures drive the revision — the
error output names the reader, chapter and the exact words that fall short, with their
occurrence counts. Iterate until it is clean.

The bundled library is explicitly authored in `scripts/generate-reader-library.mjs`;
the script only segments the written prose and serialises it. Run
`pnpm generate:readers` after editing the stories, then run
`pnpm build:readers` to apply the same quality gates as a hand-authored reader.
