# Quickstart: Restructure Asset Types (Precious Metal / Crypto)

Validates this feature end-to-end using the Independent Tests defined per user story in
[spec.md](./spec.md). Builds on 003-manual-holdings-entry's
[quickstart.md](../003-manual-holdings-entry/quickstart.md) — only the checks specific to this
rename/migration are listed here; general Holdings CRUD (add/edit/delete, validation, empty state)
is already covered there and unaffected except for the type names themselves.

## Prerequisites

- Full stack running per the local-dev setup (frontend, backend, the SQLite-backed database file
  at `DATABASE_PATH`, per 004-sqlite-migration) — `docker-compose up` or the equivalent Nx dev
  targets.
- `GET /health` returns `"status": "ok"` before testing holdings.
- For the migration checks below (#4, #5): a database file that still contains at least one
  pre-migration `GOLD` and one `BITCOIN` row. If starting from a fresh database, seed one first —
  e.g. via `POST /holdings` on a build of the app **before** this feature's changes, or by
  inserting directly with the old schema (`INSERT INTO holdings (id, asset_type, management,
weight_grams) VALUES (..., 'GOLD', ..., ...)`) before starting the migrated backend.

## Automated validation

```bash
# Domain library — validation/merge rule changes (Principle III)
npx nx test domain-holdings

# Backend — unit + integration tests, including the migration and the updated contract test
npx nx test backend

# Frontend — holdings list/form/distribution component tests
npx nx test frontend
```

All of the above MUST pass before this feature is considered done, per the constitution's
Development Workflow & Quality Gates.

## Manual / exploratory validation

1. **Add a non-gold precious metal holding** (User Story 1, SC-001): Open Holdings → Add holding →
   Precious metal, enter name "Silver" and a weight, save. Confirm it appears in the list labeled
   "Precious metal" / "Silver", distinct from any "Gold" row.
2. **Two precious metal holdings, same Management, different names** (User Story 1, Acceptance
   Scenario 2): Add "Gold" and "Silver" precious metal holdings under the same Management. Confirm
   both appear as separate rows (no merge) — the type selector no longer collapses non-gold
   metals into one bucket.
3. **Repeat the same precious metal name under the same Management** (User Story 1, Acceptance
   Scenario 3; FR-005): Add "Gold" again under a Management value that already has a "Gold" row.
   Confirm the existing row is replaced in place (same `id`, updated weight/value), not
   duplicated — matching today's single-asset Gold behavior, now keyed by name too.
4. **Add a non-Bitcoin crypto holding** (User Story 2, SC-001): Add holding → Crypto, name
   "Ethereum", quantity, purchase price, save. Confirm it appears as its own lot, and a second
   "Ethereum" submission adds a second row rather than merging (FR-006).
5. **Empty crypto name is rejected** (User Story 2, Acceptance Scenario 2; SC-004): Attempt to
   save a Crypto holding with the Name field left blank. Confirm a field-specific validation
   message appears in under 1 second and nothing is saved — same as the existing missing-ISIN/name
   rejection for Share/ETF.
6. **Pre-existing Gold/Bitcoin rows migrate on startup** (User Story 3, SC-002): Using a database
   seeded per Prerequisites, start the backend. Confirm `GET /holdings` shows the seeded row(s) as
   `assetType: "PRECIOUS_METAL"`/`"CRYPTO"` with `name: "Gold"`/`"Bitcoin"` respectively, and every
   other field (weight/quantity/price/date, Management, current value) unchanged from before
   migration.
7. **Migration does not re-run or duplicate data** (User Story 3, Acceptance Scenario 3; SC-003):
   Restart the backend again against the same database file. Confirm `GET /holdings` returns the
   exact same rows (same `id`s, same `updatedAt` timestamps as after check #6) — no duplicate rows,
   no second migration pass.
8. **Distribution view groups by name, not just type** (FR-010; design.md's Requirement
   traceability): With the "Gold"/"Silver" precious metal holdings and "Bitcoin"/"Ethereum" crypto
   holdings from the checks above, open the distribution panel — now shown on the Holdings page
   itself (FR-013) as well as the Dashboard. Confirm the legend lists each by name (e.g. "Gold"
   and "Silver" as separate slices/percentages), not one summed "Precious metal" slice.
9. **Add-holding dialog uses a type selector, not a dropdown** (FR-012): Open Add holding and
   confirm the asset-type control is a set of selectable buttons/cards (ETF / Share / Precious
   metal / Crypto), matching [design.md](./design.md)'s approved mockup, not a `p-select` dropdown.
10. **Old asset-type values are rejected on write** (FR-011): Attempt `POST /holdings` with
    `"assetType": "GOLD"` (e.g. via `curl` or an API client, simulating a stale client). Confirm a
    `400` response, not a successful create.

## Expected outcome

Every check above passes without inspecting the database directly (beyond the one-time seed step
in Prerequisites, which is about setting up pre-migration data, not verifying the migration).
Checks #6–#7 confirm FR-007/FR-008's migration safety without needing a database client — `GET
/holdings` and repeated backend restarts are sufficient.
