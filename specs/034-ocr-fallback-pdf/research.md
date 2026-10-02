# Research: OCR Fallback for PDFs Without a Text Layer

## R1 — Spike: PDF.js render + tesseract.js (German) on the DATEV sample

**Setup** (throw-away, outside the repo): `tmp/2025_01.pdf` (DATEV, December 2025, form LNGN16, 1 page, 243 KB). PDF.js `getTextContent()` returns **0 items** (confirms the "text as paths" case). The page was rendered to a canvas at scale 3/4/6 and recognised with tesseract.js 7.0.0 (`deu`, default "fast" model, LSTM).

| Render scale | Recognition time (1 page, Node, WSL2) | Words | Mean confidence |
| ------------ | ------------------------------------- | ----- | --------------- |
| 3            | 3.7 s                                 | 390   | 80.0            |
| 4            | 4.5 s                                 | 391   | 82.7            |
| 6            | 5.8 s                                 | 377   | 83.9            |

**Observations**

- Words come with bounding boxes (`bbox` x0/y0/x1/y1 in render pixels) and confidence — enough to build `PdfWord { text, x, width }` and `PdfLine { y }`.
- Labels, headings, names, large totals (net pay, payout amount) are read correctly at every scale.
- **Systematic weakness: the decimal comma/point disappears or is replaced by noise in small-print figure blocks** (the "Steuer/Sozialversicherung" rows and the year-to-date block): `4.515,00` → `4.51500`, `4.600,00` → `4.600 7 00`, `1.200,00` → `1.20 00 O0`. Higher scale helps little; it is a font-size/print-density issue. Letters in digit positions also appear (`DE0O3` for `DE03` in the account number).
- Consequence: **OCR figures are plausible but not reliable.** Amounts in the small blocks need repair or must fail the arithmetic check visibly. The existing plausibility check (gross − deductions = net) is the safety net; it must not be weakened (spec FR-005).
- No supported parser exists for DATEV LNGN16 today, so this sample exercises User Story 3 (parser request), not User Story 1 (import). Story 1 is exercised with supported layouts (fixtures rendered to images, see R7).
- The spike confirms feasibility of Story 1/3 mechanics; it also shows the "double-check" marker and the correction grid (031/032 FR-012a) are essential, not decoration.

**Decision**: render at scale **3** by default (≈ 216 DPI for a 72-dpi page; best time/accuracy trade-off, bounded canvas memory). Revisit scale 4 if fixtures show gains.

## R2 — Engine choice

- **Decision**: `tesseract.js` v7 (WASM, Apache-2.0), run in its own Web Worker, German model, LSTM only.
- **Rationale**: only mature in-browser OCR with word boxes; the spike proves quality sufficient for labels and large figures; self-hostable.
- **Alternatives**: PaddleOCR/ONNX Runtime Web (better small-digit accuracy but larger models, more glue code, less mature in browsers); browser `TextDetector`/Shape Detection API (not available cross-browser); server-side OCR (rejected by FR-004 — nothing leaves the device).

## R3 — Self-hosting assets, no runtime network

- tesseract.js by default fetches worker, WASM core and language data from CDNs — **forbidden** (FR-004). Configure `workerPath`, `corePath`, `langPath` to same-origin `assets/tesseract/…`, `gzip: false`, and `cacheMethod: 'none'` (no IndexedDB copy of anything; the model is a public asset anyway, but nothing derived from the document may be cached).
- Asset sizes (measured): `tesseract-core-simd-lstm.wasm` ≈ 2.9 MB (+ `-relaxedsimd-lstm`/plain `-lstm` fallbacks ≈ 2.9 MB each), `worker.min.js` ≈ 111 KB, `deu.traineddata` (fast) ≈ 2.0 MB. **≈ 5–8 MB total — well below the 10–20 MB assumed in the issue.** The "best" model (~15 MB) is a fallback option if accuracy of the fast model proves insufficient on fixtures.
- Language data comes from the npm package `@tesseract.js-data/deu` (Apache-2.0); engine from `tesseract.js-core`. Both copied by Nx asset globs at build time, like `pdf.worker.min.mjs` today (`apps/frontend/project.json`). Exact package/variant names to be confirmed at implementation (T-first task: verify package contents, license files).
- Loaded on demand via dynamic `import('tesseract.js')` so the initial bundle budget (1 MB warning) is unaffected, mirroring `loadPdfJs()` (T124).

## R4 — From OCR words to `PdfDocumentText`

- Reuse the existing `PdfDocumentText { pages: PdfPageText[] }` (`PdfLine { text, words[], y }`, `PdfWord { text, x, width }`) — parsers stay unchanged (FR-005).
- Convert tesseract lines/words: x = bbox.x0 / scale, width = (x1 − x0) / scale, y = (pageHeight − bbox.y1) / scale… i.e. normalise to **PDF points with y growing upward** so column-sensitive parsers behave as with PDF.js. Lines sorted top-to-bottom as in `toLines()`.
- Drop words with confidence below a floor (starting value 30) and empty text; keep everything else — repairs happen in R5, not by silently dropping.
- Add `PdfDocumentText.origin?: 'EXTRACTED' | 'RECOGNISED'` (default `EXTRACTED`) so downstream steps know the provenance without changing parser signatures.

