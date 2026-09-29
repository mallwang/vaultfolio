# Quickstart: Earnings Domain validation

Runnable checks that prove the feature end to end. Details of shapes live in
[data-model.md](data-model.md) and [contracts/](contracts/); this guide only says what to run and
what to expect. Never use real payslips in automated tests or committed files.

## Prerequisites

- Node/npm per `package.json`; dependencies installed (`npm install`).
- `.env` contains `EARNINGS_ENCRYPTION_KEY` — generate one locally:
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
  (document it in `.env.example`; never commit a real key).
- A member test user (see the `verify-ui` skill for the test login) and an admin account.

## 1. Library and backend tests

```bash
npm exec nx test earnings          # libs/earnings: parsers (text fixtures), export reader, checks, aggregations
npm exec nx test backend           # repository/crypto/controller unit tests + earnings e2e-spec
npm exec nx test frontend-domain-earnings   # PDF adapter with generated synthetic PDFs, components
npm exec nx run-many -t lint typecheck
```

Expected: all green; every money assertion uses exact decimal strings.

## 2. Encryption and fail-closed

1. Start the stack (`npm run dev`) with a valid key; import a synthetic payslip via the UI (step 4).
2. Inspect the database: `sqlite3 data/vaultfolio.db "select amounts_enc from earnings_records limit 1"`
   → an opaque `v1:…` string; no amount appears anywhere in the row (SC-006).
3. Restart the backend without `EARNINGS_ENCRYPTION_KEY` (or with a different key) → the Earnings
   page shows "Earnings data is temporarily unavailable"; `GET /api/earnings/overview` returns
   `503 EARNINGS_UNAVAILABLE`; the import button is not offered; Holdings still works.

## 3. Access isolation (SC-005)

- As member A (entitled) import data. As member B (entitled) call every `GET /api/earnings/*` →
  only B's (empty) data. Call `DELETE /api/earnings/imports/<A's import id>` as B → `404`.
- As admin (not owner) → the domain opens, shows only the admin's own data.
- As a member without the `earnings` scope → nav entry hidden, route guarded, API `403`.

## 4. Import flow in the UI (use `verify-ui`)

Use generated synthetic files from `libs/frontend/domain/earnings/src/testing/` (or run the fixture
generator script documented there):

| File                                 | Expected preview row                                |
| ------------------------------------ | --------------------------------------------------- |
| synthetic SAP payslip, Sep           | New, includes correction (Jul), all checks passed   |
| synthetic SAP payslip, Aug (again)   | Replaces (after importing Aug once)                 |
| synthetic certificate                | New, year shown                                     |
| synthetic export v1 JSON             | New, periods range                                  |
| same Sep file again                  | Duplicate, skipped                                  |
| synthetic payslip with net off 12.40 | Rejected: check failed, month and difference shown  |
| image-only PDF                       | Rejected: format not supported yet + companion hint |

Confirm → only the ready files are saved; import history lists them with parser id/version.
While importing, the browser DevTools network tab shows **no** PDF bytes or document text in any
request (SC-004): only `POST /api/earnings/imports/preview` and `POST /api/earnings/imports` with
JSON figures.

## 5. Overview correctness (SC-002)

With the synthetic data set, compare Overview/Tables/Data check values against the expected
figures listed in the fixture README (hand-computed). Switch EN/DE and light/dark; check the 400 px
viewport (no clipped tables, statement scrolls in its container).

## 6. Local parity against earnings-evolution (owner only, not CI)

```bash
EARNINGS_PARITY_PDF_DIR=~/projects/earnings-evolution/payslips \
EARNINGS_PARITY_JSON=~/projects/earnings-evolution/data/earnings.json \
node tools/earnings/parity-check.mjs
```

Expected: every SAP payslip and certificate parses; `mismatches: 0`. The script prints only counts
and field names — never amounts.

## 7. Logs (FR-043)

After step 4, grep the backend log output for any of the imported amounts or for `Entgeltnachweis`
text content → no hits except the `EarningsImport` metadata lines (import id, hash, parser,
counts, outcome).

## 8. Lifecycle and export

- `DELETE /api/earnings/imports/:id` removes only that import's records; the data check reflects
  the gap.
- "Delete all earnings data" empties the domain → empty state.
- Full "Export my data" contains an `earnings/` folder with the user's records.
- Purging a user (retention expiry) removes all four earnings tables' rows for that user.
