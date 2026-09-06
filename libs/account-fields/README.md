# account-fields

Framework-independent literals shared between `scope:domain` and
`scope:frontend-domain` consumers of the account overview feature —
`AccountCategory`/`ACCOUNT_CATEGORIES`, `AccountStatus`/`ACCOUNT_STATUSES`,
and card-brand (VISA/MASTERCARD/AMEX) derivation. Tagged `scope:shared` so
both are permitted to depend on it per the module-boundary rules in
`eslint.config.mjs`. Extracted from `libs/domain/accounts` (the domain-layer
source of truth for these literals) and
`libs/frontend/domain/account-overview`, which previously each carried
identical copies.

Note: `libs/api-contract`'s `AccountCategory`/`AccountStatus` (the wire
contract) are kept as separate, independently-defined literals on purpose —
mirroring `libs/api-contract/src/lib/holdings.ts`'s `AssetType` vs.
`libs/domain/holdings`'s — so this lib does not replace those.

## Running unit tests

Run `npm exec nx test account-fields` to execute the unit tests via Jest.