## R5 — Figure repair vs. check (do not weaken the check)

- **Decision**: no automatic numeric "healing" (e.g. re-inserting a lost decimal comma) in this feature. A lost comma yields a figure ≥ 100× off; the plausibility check fails and the row lands in the existing correction grid with the "double-check" prompt (spec Story 1 scenario 4). Healing heuristics would guess money values and risk silently wrong data, contradicting "do not weaken the plausibility check".
- Cheap, safe normalisation only, applied to recognised words before parsing: map `O`/`o`→`0`, `l`/`I`→`1`, `S`→`5` **only inside tokens that otherwise match a number/amount pattern** (e.g. `1.20O,00`). Whitespace inside an amount token followed by 2 digits is not merged.
- Follow-up (out of scope): per-field re-recognition of low-confidence amount regions at higher scale with a digit whitelist (tesseract `tessedit_char_whitelist`), which in a quick consideration would fix most dropped commas. Recorded as a possible iteration.

## R6 — Personal-data detection on recognised text (FR-011)

- Server scan (033 FR-017) runs on the **already anonymised submitted structure** and uses strict check digits; it is unchanged and remains the second barrier.
- Client scan (`scanLine`/`scanDocument` in `libs/earnings/src/lib/parser-request/personal-data.ts`) gets a **`lenient` option used only when `origin === 'RECOGNISED'`**: candidates are matched by shape without requiring valid check digits —
  - IBAN: `DE` + 2 characters from `[0-9OolIS]` + 18 further digit-like characters in groups (observed `DE0O3 7601 0085 0004 0XXX XX 94478`), total length per country (DE = 22), whitespace-tolerant;
  - Tax ID: 11 digit-like characters (first ≠ 0) in a run/with single spaces, check digit not required;
  - Social-security number: 12 characters pattern `\d{2} \d{6} [A-Z] \d{3}` shape without check digit;
  - Others (email, phone, postcode+city) are not check-digit based and stay as-is.
- Trade-off: lenient mode over-matches (e.g. an 11-digit amount-like run). For OCR documents over-removal is acceptable (placeholder, never reversible) and the user sees what was found. Over-match is limited by shape rules and by not matching tokens containing `,`/`.` decimal separators for the tax-ID rule.
- A "misread-digit" property test (inject 1–2 character substitutions from the OCR confusion set into valid IBANs/tax IDs/SV numbers) backs SC-005.

## R7 — Test strategy without a real OCR engine in unit tests

- Engine behind an interface (`TextRecogniser`), faked in unit/component tests (feeds scripted words/confidences, errors, cancellation). No WASM in Jest.
- One **integration spec** (opt-in, skipped when the model assets are absent) renders `tmp/`-independent fixture PDFs with PDF.js (`@napi-rs/canvas` in Node) and runs real tesseract.js — verifies word geometry and that a synthetic payslip fixture of a supported layout (made with image-only content) parses end to end. Fixtures are synthetic; the real sample in `tmp/` (git-ignored, contains real personal data) is for manual validation only and is never committed.
- Playwright verification of the UI flow via the `verify-ui` skill.

## R8 — Persisting the "recognised" marker

- **Decision**: new boolean `recognisedText` on `EarningsImportFile` (API contract) → new column `ocr_read INTEGER NOT NULL DEFAULT 0` on the earnings import-file table (idempotent additive migration in `database.service.ts`), returned by the imports list. Not a new `sourceType` value, because OCR applies to both payslip and certificate PDFs and `source_type` has a CHECK constraint and aggregations keyed on it.
- Backend only stores and returns the flag; no behaviour depends on it (no weakening of validation or checks server-side). Not part of the encrypted amounts.

## R9 — Consent UX and progress

- Offer appears in the existing import row / request flow where today's `IMAGE_ONLY` message is shown: explanatory text + "Read text on this device" / "Cancel". Progress bar per page ("Page 2 of 3"), cancel button (terminates the worker, releases canvases).
- Recognition is sequential per file (one worker, reused across pages of that file, terminated afterwards) to cap memory; a page limit of **5 pages** (payslips and certificates are 1–2 pages) and canvas size cap (scale reduced to keep ≤ ~25 megapixels per page).
- Mixed documents (some pages with text): offer only if the document as a whole has no text (spec assumption). Page limit refusal explains the limit.

## R10 — Governance changes

- Constitution: Earnings domain bullet "data enters exclusively by document import — text-based payslip and wage-tax certificate PDFs interpreted on the user's own device…" → "PDFs (text-based, or read by on-device text recognition after the user's consent)…"; MINOR bump 3.7.0 → 3.8.0; also note in Sensitive Personal Data that recognition runs on-device and OCR text is raw text under the same rules.
- 032: FR-014 amended (image-only → recognition offer; message remains for decline/no text). 033: FR-004 and the "Text-based PDFs only"/"Out of scope: OCR" statements amended. Done as a first task, before implementation (spec FR-016).
