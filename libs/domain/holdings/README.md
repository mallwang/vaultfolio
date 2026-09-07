# domain-holdings

Framework-independent domain logic for the Holdings feature (`specs/003-holdings-tracking`) —
mirrors Principle I (Library-First). No NestJS/Angular/SQLite dependency.

## Exports

- **`AssetType`** / `ASSET_TYPES` / `ASSET_TYPE_FIELDS` — the fixed set of asset types (`ETF`,
  `SHARE`, `PRECIOUS_METAL`, `CRYPTO`, `DEPOSIT_MONEY`) and per-type required/optional field
  metadata. `isAssetType(value)` is the runtime guard. `fieldsForAssetType(assetType)` returns
  the combined required+optional list.
- **`Holding`** / `HoldingProps` — the core domain entity. All monetary/quantity fields are
  `Decimal`, never `number`. `computeValue()` returns the holding's contribution to the
  distribution view (`quantity × purchasePrice` for Share/Crypto/ETF, `currentValue` for
  Precious metal; `null` when not computable).
- **`validateHoldingSubmission(submission)`** — validates a raw create/update payload against
  all rules in `data-model.md`, collecting every failing field at once (not first-error-only).
  Returns `{ valid: true, value: ValidatedHolding }` or `{ valid: false, fieldErrors: FieldError[] }`.
  Single source of truth for holding validity — used by the REST layer and reusable for import.
- **`decideMerge(submission, existing)`** — given a validated submission and existing holdings,
  returns `{ kind: 'create' }` or `{ kind: 'update', existingId }`. SHARE/CRYPTO always create a
  new row; ETF matches on `(isin, management)`; PRECIOUS_METAL on `(name, management)`.

## Running unit tests

Run `npm exec nx test domain-holdings` to execute the unit tests via Jest.
