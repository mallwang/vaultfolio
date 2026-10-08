# domain-holdings

Framework-independent domain logic for the Holdings feature (`specs/003-holdings-tracking`) —
mirrors Principle I (Library-First). No NestJS/Angular/SQLite dependency.

## Exports

- **`AssetType`** / `ASSET_TYPES` / `ASSET_TYPE_FIELDS` — the fixed set of asset types (`ETF`,
  `SHARE`, `PRECIOUS_METAL`, `CRYPTO`, `DEPOSIT_MONEY`) and per-type required/optional field
  metadata. `isAssetType(value)` is the runtime guard. `fieldsForAssetType(assetType)` returns
  the combined required+optional list.
- **`Holding`** / `HoldingProps` — the core domain entity. Quantity/money fields are `Decimal`;
  fields not applicable to the type are `null`. `computeValue()` returns `quantity × purchasePrice`
  (ETF/Share/Crypto) or `currentValue` (Metal/Deposit); `null` when not computable.
- **`validateHoldingSubmission(submission)`** — one validator for server and form. Returns
  `{ valid: true, value }` or `{ valid: false, fieldErrors: { field, code }[] }` (all failing
  fields at once). `HoldingErrorCode`: `REQUIRED`, `ISIN_INVALID`, `ISIN_NOT_ALLOWED`,
  `METAL_UNKNOWN`, `COIN_UNKNOWN`, `UNIT_INVALID`, `QUANTITY_NOT_POSITIVE`, `QUANTITY_DECIMALS`,
  `NOTE_TOO_LONG`, `DECIMAL_INVALID`, `FIELD_NOT_ALLOWED`.
- **`findMergeKey(holding)`** / **`decideMerge(submission, existing)`** — ETF `(isin, management)`,
  metal `(metal, management)`, deposit `(normalised name, management)`; Share/Crypto never merge.
- **`METAL_CATALOG`** / `findMetal` (XAU, XAG, XPT, XPD) and **`CRYPTO_CATALOG`** / `findCoin`
  (CoinGecko ids).
- **`HOLDING_UNITS`**, `GRAMS_PER_TROY_OUNCE` (`31.1035`), `toGrams(quantity, unit)`.

## Running unit tests

Run `npm exec nx test domain-holdings` to execute the unit tests via Jest.
