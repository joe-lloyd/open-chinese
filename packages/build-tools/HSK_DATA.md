# HSK vocabulary data

The committed `hsk1.json` through `hsk9.json` files are the app-ready,
level-exclusive vocabulary stages. HSK 1–6 preserve their source assignments.
GF0025-2021 and the current HSK exam publish advanced vocabulary as one HSK
7–9 band rather than as three official word lists.

For a manageable nine-stage learning path, OpenChinese deterministically divides
the 5,606-word advanced band into HSK 7 (1,869), HSK 8 (1,869), and HSK 9
(1,868). This is an editorial learning progression, not an official vocabulary
claim. The importer ranks shorter forms built from earlier-stage characters
first, then moves words containing less familiar advanced characters,
four-character forms, and explicitly literary, archaic, dialect, technical, or
idiomatic definitions later. The complete official advanced band remains intact:
no words are added, removed, or duplicated.

Run `pnpm import:hsk` to rebuild the files. The importer:

1. takes the level assignments and intended readings from the cleaned
   [HSK 3.0 index](https://github.com/ivankra/hsk30/tree/4ff9e3915ce87baaecd7ebe263085573a4ea3192),
   which traces back to the PRC Ministry of Education's GF0025-2021 standard;
2. takes traditional forms and English definitions from
   [Complete HSK Vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary/tree/7ac65bf1a6387d35f1ade478906172a19311c7f9);
3. preserves the hand-authored example sentences and established glosses that
   were already present in this project.

Both upstream datasets are MIT licensed. Their required notices follow.
The importer pins both commits and checks every source and output count so
regeneration cannot silently change the shipped corpus or the editorial split.

## hsk30

Copyright (c) 2023 Ivan Krasilnikov

Copyright (c) 2021 Shawky

Copyright (c) 2021 Pleco Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Complete HSK Vocabulary

Copyright (c) 2026 Yanis Zafirópulos

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
