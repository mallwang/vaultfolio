# Quickstart: Validating Encryption Key Rotation and Recovery

Validation guide only; behaviour is defined in [spec.md](spec.md), the schema in
[data-model.md](data-model.md) and the API in
[contracts/admin-encryption.openapi.yml](contracts/admin-encryption.openapi.yml).

## Prerequisites

- `npm ci` at the repo root; backend runnable (`npx nx serve backend`) with an empty or seeded
  `data/` directory (use a scratch `DATABASE_PATH`, never the real database).
- A key generated with `openssl rand -base64 32`, exported as `ENCRYPTION_KEY`. Admin account from the bootstrap variables (see `verify-ui` skill for
  the test login; never read `.env`).
- A database from the current release for Scenario 1 (any scratch DB created before this feature
  with some rows in the Earnings and Insurances domains).

## Automated checks

```bash
npx nx test encryption          # library: wrap/unwrap, formats, tamper, wrong key
npx nx test backend             # keyring, rotation, registry, controller specs and tests/encryption.e2e-spec.ts (real temp SQLite)
npx nx test frontend-admin      # admin screen
npx nx run-many -t lint,typecheck -p encryption backend frontend-admin
```

## Scenario 1: Upgrade without manual migration (Story 4, SC-005)

1. Start the new backend on the old database with `ENCRYPTION_KEY` set.
2. Expected: log shows one `LEGACY_MIGRATION` run per domain that had data; all data is readable in
   the app; `GET /admin/encryption/status` shows `READY`, `currentVersion: 2`, and
   `rowsPerVersion` has only `"2"`.

## Scenario 2: Master key rotation (Story 1, SC-006)

1. Set `ENCRYPTION_KEY=<new>` and `ENCRYPTION_KEY_PREVIOUS=<old>`, restart.
2. Status shows `rotationPending: true`; Earnings still works.
3. In the admin screen run "Rotate master key" for Earnings; status shows `rotationPending: false`,
   `previousKeyRemovable: true`; history has a `MASTER_KEY` entry with the admin's e-mail.
4. Remove the previous variable, restart: Earnings still readable. Starting with only the old key
   instead must report `KEY_MISMATCH`.

## Scenario 3: Missing or wrong key (Story 3, SC-003, SC-004)

1. Start with the Insurances key unset: Insurances answers `503`, other domains and the admin screen
   work, log names `INSURANCES` and "missing key", database file unchanged (compare checksum).
2. Start with a wrong (valid but different) key: `KEY_MISMATCH`, still no writes.
3. Restore the correct key, restart: everything readable again.

## Scenario 4: Full re-encryption after a leak (Story 2)

1. In the admin screen start "Re-encrypt data" for Wealth, typing `wealth` to confirm.
2. While running: Wealth routes answer `503` ("temporarily unavailable"), other domains work.
3. After it finishes: `currentVersion` is the new version, `rowsPerVersion` shows one version, all
   records readable; run "Destroy retired key" for the old version; a second attempt or an attempt
   while rows still use it is refused (`ENCRYPTION_KEY_IN_USE`).
4. Interrupt the process mid-run (kill the backend), restart: domain readable, history shows
   `INTERRUPTED`; run re-encryption again to finish.

## Scenario 5: Backup and restore (Story 5, SC-008)

Follow the operator guide in `README.md` / `README.de.md`: back up the data directory and the key
values separately, restore both into a clean environment, confirm status is `READY` for all domains
and sample data is readable.

## Scenario 6: Scale check (SC-007)

Run the opt-in timing check (synthetic rows only): in `apps/backend`,
`ENCRYPTION_PERF=1 npx jest src/tests/encryption-performance` seeds 10,000 records, then times master
key rotation (expect under 1 minute) and re-encryption (expect under 10 minutes).
