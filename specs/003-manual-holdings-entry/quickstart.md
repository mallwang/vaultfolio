# Quickstart: Manual Holdings Entry

Validates the feature end-to-end once implemented, using the Independent Tests already defined
per user story in [spec.md](./spec.md).

## Prerequisites

- Full stack running per the existing local-dev setup from 001-tech-stack-setup (frontend,
  backend, PostgreSQL containers via `docker-compose.yml`), or the equivalent local Nx dev
  targets.
- `GET /health` returns `"status": "ok"` (confirms the database is reachable) before testing
  holdings — see `apps/frontend`'s Settings > health status area or `curl localhost:<port>/health`.

## Automated validation

```bash
# Domain library — validation rules, written and passing first (Principle III)
pnpm nx test domain-holdings

# Backend — unit + integration tests, including the real-HTTP contract test
pnpm nx test backend

# Frontend — holdings list/form component tests
pnpm nx test frontend
```

All of the above MUST pass before this feature is considered done, per the constitution's
Development Workflow & Quality Gates.

## Manual / exploratory validation (maps to spec.md's Independent Tests)

1. **Add one holding of each type** (User Story 1): Open Holdings, choose "Add holding" for each
   of ETF, Share, Gold, Bitcoin with valid data. Confirm the field set changes per type
   (`contracts/holdings-api.md`'s per-type request shapes) and each new holding appears in the
   list (`GET /holdings` includes it).
2. **Leave purchase date empty** (Acceptance Scenario 5): Add a holding with quantity/price only.
   Confirm it saves and the list shows "—" for purchase date, not an error.
3. **Trigger every validation rule** (Acceptance Scenario 7, SC-002): Attempt negative quantity,
   negative price, a future purchase date, a malformed ISIN, and a Gold holding missing purity.
   Confirm each is blocked with a field-specific message and nothing is saved
   (`POST /holdings` returns `400` with `fieldErrors`, per the contract).
4. **Add two lots of the same asset** (User Story 2, Acceptance Scenario 2): Add the same ETF
   ISIN twice with different quantities/dates. Confirm both appear as separate rows — no merge.
5. **Empty state** (User Story 2, Acceptance Scenario 3): With no holdings (fresh database or all
   deleted), open Holdings and confirm the empty-state message/action renders instead of a blank
   or broken table.
6. **Edit a holding** (User Story 3): Open an existing holding for edit, confirm only its own
   type's fields are shown (e.g. no ISIN field when editing a Bitcoin holding), change a value,
   save, and confirm the list reflects the change with no duplicate row and no change to other
   holdings.
7. **Cancel an edit** (User Story 3, Acceptance Scenario 3): Open a holding for edit, change a
   field, cancel instead of saving, and confirm the stored value is unchanged.
8. **Delete with confirmation** (User Story 4): Delete a holding, confirm the confirmation dialog
   appears with the holding's summary, confirm deletion, and confirm it disappears from the list.
   Repeat and decline the confirmation — confirm the holding remains.
9. **Persistence across sessions** (FR-017, SC-006): Add a holding, reload the page (or restart
   the backend/frontend containers, leaving the database container running). Confirm the holding
   is still present with identical values.
10. **Restart-durability of the database itself** (constitution's Money/decimal handling clause,
    SC-006): Restart only the PostgreSQL container. Confirm previously entered holdings survive
    the restart (matching the precedent already proven by 001-tech-stack-setup's
    `example_value` table).

## Expected outcome

Every check above passes without needing to inspect the database directly or consult any source
outside the running application (SC-003), and the full round trip for adding one holding
completes in well under a minute of interaction (SC-001).
