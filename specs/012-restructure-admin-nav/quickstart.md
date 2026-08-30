# Quickstart: Validate Restructured Admin & Settings Navigation

Validates the design in [plan.md](./plan.md) and [data-model.md](./data-model.md) against the
spec's acceptance scenarios and success criteria. No new services/ports are introduced — this
runs the existing app.

## Prerequisites

- Repo dependencies installed (`npm install` at the repo root).
- Full stack running per the existing dev workflow (frontend + backend + SQLite), e.g.:
  ```bash
  npx nx serve backend
  npx nx serve frontend
  ```
- Two test sessions available: one signed in as a user with role `ADMIN`, one as `MEMBER`
  (existing accounts/invitation flow — no new seed data required).

## Scenario 1 — Admin area exists and holds the relocated sections (User Story 1, FR-001/FR-002)

1. Sign in as the ADMIN user.
2. Open the side-navigation → confirm an **Admin** entry appears alongside Dashboard, Holdings,
   Imports, Settings.
3. Open **Admin** → confirm four tabs: **Accounts**, **Sign-ups**, **Invitations**, **General**,
   each showing the same content/actions as before (list accounts, review sign-ups, manage
   invitations, view health status).
4. Open **Settings** → confirm Accounts, Sign-ups, Invitations, and General are **not** present.

**Expected**: Matches Acceptance Scenarios 1–3 of User Story 1; SC-001 and SC-004 satisfied (all
relocated functionality reachable and behaviorally unchanged).

## Scenario 2 — Settings trimmed to Profile + Preferences (User Story 2, FR-003/FR-004)

1. Sign in as any user (ADMIN or MEMBER).
2. Open **Settings** → confirm exactly two tabs: **Profile** and **Preferences**.
3. Open **Preferences** → confirm the existing "coming soon" placeholder content is shown,
   unchanged from its previous copy inside the old General tab.
4. As a MEMBER user specifically, confirm no admin-only content is present anywhere in Settings.

**Expected**: Matches Acceptance Scenarios 1–3 of User Story 2; SC-003 satisfied.

## Scenario 3 — Admin nav/route hidden from MEMBER (User Story 3, FR-005/FR-006/FR-007)

1. Sign in as the MEMBER user.
2. Confirm the side-navigation shows **no** "Admin" entry.
3. Attempt to navigate directly to the admin route's address (e.g. type `/app/admin` in the
   address bar or via browser history/bookmark).
4. Confirm the app does not render admin content — it redirects away (e.g. to the dashboard),
   consistent with existing protected-route behavior.
5. Sign in as the ADMIN user and repeat steps 2–3 → confirm the Admin entry is shown and the route
   loads normally.

**Expected**: Matches Acceptance Scenarios 1–3 of User Story 3; SC-002 satisfied.

## Regression check — backend enforcement unchanged (FR-008)

No backend changes are part of this feature. Confirm existing backend tests for
`accounts.controller`, `signups.controller`, and `invitations.controller` (role-guarded via
`@Roles('ADMIN')`) still pass unmodified:

```bash
npx nx test backend
```

## Frontend checks

```bash
npx nx test frontend   # unit tests for AppSidebarComponent filtering, AdminGuard, AuthGuard
npx nx lint frontend
```

**Expected**: All existing frontend tests for moved components (Accounts, Sign-ups, Invitations,
Health Status, Profile) continue to pass with only import-path updates; new tests cover the
`roles`-based sidebar filter and `adminGuard` redirect behavior.
