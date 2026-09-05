# Quickstart: Validating the Domain Library Architecture

**Feature**: 020-domain-library-architecture

Prerequisites: workspace installed (`npm install`), backend/frontend runnable per existing
`docker-compose.yml` / `nx serve` setup.

## 1. Boundary enforcement holds (US1 / SC-001)

```bash
npx nx run-many -t lint
```

Expected: passes clean today. Then, temporarily, add a one-off import from
`libs/frontend/domain/holdings/src/lib/...` (a non-exported file) into a scratch second library
tagged `scope:frontend-domain`, or directly into `apps/frontend` bypassing the library's
`index.ts` public export:

```bash
npx nx lint holdings   # or the affected project's lint target
```

Expected: fails with an `@nx/enforce-module-boundaries` error. Revert the scratch import. See
[contracts/module-boundaries.md](contracts/module-boundaries.md) for the exact rule that fires.

## 2. Holdings retrofit preserves existing behavior (US2 / SC-002)

```bash
npx nx serve frontend &
npx nx serve backend &
```

Sign in as an existing user with prior holdings access and confirm, unchanged from before this
feature:

- View the holdings list and the distribution-by-type chart at `/app/holdings`.
- Create, edit, and delete a holding.
- Run a CSV/JSON import at `/app/imports`.

Expected: identical behavior to pre-restructure, per each flow's existing spec (003–004, 016–019)
acceptance criteria — this is a structural move, not a behavior change.

```bash
npx nx test frontend-domain-holdings   # or the project name the generator assigns
npx nx test frontend
```

Expected: all pre-existing holdings tests pass unchanged (moved, not rewritten), plus a passing
boundary check.

## 3. Entitlement mechanism gates both nav and route together (US3 / SC-003)

1. Sign in as an Administrator, open **Admin → Accounts**.
2. Select a non-admin test account, remove `holdings` from its domain scopes
   ([contracts/domain-access.md](contracts/domain-access.md)), save.
3. Sign in as that test user (or refresh its session):
   - The **Holdings** sidebar entry is gone.
   - Navigating directly to `/app/holdings` redirects away (same treatment as an unentitled route
     today).
4. Re-add `holdings` to that user's scopes; sign in again: both the nav entry and the route work
   again.
5. Confirm an Administrator account keeps Holdings access throughout step 2–3, regardless of its
   own `domainScopes` value (FR-008).

Expected: nav visibility and route access never diverge for the same user/domain pair — both are
driven by the single `isDomainEntitled` call.

## 4. Structure generalizes to a next domain (SC-004, FR-011)

Without writing this out for real, confirm (by inspection) that adding a next domain requires only:

1. A new library under `libs/frontend/domain/<name>` (same shape as `holdings`, tagged
   `scope:frontend-domain`).
2. One new entry in `DOMAIN_REGISTRY` (`libs/frontend/domain-access`).
3. One new route in `apps/frontend/src/app/app.routes.ts` using `domainGuard('<name>')`.

No change to `holdings`' code, tests, or deploy path is required for any of the above — satisfying
FR-011.
