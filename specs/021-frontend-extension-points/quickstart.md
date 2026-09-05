# Quickstart: Validating the Frontend Shell Extension Points

**Feature**: 021-frontend-extension-points

Prerequisites: workspace installed (`npm install`), backend/frontend runnable per existing
`docker-compose.yml` / `nx serve` setup (see 020's quickstart.md for the general pattern this one
extends).

## 1. Dashboard widget contribution holds (US1)

```bash
npm exec nx serve frontend &
npm exec nx serve backend &
```

- Sign in as a user entitled to `holdings`. Confirm the Dashboard's Allocation card shows the
  holdings distribution widget exactly as before this change (Acceptance Scenario 1).
- As an Administrator, revoke that user's `holdings` scope (Accounts screen), then have them
  refresh/re-sign-in. Confirm the widget is gone and the Dashboard's other cards render without
  error or empty gaps (Acceptance Scenarios 2, 4).
- Add a throwaway `scope:frontend-domain` library with one `DASHBOARD_WIDGET_CONTRIBUTIONS` entry
  (see contracts/dashboard-settings-extension-points.md §Verification). Confirm its widget appears
  only for a user entitled to that throwaway domain, without editing
  `dashboard.component.ts`/`.html` beyond the one registry-array entry (Acceptance Scenario 3,
  SC-001). Remove the throwaway library afterward.

## 2. Settings tab contribution holds (US2)

- As any signed-in user, confirm Profile and Preferences remain available at
  `/app/settings/profile` and `/app/settings/preferences` (Acceptance Scenario 1).
- Add a throwaway `SETTINGS_TAB_CONTRIBUTIONS` entry pointing at a scratch component, tied to a
  domain the test user is entitled to. Confirm the tab appears and navigates to that content
  (Acceptance Scenario 2).
- Remove that domain entitlement and confirm the tab disappears (Acceptance Scenario 3).
- Visit the contributed tab's URL directly while not entitled — confirm the same redirect
  `domainGuard` already produces for a domain's main route (Acceptance Scenario 4).
- Confirm a domain that contributes no settings tab (e.g. holdings, per this spec's Assumptions)
  adds no extra tab for a user entitled to it (Acceptance Scenario 5).

## 3. Imports lives inside Holdings (US3)

```bash
npx nx run-many -t lint
```

Expected: passes — `application-areas.ts` no longer lists an `imports` entry.

- As a holdings-entitled user, confirm the app navigation shows only "Holdings", no separate
  "Imports" entry (Acceptance Scenario 1).
- Open Holdings (`/app/holdings`) and confirm an "Imports" tab is present alongside the list
  (Acceptance Scenario 2); run an import there and confirm it behaves exactly as before (SC-002).
- As a user not entitled to holdings, confirm both the nav and a direct visit to
  `/app/holdings/imports` are denied the same way the rest of Holdings is denied (Acceptance
  Scenario 3).
- Visit the pre-change `/app/imports` address (and `/imports`) and confirm it lands on
  `/app/holdings/imports` (Acceptance Scenario 4, SC-006).

## 4. Admin is a separate module (US4)

```bash
npx nx run-many -t lint
```

Expected: passes — `libs/frontend/admin` is tagged `scope:frontend-admin`; no
`@nx/enforce-module-boundaries` violation.

- As an Administrator, exercise every existing Admin flow — Accounts, Sign-ups, Invitations,
  General/health-status — and confirm each behaves unchanged (Acceptance Scenario 1, SC-003).
- As a non-Administrator, confirm the navigation hides Admin and a direct visit to `/app/admin` (or
  any sub-address) redirects away, exactly as before (Acceptance Scenario 2).
- Inspect `libs/frontend/admin/package.json`'s `nx.tags` and confirm it reads
  `scope:frontend-admin`, distinct from every `libs/frontend/domain/*` library's
  `scope:frontend-domain` (Acceptance Scenario 3).

## 5. Full regression sweep

```bash
npm exec nx run-many -t test
npm exec nx run-many -t lint
```

Expected: all existing Holdings (view/create/edit/delete/import/distribution — SC-002) and Admin
(Accounts/Sign-ups/Invitations/General — SC-003) tests pass unchanged; lint remains clean workspace-
wide, including the new `scope:frontend-admin` boundary (contracts/module-boundaries.md).
