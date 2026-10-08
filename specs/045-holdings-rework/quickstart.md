# Quickstart: validating Holdings Rework

Prerequisites: `npm ci`; `ENCRYPTION_KEY` set in the backend environment; dev stack running (see `verify-ui` skill).

1. **Unit/e2e**: `npx nx run-many -t test,lint,typecheck -p @vaultfolio/domain-holdings backend @vaultfolio/frontend-domain-holdings @vaultfolio/api-contract`, then `npx nx e2e backend` for `holdings*.e2e-spec.ts`.
2. **Encryption (SC-001)**: create a holding via API, open the SQLite file read-only and confirm `payload_enc` is ciphertext and no isin/name columns exist.
3. **Fail closed**: start the backend without the data key; `GET /holdings` returns 503 and the UI shows the unavailable page.
4. **Precision (SC-004)**: POST crypto `quantity: "0.00000001"` and a metal in `OZT`; GET returns them unchanged; 9 decimals returns 400 `QUANTITY_DECIMALS`.
5. **Seeds (SC-006)**: run the seed tools twice (see `tools/README.md`); both test accounts show the same populated holdings, no duplicates.
6. **UI** (`verify-ui`): sign in as the test account; check each asset type form shows only its fields, metal unit hint, coin search, note counter, "Kaufwert" tile with exclusion hint, empty tile on an account without holdings, no import tab/route.
7. **Admin**: encryption status screen lists Holdings; key rotation re-encrypts it.
