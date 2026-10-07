# Quickstart: Validating Domain Maintenance Mode

Prerequisites: backend and frontend running (see `docs/development.md`), one admin and one member
account entitled to Versicherungen. Use the `verify-ui` skill for the UI steps.

## 1. Toggle as admin

1. Sign in as admin, open Verwaltung, tab "Domänen".
2. Switch "Versicherungen" on, confirm the dialog.
3. Expect: tag "In Wartung", "Zuletzt geändert" shows your name and time. Reload: state persists.

## 2. Member experience

1. Sign in as the member. Expect: nav item "Versicherungen" still visible with the wrench marker.
2. Dashboard: the Versicherungen tile shows the orange "Wartungsarbeiten" text.
3. Open the nav item: centered orange notice with icon, no domain content.

## 3. API block

```bash
# member session cookie: expect 503 with error DOMAIN_MAINTENANCE
curl -i -b member.cookie http://localhost:3000/insurances
# admin session cookie: expect 200
curl -i -b admin.cookie http://localhost:3000/insurances
# other domain stays available for the member: expect 200
curl -i -b member.cookie http://localhost:3000/holdings
```

## 4. Admin keeps working

As admin open Versicherungen: regular content with the orange banner; dashboard tile shows content
plus the badge.

## 5. Data and audit

Compare row counts of the insurance tables before and after the maintenance window (must be equal).
Check `domain_maintenance_audit` has one row per real change with actor and timestamp.

## 6. Reminders

With a contract whose deadline is within the lead time: run the reminder sweep during maintenance,
expect no mail and no `insurance_reminder_log` row; end maintenance, run again, expect exactly one
mail and one log row.

## 7. Automated checks

```bash
npx nx run-many -t lint test typecheck -p backend frontend api-contract frontend-shared-ui frontend-admin
```

(Use the project names from `npx nx show projects`.)
