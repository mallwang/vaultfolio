# Data Model: OCR Fallback

No new tables. One additive column and one in-memory type extension.

## In-memory (browser only, never persisted or transmitted)

### `PdfDocumentText` (existing, `@vaultfolio/earnings`)

| Field    | Type                          | Notes                                                       |
| -------- | ----------------------------- | ----------------------------------------------------------- |
| `pages`  | `PdfPageText[]`               | unchanged                                                   |
| `origin` | `'EXTRACTED' \| 'RECOGNISED'` | **new**, optional, default `EXTRACTED`; set by the OCR step |

### `RecognitionProgress` (new, UI state)

| Field       | Type                                        | Notes                         |
| ----------- | ------------------------------------------- | ----------------------------- |
| `phase`     | `'LOADING' \| 'RENDERING' \| 'RECOGNISING'` | engine load, page render, OCR |
| `page`      | number                                      | 1-based current page          |
| `pageCount` | number                                      |                               |
| `fraction`  | number (0..1)                               | within current page           |

### `RecognitionResult` (new)

`{ text: PdfDocumentText }` | `{ error: 'NO_TEXT' | 'TOO_MANY_PAGES' | 'ENGINE_UNAVAILABLE' | 'CANCELLED' }` — all error cases surface the existing "no automatically readable text" message (plus specific hint for `TOO_MANY_PAGES`/`ENGINE_UNAVAILABLE`).

### Consent

Per file, held in the import-session / parser-request store only; reset when the file is removed, replaced or the page is left. Not persisted.

## Persistent

### `EarningsImportFile` (api-contract) — add

| Field            | Type    | Notes                                                         |
| ---------------- | ------- | ------------------------------------------------------------- |
| `recognisedText` | boolean | optional on input (default `false`); always present on output |

### Backend table (earnings import files)

| Column     | Type                                 | Notes                                         |
| ---------- | ------------------------------------ | --------------------------------------------- |
| `ocr_read` | `INTEGER NOT NULL DEFAULT 0` (0 / 1) | added by an idempotent, guarded `ALTER TABLE` |

Validation: boolean only; no effect on arithmetic checks, fingerprint (`file_sha256`), or encryption of amounts. Import preview/commit DTOs and OpenAPI schema updated (drift-detection CI check must pass).

## Parser-request layout submission

Unchanged wire format (033 `layout-submission-v1`). OCR provenance is **not** transmitted (it would let the server infer nothing useful and the sample is a rebuilt, anonymised structure); the request's anonymisation behaves identically after the lenient scan has removed hits.
