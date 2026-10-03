# Contract: shared PDF reading libs (refactor of Earnings internals)

Behaviour-neutral extraction so Retirement can reuse what Earnings built. Public names stay the same;
Earnings re-exports or re-imports them. After the move all existing Earnings specs must pass unchanged.

## `@vaultfolio/document-text` (`libs/document-text`, `scope:shared`, pure TS)

Moves from `libs/earnings`:

- `PdfDocumentText`, `PdfPageText`, `PdfLine`, `PdfWord` (from `parsers/pdf-text.ts`) including the
  `origin: 'EXTRACTED' | 'RECOGNISED'` tag.
- German amount/date token helpers used by parsers (`parseGermanAmount`, date token parsing and the
  `Money` string helpers they rely on, if they are not tied to Earnings types).
- OCR digit normalisation (`ocr-normalise.ts`).

`@vaultfolio/earnings` keeps exporting the same symbols by re-exporting them (no consumer change
required in the first step).

## `@vaultfolio/frontend-document-reader` (`libs/frontend/document-reader`, `scope:shared`)

Moves from `libs/frontend/domain/earnings/src/lib/pdf/`:

- `extractPdfText(file) → { text, hasTextLayer, … }`, `sha256Hex(file)`, `readText(blob)`.
- `TextRecogniser` port, `RecognitionProgress/Error/Result`, `MAX_RECOGNITION_PAGES`, the tesseract
  adapter, `ocr-layout`, `TEXT_RECOGNISER` token, and the scriptable fake (`text-recogniser.testing`).
- A small presentational consent/progress building block (`<vf-ocr-consent>`) used by both domains'
  import screens: inputs `fileName`, `pageCount`; outputs `allow`, `cancel`; plus a progress view.
  Texts come from a shared i18n key group so both domains show identical wording.

Runtime assets stay where `apps/frontend/project.json` already copies them (`assets/tesseract/`);
no new asset or dependency. `pdfjs-dist` moves to this lib's `package.json` (declared in the app's
`package.json` too, per project convention).

## Compatibility rules

- No behaviour change: same extraction, same OCR settings, same limits (5 pages, ~25 MP).
- Nx boundaries: both libs tagged `scope:shared`; the Earnings and Retirement frontend domain libs
  depend on them, never on each other.
- Tests move with the code; the optional real-engine OCR integration spec keeps running in the
  reader lib.
