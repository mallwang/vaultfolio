# Research: Holdings Rework

## 1. Encryption shape

- **Decision**: Mirror insurances: one `payload_enc` JSON blob + `key_version`, AAD `holdings|<id>|<owner_id>`; new `HoldingsCryptoService`, `HoldingsAvailableGuard`, 503 exception; register `payloadTable('holdings')` in `DOMAIN_ENCRYPTION`; add `'holdings'` to `ENCRYPTION_DOMAIN_IDS`. Rotation and admin status follow from the registry.
- **Rationale**: Proven pattern, zero new mechanism. `KNOWN_DOMAIN_IDS` in accounts already contains holdings.
- **Alternatives**: Encrypt only some columns — rejected (FR-001 covers all details).

## 2. No migration

- **Decision**: In `initializeSchema()` drop `holdings` if it lacks `payload_enc`, before `CREATE TABLE IF NOT EXISTS`; delete `migrateHoldingsAssetTypes()`.
- **Rationale**: FR-004; the project is pre-release for this domain; idempotent.
- **Alternatives**: Re-encrypting legacy rows via `legacy-migration.service` — rejected, explicitly out of scope.

## 3. Merge under encryption

- **Decision**: Service loads and decrypts the owner's rows, finds the merge match in memory with the domain-lib `findMergeKey` (ETF: isin+management; metal: metal+management; deposit: normalised name+management; share/crypto never merge), then updates in place.
- **Rationale**: Plain lookup columns would leak isin/name/management and defeat FR-001. Row counts are tiny.
- **Alternatives**: Deterministic hash column — rejected (extra key, dictionary-attackable for ISINs).

## 4. Metal model

- **Decision**: `metal` code `XAU|XAG|XPT|XPD` (language-independent), `quantity` string + `unit` `G|OZT`. Constant `GRAMS_PER_TROY_OUNCE = '31.1035'`; `toGrams(quantity, unit)` with Decimal. Entered unit preserved; `weightGrams` removed.
- **Rationale**: FR-006/FR-011; SC-004 round-trips the entered value.

## 5. Crypto catalogue

- **Decision**: ~60 entries `{ id, symbol, name }` in `crypto-catalog.ts`; `id` = CoinGecko API id (e.g. `bitcoin`, `ethereum`), the stable key spec 046 will use for price lookup. Names are brand names, identical in de/en; a `names?: {de,en}` override is not added (YAGNI). Quantity: ≤8 decimals, >0.
- **Alternatives**: CoinMarketCap ids — numeric, less readable; CoinGecko ids are free and human-readable.

## 6. Field definitions single source (FR-018)

- **Decision**: `ASSET_TYPE_FIELDS` in the domain lib (field key, required, kind) is imported by the frontend; the frontend `asset-type-fields.ts` is deleted or reduced to UI-only widget hints.

## 7. Validation messages (FR-016)

- **Decision**: Domain validation returns `{ field, code }` (e.g. `ISIN_INVALID`, `NOTE_TOO_LONG`, `QUANTITY_DECIMALS`); the frontend maps codes to de/en keys in `holdings.de.ts` / `holdings.en.ts`; backend returns the codes in the 400 body.
- **Rationale**: One validator, two languages, no hard-coded English.

## 8. Dashboard tiles

- **Decision**: Reuse existing `app-empty-tile` (shared-ui) for distribution and total-value; replace the total-value stub with a "Kaufwert" sum via `computeHoldingValue` for non-metal types and a hint with the excluded count; add error state following the insurances widget; add holdings unavailable component + guard like insurances.

## 9. Import removal

- **Decision**: Delete `imports/` component, imports tab and route (`app.routes.ts` + spec), related i18n and docs. No backend code exists. Export definition updated to new shape (metal, unit, coin, note; no weightGrams).

## 10. Seeds

- **Decision**: New `tools/holdings/seed-holdings-testset.mjs` (REST, so encryption applies; deletes the account's holdings first via API, then posts) with a `comprehensive` and a `realistic` dataset; wired into seed-comprehensive (claude@) and seed-realistic (claudius@) and seed-all; idempotent by replace.

## 11. Constitution

- **Decision**: Amend to 3.13.0: Holdings joins Sensitive Personal Data; import removed from In Scope and the origin rule; Sync Impact Report updated.
