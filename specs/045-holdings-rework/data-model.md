# Data Model: Holdings Rework

## Table `holdings`

| Column                  | Type             | Notes                               |
| ----------------------- | ---------------- | ----------------------------------- |
| id                      | TEXT PK          | `randomUUID()`                      |
| owner_id                | TEXT NOT NULL    | FK-style owner, indexed             |
| payload_enc             | TEXT NOT NULL    | encrypted JSON of the payload below |
| key_version             | INTEGER NOT NULL | data-key version, rotation target   |
| created_at / updated_at | TEXT             | plain ISO timestamps                |

AAD: `holdings|<id>|<owner_id>`. Boot: drop table if `payload_enc` missing, then create.

## Payload (decrypted, domain `Holding`)

Common: `assetType`, `management` (required), `note?` (≤500 chars).

| assetType      | Fields                                                                             |
| -------------- | ---------------------------------------------------------------------------------- |
| ETF            | `isin`, `name`, `quantity>0`, `purchasePrice`                                      |
| SHARE          | `isin`, `name`, `quantity>0`, `purchasePrice`, `purchaseDate?`                     |
| PRECIOUS_METAL | `metal` (XAU/XAG/XPT/XPD), `quantity>0`, `unit` (G/OZT), `currentValue?`           |
| CRYPTO         | `coinId` (catalogue), `quantity>0` (≤8 decimals), `purchasePrice`, `purchaseDate?` |
| DEPOSIT_MONEY  | `name`, `currentValue`                                                             |

`assetType` immutable after creation. ISIN: regex + Luhn, only ETF/SHARE.

## Catalogues (domain lib)

- Metal: `{ code, symbol }`, 4 entries; display names via i18n.
- Crypto: `{ id, symbol, name }`, ~60 entries; `id` unique, stable.
- `GRAMS_PER_TROY_OUNCE = 31.1035`; `toGrams(quantity, unit)`.

## Derived

- Purchase value: `quantity × purchasePrice` (ETF/SHARE/CRYPTO); metal/deposit use `currentValue` (distribution only). Total tile ("Kaufwert") sums purchase values and counts holdings lacking a purchase price.
- Merge key: ETF `(isin, management)`; metal `(metal, management)`; deposit `(name, management)`; share/crypto none. Merge replaces fields in place and keeps `id`/`createdAt`.
