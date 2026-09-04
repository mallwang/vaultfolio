# Quickstart: Deposit Money Asset Type

Validates the feature end-to-end per [spec.md](spec.md)'s User Stories. See
[data-model.md](data-model.md) for field rules and
[contracts/holdings-api-deposit-money.md](contracts/holdings-api-deposit-money.md) for the API
shape.

## Prerequisites

- Full stack running locally (`docker-compose up`, or `nx serve backend` + `nx serve frontend`
  against a local SQLite file), with an authenticated session (an existing account, per
  005-auth-sessions-isolation).
- Backend has started at least once since this feature's migration was added, so the `holdings`
  table accepts `DEPOSIT_MONEY`.

## User Story 1 — Record a cash balance

1. Sign in and open the holdings-entry flow.
2. Select the "Deposit money" asset type.
3. Confirm the form shows only Name, Managing institution, and Current value (no quantity, price,
   ISIN, purchase date, or weight fields).
4. Enter name `"N26 checking"`, managing institution `"N26"`, current value `1250.00`, and save.
5. **Expected**: the holding appears in the holdings list showing name, institution, and current
   value.

Or via the API directly:

```bash
curl -X POST http://localhost:3000/holdings \
  -H "Content-Type: application/json" -H "Cookie: <session cookie>" \
  -d '{"assetType":"DEPOSIT_MONEY","management":"N26","name":"Checking","currentValue":"1250.00"}'
```

**Expected**: `201` with the created holding, `assetType: "DEPOSIT_MONEY"`.

## Validation edge cases

- Omit `name` or `currentValue` → `400 VALIDATION_FAILED` naming the missing field.
- Submit `currentValue: "-5"` → `400 VALIDATION_FAILED` naming `currentValue`.
- Submit `currentValue: "0"` → `201`/`200`, accepted (an emptied account is valid, not an error).
- Submit `isin`, `quantity`, `purchasePrice`, `purchaseDate`, or `weightGrams` alongside
  `assetType: "DEPOSIT_MONEY"` → `400 VALIDATION_FAILED` naming that field.

## User Story 2 — Update an existing balance

1. Re-submit the same holding from User Story 1 with the same `management`/`name` but a different
   `currentValue` (e.g. `1300.00`).
2. **Expected**: the holdings list still shows exactly one "N26 checking" holding, now valued at
   1300.00 — no duplicate row created.
3. Create a second deposit-money holding with the same `name` ("Checking") but a different
   `management` (e.g. a different bank). Update the first again.
4. **Expected**: the second holding's value is unaffected by the first's update.

## User Story 3 — Reflected in overall wealth

1. With one or more deposit-money holdings saved, open the portfolio overview.
2. **Expected**: the displayed total wealth includes the sum of the deposit-money holdings'
   current values, and each is labeled distinctly (by its own name) rather than blended into an
   unlabeled total.

## Migration check

1. Start the backend against an existing database created before this feature.
2. **Expected**: startup succeeds, existing holdings are unchanged, and a new `DEPOSIT_MONEY`
   holding can immediately be created without further manual steps.
