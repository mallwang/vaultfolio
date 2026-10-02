# Quickstart: Validating the OCR Fallback

Prerequisites: `npm install`; the test user from the `vaultfolio-test-login` memory / `verify-ui` skill; running app (see `verify-ui`).

## 1. Unit and component tests

```bash
npx nx run-many -t test -p earnings frontend-domain-earnings backend api-contract
npx nx run-many -t lint -p earnings frontend-domain-earnings backend
```

Expect: lenient personal-data scan tests (misread-digit property tests), recogniser-port fakes, consent/progress/cancel store tests, persistence of `recognisedText`.

## 2. Real-engine integration spec (optional, needs assets)

```bash
npx nx run frontend-domain-earnings:test --testPathPattern=ocr.integration
```

Skipped automatically when the tesseract assets are not present. Renders a synthetic image-only payslip fixture and checks that a supported parser accepts the recognised text.

## 3. Manual / Playwright flow (`verify-ui`)

1. Earnings → Import → select a synthetic image-only supported payslip → the recognition offer appears, **nothing starts yet**.
2. Decline → existing "no automatically readable text" message.
3. Select again → accept → per-page progress, cancel works → on success the preview shows the "read via text recognition – please double-check" notice; figures failing the check are flagged and editable; save → row marked in the imports list.
4. Select `tmp/2025_01.pdf` (DATEV sample, no parser) → accept recognition → "Request a parser" is available → preview shows recognised content with the "may contain errors" notice; IBAN/tax ID areas are removed even with misread digits; send is blocked until rescan is clean.
5. DevTools Network: no request carries file/text, no third-party host is contacted, tesseract assets come from `/assets/tesseract/`.

## 4. Governance checks

- Constitution version 3.8.0; 032 FR-014 and 033 FR-004 amended; user guide + privacy note mention on-device recognition.
- `npx nx run backend:openapi-check` (drift detection) passes.
