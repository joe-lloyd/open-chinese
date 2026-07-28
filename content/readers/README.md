# Reader content

Authored source for the graded readers. One JSON file per reader, filename `<id>.json`
matching the reader's `id` field. `pnpm build:readers` validates these and emits the
runtime assets into `client/public/data/readers/` (gitignored — these sources are the
only committed source of truth).

## Format

```jsonc
{
  "id": "my-day",
  "title": "我的一天",
  "titleEn": "My Day",
  "description": "Xiao Ming walks you through an ordinary school day.",
  "hskLevel": 1,
  "chapters": [
    {
      "id": "ch1",
      "title": "上午",
      "titleEn": "Morning",
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

A paragraph is an **array of tokens**, not a string. Chinese has no word boundaries, so
segmentation is decided here, at authoring time, rather than guessed in the browser.
Write one token per word, with punctuation as its own token.

A token is either:

- **a bare string** — looked up in `scripts/hsk{1..4}.json`, which supplies its pinyin and
  definition. Never retype those; deriving them keeps readers consistent with the
  dictionary and flashcards, and keeps tone marks correct.
- **an object** with `text`, `pinyin` and `definition` — for anything outside HSK 1–4,
  typically proper nouns. Inline tokens are exempt from the level-fit gate.

## Quality gates

`build:readers` **fails the build** — it does not warn — when a chapter violates any of:

| Gate | Rule |
| --- | --- |
| Gloss coverage | every word token resolves to a pinyin and a definition |
| New-word count | 10–20 words per chapter not already introduced by an earlier chapter of the same reader |
| Repetition floor | every word a chapter introduces appears at least 3× in that chapter |
| Translation coverage | every paragraph has a non-empty English translation |
| Level fit | every token resolved from the HSK data is at or below the reader's `hskLevel` |

The repetition floor is the whole point of a graded reader, and it is the constraint that
shapes authoring most: **every distinct word a chapter introduces counts**, including
function words like `的` and `很`. In practice this means working from a deliberately small
inventory — roughly 15 words used 3–5 times each — rather than writing freely and hoping.
Chapter 1 of a reader introduces everything it contains; later chapters may reuse earlier
vocabulary as often as they like with no repetition requirement.

Thresholds live in one constant block at the top of `scripts/build-readers.ts`.

## Workflow

Write a draft, run `pnpm build:readers`, and let the failures drive the revision — the
error output names the reader, chapter and the exact words that fall short, with their
occurrence counts. Iterate until it is clean.

This is also the intended contract for a future generator: a script that emits files in
this format is subject to exactly the same gates, so a human reviewer only has to judge
whether the story reads well. Everything mechanical is already enforced.
