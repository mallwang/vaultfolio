# Implementation Plan: OCR Fallback for PDFs Without a Text Layer

**Branch**: `034-ocr-fallback-pdf` | **Date**: 2026-10-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/034-ocr-fallback-pdf/spec.md`

## Summary

When PDF.js finds no text in a payslip/certificate PDF, the Earnings import and parser-request flows offer on-device text recognition. After explicit per-file consent, the pages are rendered to a canvas with PDF.js and recognised by tesseract.js (German, WASM, self-hosted, lazy-loaded). Word boxes are converted into the existing `PdfDocumentText` (tagged `origin: 'RECOGNISED'`), so parsers and the arithmetic plausibility check stay untouched. Imported rows carry a persisted `recognisedText` marker and a "please double-check" prompt. For unsupported layouts the parser-request flow accepts recognised text; the client-side personal-data scan gets a lenient (shape-only) mode for recognised text so misread check digits cannot let identifiers through; the server scan stays strict and unchanged. A spike on the DATEV sample (see [research.md](research.md) R1) shows labels and large figures are read well, but decimal separators in small print are often lost — hence no auto-healing and a strict check.

## Technical Context

**Language/Version**: TypeScript (Angular frontend, NestJS backend), Nx monorepo

**Primary Dependencies**: existing `pdfjs-dist` 6.3.289; **new** `tesseract.js` ^7 (+ `tesseract.js-core`) and `@tesseract.js-data/deu` (language data) — runtime assets copied into `assets/tesseract/` by Nx asset globs; declared in `apps/frontend/package.json` as well as the root (per project convention)

**Storage**: SQLite via backend — one additive column `ocr_read` on the earnings import-file table (idempotent migration); no browser persistence of OCR data

**Testing**: Jest; recogniser port faked in unit/component tests; optional real-engine integration spec; property-style tests for the lenient personal-data scan; Playwright check via `verify-ui`

**Target Platform**: modern evergreen browsers (WASM + Web Worker); Linux backend

**Project Type**: web-service + frontend Nx monorepo

**Performance Goals**: ≈ 4–6 s per page on a laptop (spike: 3.7–5.8 s); UI stays responsive (OCR in worker); progress updates at least per page

**Constraints**: no network access at runtime for OCR; assets ≈ 5–8 MB lazy-loaded (not in initial bundle, 1 MB budget unaffected); page limit 5, canvas ≤ ~25 MP; nothing derived from the document persisted or cached

**Scale/Scope**: payslips/certificates of 1–2 pages; German only

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle / rule                                               | Assessment                                                                                                                                                                                            |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Library-First                                               | OCR→`PdfDocumentText` conversion, text normalisation and lenient scan are pure, unit-tested code in libs (`@vaultfolio/earnings` for the scan/types, the earnings frontend lib for the adapter). PASS |
| II. API-First                                                  | Only change is an optional boolean on the existing import contract; OpenAPI DTO + drift check updated. No new endpoints. PASS                                                                         |
| III. Test Coverage                                             | Money logic untouched; new logic covered by unit tests (conversion, normalisation, lenient scan with injected misreads, stores). PASS                                                                 |
| IV. Integration Testing                                        | Backend e2e extended for persisting/returning `recognisedText`; optional real-engine spec; UI via Playwright. PASS                                                                                    |
| V. Observability/Simplicity                                    | No document content logged; one new column; engine behind a small port. PASS                                                                                                                          |
| Sensitive Personal Data — "no document handling on the server" | Unchanged: recognition entirely on device; recognised text is raw text and stays on device; the request flow transmits only the anonymised rebuilt structure as in 033. PASS                          |
| Product Scope — Earnings "text-based PDFs" wording             | **Needs amendment** (3.7.0 → 3.8.0 MINOR): import also via PDFs read by consented on-device recognition. Done as the first task, before implementation (spec FR-016). Not a violation once amended.   |
| External resources                                             | No external runtime resource; assets are same-origin. PASS                                                                                                                                            |

**Post-design re-check (Phase 1)**: unchanged — the `ocr_read` column is not encrypted data and has no effect on checks; the lenient scan only runs in the browser; strict server scan untouched. PASS (subject to the constitution amendment task).

## Project Structure

### Documentation (this feature)

```text
specs/034-ocr-fallback-pdf/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ocr-lib.md
├── checklists/requirements.md
└── tasks.md              # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
.specify/memory/constitution.md                       # amend + version bump (first)
specs/032-earnings-domain/{spec,...}.md               # FR-014 amendment note
specs/033-parser-requests/{spec,...}.md               # FR-004 + "OCR out of scope" amendment
apps/frontend/project.json                            # asset globs → assets/tesseract/
apps/frontend/package.json, package.json              # tesseract.js, @tesseract.js-data/deu

libs/earnings/src/lib/
├── parsers/pdf-text.ts                               # PdfDocumentText.origin
├── parser-request/personal-data.ts                   # lenient option (+ spec)
└── ocr-normalise.ts (+ spec)                         # digit-lookalike normalisation in number tokens

libs/frontend/domain/earnings/src/lib/
├── pdf/
│   ├── text-recogniser.ts (port, types)
│   ├── tesseract-recogniser.ts (+ spec)              # render via PDF.js, worker, word→PdfWord
│   └── ocr-layout.ts (+ spec)                        # bbox → points/y-up lines
├── import/                                           # import-session.store + component: consent, progress, marker
├── imports/                                          # list: marker badge
└── parser-request/                                   # store + steps: consent, lenient scan, notice

libs/api-contract/src/lib/earnings.ts                 # recognisedText
apps/backend/src/{database,earnings,openapi}/…        # ocr_read column, repository, DTO
apps/backend/src/tests/earnings.e2e-spec.ts           # persistence e2e
libs/frontend/shared-ui/src/lib/i18n/translations/    # earnings/requests .de/.en
docs/ (user guide, privacy note), docs/frontend/testid-conventions.md usage for new data-testids
```

**Structure Decision**: Extends existing libs only (`@vaultfolio/earnings`, `frontend/domain/earnings`, `api-contract`, backend earnings module); no new Nx project. The OCR engine is isolated behind the `TextRecogniser` port so it is replaceable (e.g. better digit model) and faked in tests.

## Complexity Tracking

No constitution violations requiring justification. Noted risks instead: (1) OCR digit accuracy in small print (mitigated by strict check + correction grid + marker; follow-up idea: per-field digit-whitelist re-recognition); (2) lenient personal-data scan over-matching (acceptable for OCR input, bounded by shape rules); (3) shipping ≈ 5–8 MB of third-party assets (license files to be included with the assets).
