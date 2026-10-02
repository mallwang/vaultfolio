# Design: OCR Fallback for PDFs Without a Text Layer

**Mockup**: [mockup.html](./mockup.html) (durable local copy) — originally reviewed at
https://claude.ai/artifact/UvDh62XZnEkcU65wuXj8RS (this remote link may go stale; the local copy is
the source of truth). Approved in the first review round without changes.

## Summary

No new pages. The feature changes three existing surfaces inside the authenticated app shell:
the Earnings import list (rows for PDFs without text), the import preview / saved-imports list
(recognition marker), and step 4 of the parser-request wizard (notice and low-confidence marks).
All content in the mockup is invented; every string exists in English and German in the
implementation (FR-015).

## Layout per region / screen

### 1 Offer (FR-001, FR-002)

The file row that today shows the `IMAGE_ONLY` rejection becomes an undecided row: scan icon,
status tag "Needs your decision", one-line muted text "No automatically readable text found in this
PDF." and an info box with: what recognition does, that the file and text stay in the browser, that
digits can be misread and will need checking. Buttons: primary **Read text on this device**,
outline **Not now**, plus a lock note "Works offline, nothing leaves your device". Nothing starts
before the click; consent is per file.

### 2 Reading (FR-003)

Same row: tag "Reading…", a progress bar with "Page n of N" and an approximate time hint, a
**Cancel** button, and the same lock note. The region is a live region (`role="status"`).

### 3 Import preview (FR-005, FR-006)

Warning callout "Read via text recognition" above the list. The file row carries a **Text
recognition** tag. A failing check keeps the existing correction pattern: reason line, figure
fields with the offending one highlighted and a hint; Save stays disabled until the check passes.

### 4 Saved imports (FR-007)

The same **Text recognition** tag in the "Source" column of the imports table.

### 5 No parser matches (FR-009)

The existing rejected row, plus the recognition tag and the existing **Request a parser** button;
the explanatory text adds that the text was read via text recognition.

### 6 Request preview (FR-010, FR-011, FR-012)

Step 4 of the wizard only. Warning callout "This text was recognised automatically and may contain
errors"; success callout listing the personal-data kinds removed (kinds only, never the data) and
stating that look-alike values are removed even if a digit was misread. Legend and the rebuilt
sheet: removed values as locked grey blocks (including a misread IBAN), low-confidence words
underlined in orange, replaced values dotted-underlined. Steps 1–3 are unchanged from 033.

### 7 Declined / no text / cannot run (FR-008, FR-013, FR-014)

The existing `IMAGE_ONLY` rejection text, unchanged, with a text link "Read text on this device
instead". Cancelled, empty-result, unavailable-engine and page-limit outcomes use the same message;
the last two add one specific hint line. Password-protected or damaged files never get the offer.

## Traceability

| Screen               | Requirements                               |
| -------------------- | ------------------------------------------ |
| 1 Offer              | FR-001, FR-002, FR-004 (lock note), FR-013 |
| 2 Reading            | FR-003, FR-004                             |
| 3 Import preview     | FR-005, FR-006                             |
| 4 Saved imports      | FR-007                                     |
| 5 No parser matches  | FR-009                                     |
| 6 Request preview    | FR-010, FR-011, FR-012                     |
| 7 Declined / no text | FR-008, FR-013, FR-014                     |

## Out of scope for this mockup

German texts, steps 1–3 of the request wizard (unchanged from 033), the Earnings privacy note and
user guide wording, the administrator request views, e-mails.

## Visual language

Approximates the PrimeNG Aura preset defaults, as in the 032 and 033 mockups; exact tokens come from
the real theme. Suggested `data-testid`s (per `docs/frontend/testid-conventions.md`): `ocr-offer`,
`ocr-accept`, `ocr-decline`, `ocr-progress`, `ocr-cancel`, `ocr-notice`, `ocr-badge`,
`image-only-message`, `request-ocr-notice`.
