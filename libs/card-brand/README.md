# card-brand

Framework-independent card network (VISA/MASTERCARD/AMEX) derivation from a
card number's leading digits, shared between `scope:domain` and
`scope:frontend-domain` consumers — tagged `scope:shared` so both are
permitted to depend on it per the module-boundary rules in
`eslint.config.mjs`. Extracted from `libs/domain/accounts` and
`libs/frontend/domain/account-overview`, which previously each carried an
identical copy.

## Running unit tests

Run `npm exec nx test card-brand` to execute the unit tests via Jest.
