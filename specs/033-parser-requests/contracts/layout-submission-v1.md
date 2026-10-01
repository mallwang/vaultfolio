# Contract: Layout Submission v1

What the browser sends as `payload` of `POST /requests` for `earnings/new-parser` (FR-015, FR-016).
**Structured layout data only — never a file, never original values.** Defined in
`libs/earnings/src/lib/parser-request/layout-submission.ts`; the same validator runs on the server.
Any key outside this schema, any value outside its range → rejected.

```ts
interface LayoutSubmissionV1 {
  schemaVersion: 1;
  pages: SubmissionPage[]; // 1..3
  ruleDraft?: SubmittedRuleDraft; // optional (FR-013)
}

interface SubmissionPage {
  width: number; // PDF points, 100..2000
  height: number; // PDF points, 100..2000
  lines: SubmissionLine[]; // 1..120
}

interface SubmissionLine {
  y: number; // baseline from top, 0..height
  size: number; // font size in points, 5..20
  words: SubmissionWord[]; // 1..40
}

interface SubmissionWord {
  text: string; // 1..60 chars, see character rule
  x: number; // left edge, 0..width (numbers are already right-aligned by the browser)
}

interface SubmittedRuleDraft {
  lines: {
    // 0..60
    page: number; // index into pages
    line: number; // index into pages[page].lines
    figure: FigureType;
    deduction: boolean;
    column?: { x0: number; x1: number }; // 0 ≤ x0 < x1 ≤ page width
    format?: 'DE_DECIMAL' | 'CENTS' | 'TRAILING_MINUS';
  }[];
  period?: { page: number; line: number; x0: number; x1: number };
}

type FigureType =
  | 'GROSS'
  | 'TAX_GROSS'
  | 'WAGE_TAX'
  | 'SOLIDARITY'
  | 'CHURCH_TAX'
  | 'HEALTH'
  | 'CARE'
  | 'PENSION'
  | 'UNEMPLOYMENT'
  | 'NET'
  | 'PAYOUT'
  | 'IGNORE';
```

## Rules

1. **Exact keys** at every level (no extras, no missing required keys); arrays, not maps.
2. **Limits** (R5): ≤ 3 pages, ≤ 120 lines/page, ≤ 40 words/line, ≤ 3 000 words total, text ≤ 60
   chars, ≤ 60 rule-draft lines, body ≤ 512 kB.
3. **Character rule** for `text`: Unicode letters, digits, space-free printable punctuation
   `. , ; : - _ / ( ) % & + * = ' " € § # @ ! ? °`; **no** control characters (C0/C1), no
   bidi/format characters (U+200B–U+200F, U+202A–U+202E, U+2066–U+2069), no whitespace inside a word.
   The PDF writer additionally maps to WinAnsi/Latin-1 and replaces any other character with `?`.
4. **Numbers** finite, no `NaN`/`Infinity`, coordinates inside the page box.
5. **Personal-data scan** (`scanDocument`) over all words must find nothing (kinds in R3).
6. **Rule draft** references existing lines; carries **no text and no figure values**; the server
   derives the stored `label` from the referenced line's non-digit words.
7. **No hints about the original**: the schema has no field for original text, hashes of the
   original, file name, producer/creator metadata, or timestamps.

## Not in the schema on purpose

File name and size of the user's PDF, PDF metadata (title/author/creator), fonts, images, links,
annotations, form fields, per-word flags such as "was masked" (the server cannot and need not tell
kept labels from masked ones), page text in reading order.

## Versioning

`schemaVersion` is mandatory and currently `1`. A breaking change bumps it; the server rejects
unknown versions with `INVALID_LAYOUT`. Additive fields require a version bump too (strict schema).

## Example (one page, abbreviated)

```json
{
  "schemaVersion": 1,
  "pages": [
    {
      "width": 595.3,
      "height": 841.9,
      "lines": [
        {
          "y": 96.0,
          "size": 9,
          "words": [
            { "text": "Brutto", "x": 56.7 },
            { "text": "3.842,17", "x": 391.4 }
          ]
        },
        {
          "y": 108.0,
          "size": 9,
          "words": [
            { "text": "Lohnsteuer", "x": 56.7 },
            { "text": "512,03", "x": 399.2 }
          ]
        }
      ]
    }
  ],
  "ruleDraft": {
    "lines": [
      {
        "page": 0,
        "line": 1,
        "figure": "WAGE_TAX",
        "deduction": true,
        "column": { "x0": 390.0, "x1": 450.0 },
        "format": "DE_DECIMAL"
      }
    ]
  }
}
```

(All values are randomly generated replacements; the example figures are invented.)
