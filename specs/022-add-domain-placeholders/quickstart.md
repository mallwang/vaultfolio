# Quickstart: Validating the Placeholder Domains

Prerequisites: workspace installed (`npm install`), backend + frontend runnable per the repo's
existing `docker-compose.yml` (or `npm exec nx serve backend` / `npm exec nx serve frontend` for
local dev), an admin account to grant entitlements, and a second (non-admin) test account.

## 1. Confirm the five domains are registered but invisible by default (FR-010, SC-002)

1. Sign in as the test (non-admin) account with no domain entitlements beyond whatever it already
   has.
2. Confirm the sidebar shows only its existing entries (e.g. Dashboard, Holdings if entitled,
   Settings) — none of Retirement, Insurances, Haushaltsplaner, Historic Wealth Development, or
   Account Overview appear.
3. Navigate directly to `/app/retirement` (and the other four paths). Confirm each redirects to
   `/app/dashboard`, the same way visiting `/app/holdings` without Holdings entitlement does today.

## 2. Grant one domain and confirm it lights up end-to-end (US1, US3, SC-001, SC-003)

1. As the admin, open Admin → Accounts, find the test account, and grant it the `retirement`
   domain scope via the existing domain-scope checkboxes (`DOMAIN_REGISTRY`-driven — no new admin
   UI should be needed to see the new entry).
2. Sign back in as the test account. Confirm a "Retirement" nav entry now appears.
3. Open it. Confirm a placeholder page loads naming "Retirement" and stating it isn't built yet
   (FR-003).
4. Revoke the `retirement` scope as admin; confirm the nav entry disappears for the test account
   and `/app/retirement` redirects again.
5. Repeat steps 1–4 for the remaining four domains (`insurances`, `haushaltsplaner`,
   `historic-wealth-development`, `account-overview`) to cover FR-002/FR-004/FR-008 for all five.

## 2a. `npm exec nx run` equivalent of step 2's grant, for automated/CI verification

```bash
# Obtain an admin session cookie/token first via the existing sign-in flow, then:
curl -X PATCH http://localhost:3000/accounts/<test-account-id>/domain-scopes \
  -H 'Content-Type: application/json' \
  --cookie "<admin-session-cookie>" \
  -d '{"domainScopes": ["retirement"]}'
# Expect 200 with the updated AccountSummary; previously this call would 400
# with {"error":"invalid_domain"} for any id other than "holdings".
```

## 3. Confirm Dashboard/Settings stay clean with new-domain-only entitlement (US2, SC-005)

1. As the test account entitled to one or more of the five new domains (and no other domain),
   open Dashboard. Confirm it renders its non-domain-specific content only — no widget, error, or
   empty gap for any of the five.
2. Open Settings. Confirm only Profile and Preferences appear — no extra tab, error, or empty tab.

## 4. Confirm Holdings and admin defaults are unaffected (FR-006, FR-009, SC-004)

1. As an existing Holdings-entitled account with no new-domain entitlement, confirm every existing
   Holdings journey (list, create/edit/delete a holding, imports tab, distribution widget on
   Dashboard) behaves exactly as before this feature.
2. Sign in as any admin account (no explicit domain scopes needed). Confirm all five new domains'
   nav entries are visible and their placeholder pages open, exactly like Holdings' existing
   always-on admin access (FR-009).

## 5. Automated regression

```bash
npm exec nx affected -t lint test build
```

Confirms: the new libraries respect the `scope:frontend-domain` ESLint boundary (no cross-domain or
backend import), each placeholder component's unit test passes, and nothing in Dashboard/Settings/
Holdings/accounts regresses (Nx's affected-graph will include them if the registries they read from
changed).
