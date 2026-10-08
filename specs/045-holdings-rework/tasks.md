# Tasks: Holdings Rework

**Input**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/holdings-api.md](./contracts/holdings-api.md), [design.md](./design.md), [quickstart.md](./quickstart.md)

**Tests**: Required (SC-008, FR-025, constitution Principle III): exact-value assertions, co-located with each change. Test tasks are listed before the implementation they cover; write them first and see them fail.

**Format**: `- [ ] T### [P?] [US#?] Description with file path` — `[P]` = different files, no dependency on an incomplete task.

**Real Nx project names** (verified): `@vaultfolio/domain-holdings` (libs/domain/holdings), `backend` (apps/backend), `@vaultfolio/frontend-domain-holdings` (libs/frontend/domain/holdings), `@vaultfolio/api-contract`. Run through `npx nx ...` (npm, never pnpm).

**Verified constraints that shape the tasks**:

- `libs/domain/holdings` is tagged `scope:domain`; `scope:frontend-domain` (and `scope:frontend`) may only depend on `scope:shared` (`eslint.config.mjs` depConstraints). Today the frontend therefore duplicates the field table in `libs/frontend/domain/holdings/src/lib/asset-type-fields.ts`. `libs/insurances` (and earnings, wealth, retirement) are `scope:shared`. FR-018 / research §6 is met by retagging the holdings domain lib to `scope:shared` (T002).
- Neither `.env` nor `apps/frontend/src/environments/environment.local.ts` may be read. UI/seed verification uses the test account `claude@allwang.family` with `VAULTFOLIO_TEST_EMAIL` / `VAULTFOLIO_TEST_PASSWORD` from the gitignored `.env.local`. Never delete its seeded Earnings data.
- After Foundational the backend and frontend do not compile against the new contract until US1 (backend) and US2 (frontend) are done. US1 + US2 are therefore one deliverable (the MVP); US3–US7 are independent increments on top.

---

## Phase 1: Setup

- [x] T001 Correct the planning docs: in specs/045-holdings-rework/plan.md the encryption test helper is `apps/backend/src/encryption/encryption.testing.ts` (not under `libs/api-contract`) and note the retag from T002; in specs/045-holdings-rework/quickstart.md step 1 replace the placeholder with `npx nx run-many -t test,lint,typecheck -p @vaultfolio/domain-holdings backend @vaultfolio/frontend-domain-holdings @vaultfolio/api-contract`
- [x] T002 Retag `libs/domain/holdings/package.json` `nx.tags` from `scope:domain` to `scope:shared` (as `libs/insurances/package.json`); check how `libs/frontend/domain/insurances/package.json` references `@vaultfolio/insurances` and do the same for `@vaultfolio/domain-holdings` in `libs/frontend/domain/holdings/package.json` (add a dependency only if insurances does); run `npm install` at the repo root; confirm `npx nx lint @vaultfolio/domain-holdings` and `npx nx lint backend` still pass

---

## Phase 2: Foundational (final data shape in the framework-free libs; blocks all stories)

**Purpose**: Catalogues, units, field definitions, validation, merge key, API contract and i18n files in their final shape.

