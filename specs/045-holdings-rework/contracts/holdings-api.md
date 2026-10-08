# Contract: Holdings API (`/holdings`)

Decimals are strings. All endpoints require auth, owner-scoped. Every endpoint returns **503** `HOLDINGS_UNAVAILABLE` when the holdings data key is unavailable (same body shape as insurances).

| Method | Path          | Notes                                                        |
| ------ | ------------- | ------------------------------------------------------------ |
| GET    | /holdings     | list of `HoldingResponse`                                    |
| POST   | /holdings     | create or merge (ETF/metal/deposit); 201 created, 200 merged |
| PUT    | /holdings/:id | update; `assetType` immutable                                |
| DELETE | /holdings/:id | 204                                                          |

**Removed**: any import endpoint/UI (none existed server-side).

## Request bodies (`assetType` discriminates)

Common: `management: string`, `note?: string` (≤500).

- ETF: `isin, name, quantity, purchasePrice`
- SHARE: `isin, name, quantity, purchasePrice, purchaseDate?`
- PRECIOUS_METAL: `metal: 'XAU'|'XAG'|'XPT'|'XPD', quantity, unit: 'G'|'OZT', currentValue?`
- CRYPTO: `coinId, quantity (≤8 decimals), purchasePrice, purchaseDate?`
- DEPOSIT_MONEY: `name, currentValue`

Fields not listed for a type are rejected (400), e.g. `isin` on metal/crypto/deposit, `name` on metal/crypto, free-text asset names.

## Response

`HoldingResponse`: `id, assetType, management, note, isin, name, metal, coinId, quantity, unit, purchasePrice, purchaseDate, currentValue, createdAt, updatedAt` (inapplicable fields `null`). `weightGrams` removed.

## Errors (400)

`{ message, errors: [{ field, code }] }` with codes: `REQUIRED`, `ISIN_INVALID`, `ISIN_NOT_ALLOWED`, `METAL_UNKNOWN`, `COIN_UNKNOWN`, `UNIT_INVALID`, `QUANTITY_NOT_POSITIVE`, `QUANTITY_DECIMALS`, `NOTE_TOO_LONG`, `DECIMAL_INVALID`.
