# Contract: Insurances REST API

All routes require a signed-in session (global `AuthGuard`) and `@RequiresDomain('insurances')`
(admins pass, members need the domain in their `domainScopes`). `InsurancesAvailableGuard` then answers
`503 INSURANCES_UNAVAILABLE` on every route while `INSURANCES_ENCRYPTION_KEY` is missing, invalid or does
not match the stored data. Every route reads and writes **only the caller's own data**; another owner's
id behaves like a missing id. Bodies are validated by the strict whitelist in `@vaultfolio/insurances`;
types live in `@vaultfolio/api-contract` (`insurances.ts`). Logs contain contract id, counts and
outcome, never names, insurers, contract numbers or amounts.

## Error body

Same shape as the other domains (`ErrorResponseDto`): `{ error, message, details? }`. Validation details
name the field only: `details: [{ field, message: <CODE> }]`.

| Status | `error`                         | When                                                            |
| ------ | ------------------------------- | --------------------------------------------------------------- |
| 400    | `INSURANCES_VALIDATION`         | missing or invalid value, negative premium, end before start    |
| 400    | `INSURANCES_UNKNOWN_FIELD`      | field outside the whitelist, or detail key not allowed for type |
| 400    | `INSURANCES_LIMIT_EXCEEDED`     | more than 200 contracts                                         |
| 403    | `FORBIDDEN`                     | domain not entitled                                             |
| 404    | `INSURANCES_CONTRACT_NOT_FOUND` | unknown id or id of another owner                               |
| 503    | `INSURANCES_UNAVAILABLE`        | key missing or invalid                                          |

## Types

```text
Money = string                    // "612.00"
Date  = string                    // "YYYY-MM-DD"

InsuranceContract = { id, ...Contract (data-model.md), createdAt, updatedAt }
InsuranceSettings = Settings (data-model.md)
LinkedSocialLine  = { kind: 'HEALTH'|'CARE'|'PENSION'|'UNEMPLOYMENT', monthly: Money, period: 'YYYY-MM' }

InsurancesData = {
  contracts: InsuranceContract[],
  linkedSocial: LinkedSocialLine[],      // empty without Earnings access or data
  settings: InsuranceSettings,           // defaults when never saved
  today: Date                            // server date, used by the client for deadline math
}
```

## Routes

| Method | Path                        | Body / Query | Result                  | Notes                                                        |
| ------ | --------------------------- | ------------ | ----------------------- | ------------------------------------------------------------ |
| GET    | `/insurances`               | –            | `200 InsurancesData`    | one call for the whole page                                  |
| POST   | `/insurances/contracts`     | `Contract`   | `201 InsuranceContract` | limit 200                                                    |
| PUT    | `/insurances/contracts/:id` | `Contract`   | `200 InsuranceContract` | full replace; removes reminder-log rows of changed deadlines |
| DELETE | `/insurances/contracts/:id` | –            | `204`                   | also deletes the contract's reminder-log rows                |
| PUT    | `/insurances/settings`      | `Settings`   | `200 InsuranceSettings` | profile, reminders, dismissals, `includeSocial`              |
| DELETE | `/insurances`               | –            | `204`                   | deletes all contracts, settings and log rows of the caller   |

`linkedSocial` is derived on every `GET` from the caller's Earnings data (only if the caller is entitled
to the `earnings` domain and the Earnings key is available) and is read-only; there is no write route
for it. Manual overrides are ordinary contracts of a `STATUTORY_*` type.

## Reminder e-mail (internal, not a route)

Notification type `insurance-deadline-reminder`, languages `de`/`en`, view model
`{ typeLabel, contractName, deadlineDate, areaUrl }`. No amounts, insurer or contract number.

## Versioning

Additive changes only within 0.x; `api/openapi.yml` and the drift/completeness checks are updated in the
same change. Bruno requests under `api/bruno/insurances/`.
