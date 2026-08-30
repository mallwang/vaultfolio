# Quickstart: Validating the App Shell Restructure

Manual/e2e validation steps for the acceptance scenarios in [spec.md](./spec.md). See
[contracts/routes.md](./contracts/routes.md) for the full route table and
[data-model.md](./data-model.md) for the Auth Status states referenced below.

## Prerequisites

```bash
npm exec nx run-many -t serve -p backend,frontend
```

Have at least one seeded/known user account (email + password) able to sign in.

## Scenario 1 — Header always present (User Story 1)

1. Open `/sign-in` signed out → header is visible, shows the brand only (no name, role badge, or
   sign-out control) — FR-001, FR-009.
2. Sign in, land on an authenticated page → header still visible, now shows name + role badge +
   sign-out control — FR-001, FR-008.

## Scenario 2 — Authenticated pages under `/app` (User Story 2)

1. Signed in, navigate to Dashboard, Holdings, Imports, Settings via the sidebar → confirm the
   address bar shows `/app/dashboard`, `/app/holdings`, `/app/imports`, `/app/settings`
   respectively.
2. Signed out, open `/sign-in` and `/signup` directly → addresses have no `/app` prefix.
3. Signed in, manually enter the legacy address `/dashboard` (or `/holdings`, `/imports`,
   `/settings`) → lands on the equivalent `/app/...` page, not an error (FR-013).
4. Signed out, manually enter `/app/dashboard` → redirected to `/sign-in` (FR-011).

## Scenario 3 — Sidebar only when signed in (User Story 3)

1. Signed out, load any public page → no sidebar present.
2. Sign in → sidebar appears immediately (no manual refresh) and lists Dashboard, Holdings,
   Imports, Settings (FR-004, FR-005).
3. Sign out from an authenticated page → sidebar disappears on the page landed on afterward
   (FR-007).

## Scenario 4 — Header identity + sign-out (User Story 4)

1. Signed in, view the header on any `/app/...` page → confirm display name and role badge are
   correct for the signed-in account.
2. Click the header's sign-out control → session ends, lands on a public page, header no longer
   shows identity content, sidebar is gone (FR-010).

## Edge cases to spot-check

- Hard-refresh an authenticated `/app/...` page while genuinely signed in → header briefly shows
  no identity (Auth Status `unknown`), then correctly shows identity once the session check
  resolves (Auth Status `authenticated`) — never a flash of "signed out" content.
- Invalidate the session (e.g. clear the session cookie) then act on an `/app/...` page → redirected
  to `/sign-in`.
- Navigate to a nonsense address while signed in vs. signed out → `NotFoundComponent` renders with
  the header in both cases, and with the sidebar only in the signed-in case.