- [x] T003 [P] Create `libs/domain/holdings/src/lib/metal-catalog.ts` (4 entries `{ code: 'XAU'|'XAG'|'XPT'|'XPD', symbol }`, helper `findMetal(code)`) with `libs/domain/holdings/src/lib/metal-catalog.spec.ts` (exact entries, unknown code → undefined)
- [x] T004 [P] Create `libs/domain/holdings/src/lib/crypto-catalog.ts` (~60 entries `{ id (CoinGecko id), symbol, name }`, includes `bitcoin`/`ethereum`, helper `findCoin(id)`) with `libs/domain/holdings/src/lib/crypto-catalog.spec.ts` (unique ids and symbols, size between 50 and 100, `findCoin('bitcoin')` exact, unknown id → undefined)
- [x] T005 [P] Create `libs/domain/holdings/src/lib/units.ts` (`HoldingUnit = 'G'|'OZT'`, `GRAMS_PER_TROY_OUNCE = '31.1035'`, `toGrams(quantity: string, unit)` via `Decimal`, returns string) with `libs/domain/holdings/src/lib/units.spec.ts` (exact: `toGrams('2','OZT') === '62.207'`, `toGrams('1.5','G') === '1.5'`, 8-decimal OZT input has no float artefacts)
- [x] T006 Reshape `libs/domain/holdings/src/lib/asset-type.ts` (remove `weightGrams`; add `metal`, `unit`, `coinId`, `note`; `ASSET_TYPE_FIELDS` per [data-model.md](./data-model.md) with required/optional per field, keep `fieldsForAssetType`) and `libs/domain/holdings/src/lib/holding.ts` (`Holding` per data-model payload; `computeValue()` without `weightGrams`); update `libs/domain/holdings/src/lib/holding.spec.ts` with exact values
- [x] T007 Rework `libs/domain/holdings/src/lib/holding-validation.ts` to return `FieldError { field, code }` with the codes in [contracts/holdings-api.md](./contracts/holdings-api.md) (`REQUIRED`, `ISIN_INVALID`, `ISIN_NOT_ALLOWED`, `METAL_UNKNOWN`, `COIN_UNKNOWN`, `UNIT_INVALID`, `QUANTITY_NOT_POSITIVE`, `QUANTITY_DECIMALS`, `NOTE_TOO_LONG`, `DECIMAL_INVALID`): ISIN only ETF/SHARE (regex + Luhn), metal/coin catalogue membership, unit, quantity > 0 for all types, crypto ≤ 8 decimals, note ≤ 500 **characters** (count code points, not UTF-16 units), fields not listed for the type rejected, `currentValue` may be 0; update `libs/domain/holdings/src/lib/holding-validation.spec.ts` with exact-value cases (0.00000001 ok, 0.000000001 → `QUANTITY_DECIMALS`, 500-char note ok / 501 → `NOTE_TOO_LONG`, 500 emoji ok / 501 emoji rejected, `isin` on metal → `ISIN_NOT_ALLOWED`, free-text metal → `METAL_UNKNOWN`, huge quantity/price stay exact)
- [x] T008 Rework `libs/domain/holdings/src/lib/holding-merge.ts`: `findMergeKey(holding)` per data-model (ETF isin+management; metal metal+management; deposit normalised name+management; SHARE and CRYPTO → no key) and keep `decideMerge` semantics (merge replaces fields in place, keeps `id` and `createdAt`); update `libs/domain/holdings/src/lib/holding-merge.spec.ts` incl. share/crypto never merge, same coin at same broker twice stays two entries
- [x] T009 Export all new symbols (catalogues, units, `findMergeKey`, field definitions, error-code type) from `libs/domain/holdings/src/index.ts` and update `libs/domain/holdings/README.md`
- [x] T010 [P] Update `libs/api-contract/src/lib/holdings.ts` to the contract: remove `weightGrams`; add `metal`, `unit`, `coinId`, `note`; request types per asset type; `HoldingResponse` with inapplicable fields `null`; `HoldingValidationErrorResponse` becomes `{ message: string; errors: { field: string; code: string }[] }` (replaces `{ error: 'VALIDATION_FAILED', message, fieldErrors }`); fix any `libs/api-contract` spec/consumers
- [x] T011 [P] Move the holdings i18n out of the shared files: create `libs/frontend/shared-ui/src/lib/i18n/translations/holdings.de.ts` and `holdings.en.ts` (export `holdingsDe` / `holdingsEn`) containing the current holdings keys from `de.ts` / `en.ts` (nav `holdings`, `holdingsDistribution`, `holdings`, `holdingsArea`, `pageTitle.holdings*`, `holdingsExport`; leave import-related keys for T061), register them in `de.ts` / `en.ts` exactly as `insurancesDe` / `insurancesEn` are registered, and create `libs/frontend/shared-ui/src/lib/i18n/translations/holdings-translations.spec.ts` as a de/en key-parity spec modelled on the other `<domain>-translations.spec.ts` files

**Checkpoint**: `npx nx test @vaultfolio/domain-holdings`, `npx nx test @vaultfolio/api-contract` and `npx nx test @vaultfolio/frontend-shared-ui` are green (backend/frontend app code is allowed to fail to compile until US1/US2).

---

## Phase 3: User Story 1 — Holdings protected like all other personal data (P1) 🎯 MVP

**Goal**: Every holding is stored as ciphertext (`payload_enc`), fails closed with 503, rotates with the registry, shows in admin encryption status, merges in memory, and is removed on account deletion.

**Independent Test**: Create a holding via the API, read the SQLite row and confirm no detail is readable; GET returns it correctly; without the data key GET returns 503; rotation keeps it readable; account deletion removes it.

### Tests for User Story 1

- [x] T012 [P] [US1] Create `apps/backend/src/holdings/holdings-crypto.service.spec.ts` (round trip; AAD `holdings|<id>|<owner_id>` — decrypt fails with another id or another owner; key_version recorded; unavailable keyring → throws the 503 exception); model the service on `apps/backend/src/insurances/insurances-crypto.service.ts` and look at an existing per-domain crypto spec elsewhere in `apps/backend/src` (grep `crypto.service.spec`) for the test setup
- [x] T013 [P] [US1] Create `apps/backend/src/holdings/holdings.service.spec.ts` (create → encrypted row written; merge for ETF/metal/deposit found by decrypting the owner's rows and updating in place with `id`/`createdAt` kept; share/crypto never merge; update with a different `assetType` is rejected and the stored type unchanged; list with one undecryptable row returns the others and logs the problem without holding contents)

### Implementation for User Story 1

- [x] T014 [US1] Add `'holdings'` to `ENCRYPTION_DOMAIN_IDS` in `libs/api-contract/src/lib/encryption.ts`
- [x] T015 [US1] Create `apps/backend/src/holdings/holdings-crypto.service.ts`, `apps/backend/src/holdings/holdings-available.guard.ts` and `apps/backend/src/holdings/holdings.exceptions.ts` (503 body `HOLDINGS_UNAVAILABLE`, same shape as insurances), mirroring `apps/backend/src/insurances/insurances-crypto.service.ts`, `insurances-available.guard.ts`, `insurances.exceptions.ts` on top of `DomainKeyringService`; make T012 pass
- [x] T016 [US1] Register the domain: add `payloadTable('holdings')` to `DOMAIN_ENCRYPTION` in `apps/backend/src/encryption/domain-encryption.registry.ts`; in `apps/backend/src/encryption/domain-encryption.registry.spec.ts` add `['holdings', ['holdings:payload_enc']]` to the expected-columns table (line ~13) so the equality with `ENCRYPTION_DOMAIN_IDS` (line ~6) holds; check `apps/backend/src/encryption/encryption.testing.ts`, `rotation.service.spec.ts` and `encryption-admin.controller.spec.ts` for per-domain lists/fixtures and add holdings wherever the other domains are enumerated
- [x] T017 [P] [US1] Add the holdings label to the admin encryption UI: `holdings` entry in `libs/frontend/shared-ui/src/lib/i18n/translations/encryption.de.ts` and `encryption.en.ts` (as the `insurances` entry), add `'holdings'` to the domain list at line ~41 of `libs/frontend/shared-ui/src/lib/i18n/translations/encryption-translations.spec.ts` and line ~44 of `libs/frontend/admin/src/lib/encryption/encryption.component.spec.ts`
- [x] T018 [US1] Rework the schema in `apps/backend/src/database/database.service.ts`: in `initializeSchema()` drop `holdings` when `PRAGMA table_info` lacks `payload_enc`, then `CREATE TABLE IF NOT EXISTS holdings (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, payload_enc TEXT NOT NULL, key_version INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)` + owner index (replace DDL at lines ~81–129); delete `migrateHoldingsAssetTypes()` (call at ~51, method ~640–713); add cases to `apps/backend/src/database/database.service.spec.ts` for drop-then-recreate and idempotent re-run. `apps/backend/src/auth/users.repository.ts:342` (`DELETE FROM holdings WHERE owner_id`) stays valid — leave it
- [x] T019 [US1] Rework `apps/backend/src/holdings/holdings.mapper.ts` (`HoldingRow` = id, owner_id, payload_enc, key_version, created_at, updated_at; row ↔ `Holding`/`HoldingResponse` via the crypto service) and `apps/backend/src/holdings/holdings.repository.ts` (insert/update/delete/find-by-owner on ciphertext columns only); update `apps/backend/src/holdings/holdings.repository.spec.ts`
- [x] T020 [US1] Rework `apps/backend/src/holdings/holdings.service.ts`: validate via `validateHoldingSubmission`, encrypt on write, decrypt owner rows on read, merge via `findMergeKey` in memory (research §3), `update` keeps the stored `assetType` and rejects a body whose `assetType` differs, undecryptable single record → skip it in the list, log an error with the record id only, keep the other holdings; keep the structured logging; make T013 pass
- [x] T021 [US1] Update `apps/backend/src/holdings/holdings.controller.ts` and `holdings.module.ts`: provide `HoldingsCryptoService` and `HoldingsAvailableGuard` (import whatever module `InsurancesModule` imports for the keyring), apply the guard (503 `HOLDINGS_UNAVAILABLE`), replace the local `validationErrorBody` so a 400 returns `{ message, errors: [{ field, code }] }`, keep 201 created / 200 merged and `HOLDING_NOT_FOUND`; update `apps/backend/src/holdings/holdings.controller.spec.ts`
- [x] T022 [P] [US1] Update `apps/backend/src/openapi/dto/holdings.ts` and `api/openapi.yml` to the new request/response/400/503 shapes (remove `weightGrams`, add `metal`, `unit`, `coinId`, `note`, `errors[].code`); ensure `apps/backend/src/openapi/openapi-completeness.e2e-spec.ts` passes
- [x] T023 [US1] Rewrite `apps/backend/src/tests/holdings.e2e-spec.ts` for the new shape using helpers modelled on `apps/backend/src/tests/encryption-e2e.helpers.ts` / `insurances-e2e.helpers.ts`: create each asset type, list, update, delete, merge (ETF/metal/deposit → 200 with same id; share/crypto → separate 201s), every 400 error code from the contract with exact `{field, code}`, `isin` on metal rejected, `assetType` change on PUT rejected, owner isolation, 503 when the holdings key is unavailable
- [x] T024 [US1] Rewrite `apps/backend/src/tests/holdings-persistence.e2e-spec.ts`: the stored row contains no readable isin/name/management/note/amount (SC-001, assert on raw `payload_enc`), only the listed columns exist, key rotation keeps all holdings readable and the admin encryption status lists holdings, account deletion removes all of the user's holdings, one corrupted `payload_enc` leaves the other holdings listed
- [x] T025 [P] [US1] Check every other backend file that enumerates encrypted/entitled domains for a missing holdings entry and add it only where insurances is listed and holdings is not: `apps/backend/src/accounts/accounts.service.ts` (`KNOWN_DOMAIN_IDS`), `apps/backend/src/accounts/accounts.controller.spec.ts`, `apps/backend/src/maintenance/maintenance.controller.spec.ts`, `apps/backend/src/tests/maintenance.e2e-spec.ts`, `apps/backend/src/auth/domain.guard.spec.ts`, `libs/api-contract/src/lib/maintenance.ts`
- [x] T026 [P] [US1] Same check for the frontend: `libs/frontend/domain-access` (`domain-registry.ts`, `is-domain-entitled.spec.ts`), `libs/frontend/admin` accounts/domains specs, `apps/frontend/src/app/core/layout/application-areas.ts`, `apps/frontend/src/app/core/hints/hint-providers.registry.ts`, `libs/frontend/shared-ui` `domain-maintenance-gate.component.spec.ts`, `apps/frontend/src/app/dashboard/dashboard-widgets.registry.spec.ts`, `libs/frontend/hints` `hidden-state.spec.ts`
- [x] T027 [US1] Create the frontend unavailable handling mirroring `libs/frontend/domain/insurances/src/lib/insurances-area/insurances-available.guard.ts` and `insurances-unavailable.component.ts`: `libs/frontend/domain/holdings/src/lib/holdings-area/holdings-available.guard.ts` and `holdings-unavailable.component.ts` plus specs (`holdings-available.guard.spec.ts`, `holdings-unavailable.component.spec.ts`); add i18n keys to `holdings.de.ts` / `holdings.en.ts`; wire the guard on the holdings route in `apps/frontend/src/app/app.routes.ts` (dynamic `import()` + `runInInjectionContext`, as insurances at line ~40) and extend `apps/frontend/src/app/app.routes.spec.ts`

**Checkpoint**: `npx nx test backend`, `npx nx e2e backend` (holdings, persistence, openapi, maintenance specs) green; US1 acceptance 1–5 demonstrable via the API.

---

## Phase 4: User Story 2 — Pick precious metal and crypto asset from a fixed list (P1) 🎯 MVP

**Goal**: Form shows only the fields relevant to the type; metal and coin are chosen from catalogues (coins searchable); ISIN only for ETF/share; field definitions come from one shared source; messages are field-specific and bilingual.

**Independent Test**: Add one holding per asset type; metals/coins selectable only from lists, coin list filters by typing name or symbol, ISIN requested only for ETF/share.

### Tests for User Story 2

- [x] T028 [P] [US2] Update `libs/frontend/domain/holdings/src/lib/holding-form/holding-form.component.spec.ts`: per asset type exactly the fields of `fieldsForAssetType` are rendered (`data-testid` queries), no ISIN for metal/crypto/deposit, metal selector offers exactly 4 options, coin selector filters by name and by symbol, API `errors[].code` map to the de and en messages on the right field, asset type control is disabled in edit mode and the submit payload carries the original type
- [x] T029 [P] [US2] Create `libs/frontend/domain/holdings/src/lib/holdings.service.spec.ts` (new file; `HttpTestingController`: list/create/update/delete use the new shapes, a 400 with `errors` is surfaced to the caller)
- [x] T030 [P] [US2] Update `libs/frontend/domain/holdings/src/lib/holdings.component.spec.ts`: metal row shows the translated metal name, coin row shows coin name + symbol, a stored `coinId`/`metal` no longer in the catalogue renders its raw id/code as readable fallback without throwing

### Implementation for User Story 2

- [x] T031 [US2] Delete `libs/frontend/domain/holdings/src/lib/asset-type-fields.ts` and import `ASSET_TYPES`, `fieldsForAssetType`, the catalogues and `HoldingUnit` from `@vaultfolio/domain-holdings` in every consumer under `libs/frontend/domain/holdings/src` (grep for `asset-type-fields`); keep only UI-only widget hints, if any are still needed, next to the form (FR-018)
- [x] T032 [US2] Update `libs/frontend/domain/holdings/src/lib/holdings.service.ts` to the new contract types (no `weightGrams`; `metal`, `unit`, `coinId`, `note`; error body `{message, errors}`)
- [x] T033 [US2] Rework `libs/frontend/domain/holdings/src/lib/holding-form/holding-form.component.ts` (+ its template/styles): type selector (locked when editing), ISIN only ETF/SHARE, PrimeNG select for metal (names via i18n), PrimeNG select with filtering over coin name + symbol, name field only ETF/SHARE/DEPOSIT, per-field error messages from `errors[].code`, client validation by `validateHoldingSubmission`; add `data-testid` for every new/changed control per `docs/frontend/testid-conventions.md` (type, isin, name, metal, coin, quantity, unit, purchase-price, purchase-date, current-value, management, note, submit, cancel); make T028 pass
- [x] T034 [US2] Update `libs/frontend/domain/holdings/src/lib/holdings.component.ts` table/list: metal and coin display via catalogue lookup with readable fallback for removed entries, no `weightGrams` column; make T030 pass
- [x] T035 [P] [US2] Add the German and English texts to `libs/frontend/shared-ui/src/lib/i18n/translations/holdings.de.ts` and `holdings.en.ts`: metal names (Gold, Silber, Platin, Palladium / Gold, Silver, Platinum, Palladium), form labels/placeholders, one message per error code of T007; `holdings-translations.spec.ts` parity stays green
- [x] T036 [P] [US2] Adapt `libs/frontend/domain/holdings/src/lib/holdings-type-breakdown/holdings-type-breakdown.component.ts` (+ its spec): group by metal/coin/ISIN label instead of the removed free-text name
- [x] T037 [P] [US2] Adapt `libs/frontend/domain/holdings/src/lib/holdings-distribution/holdings-distribution.component.ts`, `distribution-chart-option.ts` and `libs/frontend/domain/holdings/src/lib/holdings-valuation.ts` (+ their `.spec.ts` files) to the new `Holding` shape (metal/coin labels, `computeValue` without `weightGrams`)

**Checkpoint**: `npx nx test @vaultfolio/frontend-domain-holdings` and `npx nx lint @vaultfolio/frontend-domain-holdings` green; frontend app compiles (`npx nx typecheck @vaultfolio/frontend`); MVP (US1 + US2) complete.

---

## Phase 5: User Story 3 — Enter quantities the way they are held (P2)

**Goal**: Metal quantity with a preserved unit (g / troy oz); crypto quantity with up to 8 decimals shown without rounding; totals use a common unit.

**Independent Test**: A metal in ounces and one in grams display consistently and contribute the correct amount; a crypto holding of 0.00000001 is stored and shown exactly.

- [x] T038 [P] [US3] Extend `libs/frontend/domain/holdings/src/lib/holding-form/holding-form.component.spec.ts` and `libs/frontend/domain/holdings/src/lib/holdings.component.spec.ts`: unit selector only for metals (G/OZT), entering `2.5` OZT shows `2.5` OZT after save and reload (SC-004), crypto `0.00000001` accepted and shown as `0.00000001`, `0.000000001` shows the `QUANTITY_DECIMALS` message in de and en
- [x] T039 [US3] Implement in `libs/frontend/domain/holdings/src/lib/holding-form/holding-form.component.ts` the metal unit select (default G, `data-testid` `holding-form-unit`) with a hint of the conversion (1 oz = 31.1035 g), and an 8-decimal quantity input (no JS number rounding — keep strings); in `libs/frontend/domain/holdings/src/lib/holdings.component.ts` display quantity + unit exactly as entered, no rounding pipe
- [x] T040 [P] [US3] Use `toGrams` from `@vaultfolio/domain-holdings` wherever metal weights are summed in `libs/frontend/domain/holdings/src/lib/holdings-valuation.ts`; extend `libs/frontend/domain/holdings/src/lib/holdings-valuation.spec.ts` with exact values (2 OZT + 10 G = `72.207` g; large quantities/prices summed without precision loss)
- [x] T041 [P] [US3] Add precision cases to `apps/backend/src/tests/holdings.e2e-spec.ts`: POST crypto `"0.00000001"` and metal `"2.5"` `OZT` → GET returns identical strings; 9 decimals → 400 `QUANTITY_DECIMALS`; unit missing on a metal → 400; very large quantity/price round-trip exactly
- [x] T042 [P] [US3] Add unit/precision i18n texts (unit names, hint, `QUANTITY_DECIMALS` wording) to `libs/frontend/shared-ui/src/lib/i18n/translations/holdings.de.ts` and `holdings.en.ts`

**Checkpoint**: US3 independent test passes (unit + e2e specs).

---

## Phase 6: User Story 4 — Personal notes on any holding (P2)

**Goal**: Optional note ≤ 500 characters on every type, counted identically in form and server, with remaining length shown while editing.

**Independent Test**: Save holdings of each type with no note, a 500-character note and an over-limit note.

- [x] T043 [P] [US4] Extend `libs/frontend/domain/holdings/src/lib/holding-form/holding-form.component.spec.ts`: note field on all 5 types, remaining counter (`500` → `499` after one char), counter counts an emoji as one character, 501 characters blocks submit and shows `NOTE_TOO_LONG` text in de and en
- [x] T044 [US4] Add the note textarea with live remaining-length counter (count by characters via `Array.from(value).length`, matching T007) to `libs/frontend/domain/holdings/src/lib/holding-form/holding-form.component.ts`, with `data-testid` `holding-form-note` and `holding-form-note-counter`; show the note in the list in `libs/frontend/domain/holdings/src/lib/holdings.component.ts` (+ spec assertion in `holdings.component.spec.ts`)
- [x] T045 [P] [US4] Add note cases to `apps/backend/src/tests/holdings.e2e-spec.ts`: each asset type with and without note round-trips; 500-character and 500-emoji notes accepted; 501 → 400 `NOTE_TOO_LONG`; note updated and cleared via PUT
- [x] T046 [P] [US4] Add note label/counter i18n texts to `libs/frontend/shared-ui/src/lib/i18n/translations/holdings.de.ts` and `holdings.en.ts`

**Checkpoint**: US4 independent test passes.

---

## Phase 7: User Story 5 — Clear dashboard tiles (P2)

**Goal**: Distribution and total-value tiles use the shared empty-state design with a call to action; total tile shows the "Kaufwert" (purchase value) sum with an exclusion hint; load errors show a distinct error state.

**Independent Test**: Dashboard with an account without holdings (both tiles empty with working CTA) and with the seeded account (purchase-value total and distribution chart).

### Tests for User Story 5

- [x] T047 [P] [US5] Create `libs/frontend/domain/holdings/src/lib/holdings-total-value/holdings-total-value.component.spec.ts` (new file): empty → `app-empty-tile` with CTA to the add-holding action; ETF/SHARE/CRYPTO purchase values summed exactly via `Decimal` (e.g. `10 × 12.34 + 0.5 × 100.01`); metal/deposit and holdings lacking a purchase price excluded and the hint shows the exact excluded count; failed load → error state distinct from empty
- [x] T048 [P] [US5] Update `libs/frontend/domain/holdings/src/lib/holdings-distribution/holdings-distribution.component.spec.ts` (if absent, create it): empty → `app-empty-tile` with CTA, load error → error state distinct from empty, populated → chart

### Implementation for User Story 5

- [x] T049 [US5] Replace the "coming soon" stub in `libs/frontend/domain/holdings/src/lib/holdings-total-value/holdings-total-value.component.ts` with the "Kaufwert" total (label clearly says purchase value, not current value), `app-empty-tile` from shared-ui for the empty state, exclusion hint with count, error state following `libs/frontend/domain/insurances/src/lib/insurances-dashboard-widget/insurances-dashboard-widget.component.ts` (and its `data-testid` naming); make T047 pass
- [x] T050 [US5] Update `libs/frontend/domain/holdings/src/lib/holdings-distribution/holdings-distribution.component.ts` to `app-empty-tile` + error state; make T048 pass
- [x] T051 [US5] Check `apps/frontend/src/app/dashboard/dashboard-widgets.registry.ts` (holdings widgets) against both tiles (domain entitlement, shared loading so a failed GET shows the error in both) and update `apps/frontend/src/app/dashboard/dashboard-widgets.registry.spec.ts` if the widget wiring changes
- [x] T052 [P] [US5] Add tile i18n texts (Kaufwert label, hint with count, empty-state title/body/CTA, error text) to `libs/frontend/shared-ui/src/lib/i18n/translations/holdings.de.ts` and `holdings.en.ts`
- [x] T053 [P] [US5] Add `data-testid` for the tile CTA, hint and error elements and document the new ids in `docs/frontend/testid-conventions.md`

**Checkpoint**: tile specs green; US5 verified in the browser in T067.

---

## Phase 8: User Story 6 — Realistic and comprehensive test data (P3)

**Goal**: One holdings seed created through the REST API (so encryption applies), replacing the account's holdings, wired into the existing seeding tools for both test accounts, idempotent.

**Independent Test**: Run the seed tools for both accounts (twice) and open holdings and the dashboard for each.

- [x] T054 [US6] Create `tools/holdings/seed-holdings-testset.mjs` using `tools/seed-lib.mjs` (model it on `tools/insurances/seed-insurances-testset.mjs`: REST sign-in, delete the account's existing holdings via `DELETE /holdings/:id`, then `POST /holdings`) with two datasets selected by argument: `comprehensive` and `realistic` — read FR-024 in spec.md in full first and implement exactly what it lists (all five types, merge cases, multiple brokers/banks, extreme values, `0.00000001` quantities, both metal units, 500-character notes); exit non-zero on any non-2xx
- [x] T055 [US6] Wire the seed in: `tools/seed-comprehensive.mjs` (account `claude@allwang.family`, dataset `comprehensive`), `tools/seed-realistic.mjs` (the realistic account already used there, dataset `realistic`), `tools/seed-all.mjs` (add `['holdings', 'holdings/seed-holdings-testset.mjs']` to `FEATURES`, next to the `insurances` entry at line 12) and describe it in `tools/README.md`
- [x] T056 [US6] Run the seeding for both accounts twice against the dev stack (see `verify-ui` skill; never touch the seeded Earnings data) and confirm via `GET /holdings` that counts are identical after the second run and there are no duplicates (SC-006)

**Checkpoint**: both accounts show populated holdings and tiles.

---

## Phase 9: User Story 7 — Holdings import is removed (P3)

**Goal**: No import entry point in the UI, routes or API; export still works with the new shape.

**Independent Test**: No import tab/route/endpoint exists; export produces the reworked data.

- [x] T057 [P] [US7] Update `libs/frontend/domain/holdings/src/lib/holdings-area/holdings-area.component.spec.ts`: only the list tab exists, no `holdings-area-tab-imports`; update `apps/frontend/src/app/app.routes.spec.ts`: no holdings `imports` child route
- [x] T058 [P] [US7] Update `libs/frontend/domain/holdings/src/lib/holdings-export.definition.ts` and `holdings-export.definition.spec.ts` to the new shape (columns: asset type, ISIN, name, metal, coin id/symbol, quantity, unit, purchase price, purchase date, current value, management, note; no `weightGrams`; exact-value assertions)
- [x] T059 [US7] Delete `libs/frontend/domain/holdings/src/lib/imports/` and remove the `ImportsComponent` export from `libs/frontend/domain/holdings/src/index.ts`
- [x] T060 [US7] Remove the imports tab from `libs/frontend/domain/holdings/src/lib/holdings-area/holdings-area.component.ts`; remove the `imports` child route (`pageTitle.holdingsImports`, `ImportsComponent`) from `apps/frontend/src/app/app.routes.ts`
- [x] T061 [US7] Remove the holdings-import i18n keys from `libs/frontend/shared-ui/src/lib/i18n/translations/holdings.de.ts`, `holdings.en.ts` (and the originals in `de.ts`/`en.ts` if any remain): `pageTitle.holdingsImports`, `holdingsArea.imports`, the top-level holdings `imports` block and nav `imports` — first grep each key's usages and confirm it belongs to holdings and not to another feature; update `holdings-translations.spec.ts` if it enumerates them
- [x] T062 [US7] Sweep for leftovers: `grep -rniE "holdings?.*import|import.*holdings?" apps libs docs api tools README.md` (ignore ES-module `import` lines) and confirm there is no import endpoint in `apps/backend/src/holdings/`, `api/openapi.yml` or `api/bruno/holdings/`; remove whatever the sweep finds

**Checkpoint**: `npx nx test @vaultfolio/frontend-domain-holdings` and `npx nx test @vaultfolio/frontend` green; SC-007 holds.

---

## Phase 10: Polish & Cross-Cutting

- [ ] T063 [P] Update Bruno requests in `api/bruno/holdings/`: refresh the existing `Create ETF Holding.bru` and `List Holdings.bru` to the new shape; create `Create Share Holding.bru`, `Create Precious Metal Holding.bru`, `Create Crypto Holding.bru`, `Create Deposit Money Holding.bru`, `Update Holding.bru` and `Delete Holding.bru` (only the two existing files are present today), following the format of the existing files (FR-025)
- [ ] T064 [P] Update user documentation in `docs/user-guide.md` and `docs/user-guide.de.md` (encrypted storage, metal/coin lists, units, note, tiles, no import) and the Holdings mentions in `README.md`
- [ ] T065 Amend `.specify/memory/constitution.md` to 3.13.0 (MINOR): add Holdings to the Sensitive Personal Data domain list (~line 322) and adjust the "less sensitive" wording (~line 105); remove "bulk import via CSV or JSON" from the Holdings In Scope bullets and the "no bank, broker or Holdings import" wording of the wealth bullet; fix the Out of Scope origin sentence; update the Sync Impact Report at the top and the Version line (477: `**Version**: 3.13.0 | **Ratified**: 2026-08-13 | **Last Amended**: 2026-10-08`)
- [ ] T066 Run `npx nx run-many -t lint,test,typecheck -p @vaultfolio/domain-holdings @vaultfolio/api-contract backend @vaultfolio/frontend-domain-holdings @vaultfolio/frontend-shared-ui @vaultfolio/frontend` and `npx nx e2e backend`; fix all failures (no skipped or weakened tests)
- [ ] T067 Invoke the `verify-ui` skill and drive the running app with a throw-away Playwright script (do not commit it) as `claude@allwang.family`: each asset type form shows only its fields; metal select and unit; coin search by name and symbol; note counter; list shows metal/coin names; no import tab/route; empty tiles on an account without holdings with working CTA; "Kaufwert" tile and exclusion hint, distribution chart on the seeded account; unavailable page when the holdings key is missing; export downloads the new shape
- [ ] T068 Walk through [quickstart.md](./quickstart.md) steps 1–7 (read-only SQLite inspection for SC-001, 503 fail-closed, precision, seeds twice, admin encryption status lists Holdings and rotation re-encrypts it) and record any deviation
- [ ] T069 Run the SonarQube checks with the `mcp__sonarqube__*` tools only (quality gate and new issues/hotspots for this branch) and fix findings in the changed code

---

## Dependencies & Execution Order

- **Setup (T001–T002)** → **Foundational (T003–T011)** → stories. T002 must precede any frontend import of `@vaultfolio/domain-holdings` (T031).
- **Foundational internals**: T003–T005 parallel; T006 needs T003–T005; T007 needs T003–T006; T008 needs T006; T009 after T003–T008; T010 and T011 parallel to the domain work.
- **US1 (P1)**: T012/T013 tests first; T014 → T015/T016/T017; T018 → T019 → T020 → T021; T022 after T021; T023/T024 after T021; T025/T026 independent; T027 after T011.
- **US2 (P1)**: needs Foundational, T002 and T027 for the route wiring; T032 needs the T010 contract. T031 → T033 → T034; T035/T036/T037 parallel.
- **US3, US4 (P2)**: need US2's form (T033) and US1's backend; independent of each other apart from sharing `holding-form.component.ts` and `holdings.e2e-spec.ts` — do them sequentially.
- **US5 (P2)**: needs US2's shape adaptation (T037); independent of US3/US4.
- **US6 (P3)**: needs US1 backend and the final shape; needs a running dev stack.
- **US7 (P3)**: needs US2 (T033) only for the area component; T061 needs T011.
- **Polish (T063–T069)**: after all stories; T066 → T067 → T068 → T069. T063/T064/T065 can start once the API shape is final (after US1).

## Parallel Examples

- **Foundational**: T003 + T004 + T005 together, then T010 + T011 in parallel with T006–T008.
- **US1**: T012 + T013 (specs), later T017 + T022 + T025 + T026 (different files).
- **US2**: T035 + T036 + T037 after T033.
- **After US2**: US3, US5 and US7 on separate branches; T063 + T064 + T065 in Polish.

## Implementation Strategy

1. **MVP = US1 + US2** (both P1, inseparable because the contract changes the form and the server together): finish Setup, Foundational, US1, US2, then stop and validate with the US1/US2 independent tests and T066-style checks.
2. Add increments in priority order — US3 and US4 (P2, form/e2e), US5 (P2, tiles), then US6 and US7 (P3) — each validated by its own independent test before the next.
3. Finish with Polish (docs, Bruno, constitution 3.13.0, lint/test/typecheck/e2e, `verify-ui`, quickstart, Sonar).

## Notes

- Total: 69 tasks. Setup 2, Foundational 9, US1 16, US2 10, US3 5, US4 4, US5 7, US6 3, US7 6, Polish 7.
- Do not read `.env` or `apps/frontend/src/environments/environment.local.ts`; do not delete the test account's Earnings dataset.
- Commit after each phase or logical group with Conventional Commits (`feat(holdings): …`).
