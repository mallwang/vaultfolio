# Implementation Plan: Domain Maintenance Mode

**Branch**: `041-domain-maintenance-mode` | **Date**: 2026-10-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/041-domain-maintenance-mode/spec.md`

**Design**: [design.md](design.md), approved mockup [mockup.html](mockup.html)

## Summary

Admins can put each product domain into **maintenance** from a new "Domänen" admin tab. The state is
a persisted per-domain flag (plus an audit trail). It is enforced server-side in the existing global
`DomainGuard`: for a domain in maintenance, every `@RequiresDomain` route rejects **non-admin**
callers with `503 DOMAIN_MAINTENANCE` after the normal entitlement check; admins pass unchanged. No
data is touched.

Frontend: a small `DomainMaintenanceStore` loads the list of domains in maintenance once per page
load (`GET /domains/maintenance`), so changes appear on the next reload. Navigation items stay visible
(with a wrench marker), a route wrapper replaces the domain page with a shared orange
`MaintenanceNoticeComponent` for members (admins get a banner), and dashboard tiles swap to a shared
`MaintenanceTileComponent` for members (admins keep the tile plus a badge). A 503 `DOMAIN_MAINTENANCE`
response refreshes the store so a stale open page switches to the notice.

Reminder mails: `InsurancesReminderService.sweep` skips the insurances owners while the domain is in
maintenance. Because the sweep claims a reminder row only when it actually sends, and a deadline is
"due" for every sweep while `0 <= daysLeft <= leadDays`, skipped reminders are caught up by the first
sweep after maintenance ends, and are never sent once the deadline has passed (spec FR-014, FR-015)
with no extra bookkeeping.

## Technical Context

**Language/Version**: TypeScript (Node.js LTS runtime for the backend), Angular for the frontend

**Primary Dependencies**: NestJS, Angular, PrimeNG, Nx. No new third-party dependency.

**Storage**: SQLite via the existing `DatabaseService`; two new tables (`domain_maintenance`,
`domain_maintenance_audit`), created with `CREATE TABLE IF NOT EXISTS`. See
[data-model.md](data-model.md).

**Testing**: Jest (backend), the existing Angular unit-test setup (frontend); integration tests
against a real temp SQLite file for the guard and the reminder sweep (Principle IV).

**Target Platform**: Linux server container, evergreen browsers

**Project Type**: web-service + frontend, Nx monorepo

**Performance Goals**: Guard check adds one primary-key single-row read per request on domain routes;
negligible next to the existing session lookup.

**Constraints**: Single backend process (SQLite). Entitlement check (403) stays before the
maintenance check (503). Admins are never blocked. State is read per request (no cache) so a change
applies immediately to all API calls, and on the next page load in the UI.

**Scale/Scope**: 8 registry domains, 2 tables, 3 endpoints, 1 admin tab, 2 shared UI components, 1
route wrapper.

## Constitution Check

_Gate: passes before Phase 0; re-checked after Phase 1 design._

| Principle                     | Status | Notes                                                                                                                                                                                                |
| ----------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Library-First              | Pass   | No financial logic is added. The domain id list lives in `@vaultfolio/api-contract`; the maintenance logic is a small backend module. A new standalone library would be organizational-only (YAGNI). |
| II. API-First                 | Pass   | Contract written first in [contracts/maintenance-api.md](contracts/maintenance-api.md); structured `503 DOMAIN_MAINTENANCE` error body.                                                              |
| III. Test coverage            | Pass   | Guard, service, controllers, reminder skip/catch-up, store, gate and components each get tests.                                                                                                      |
| IV. Integration testing       | Pass   | Guard + controller e2e with real SQLite; reminder sweep across a maintenance window.                                                                                                                 |
| V. Observability & simplicity | Pass   | State changes are logged as structured events (ids only, no personal data) and stored in the audit table; no new dependencies.                                                                       |
| Sensitive data rules          | Pass   | Audit stores admin user id and domain id only.                                                                                                                                                       |

Post-design re-check: unchanged, no violations.

## Project Structure

### Documentation (this feature)

```text
specs/041-domain-maintenance-mode/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── maintenance-api.md
├── design.md
├── mockup.html
└── tasks.md              # created by /speckit-tasks
```

### Source Code (repository root)

```text
libs/api-contract/src/lib/maintenance.ts              # MAINTENANCE_DOMAIN_IDS, DTO types, error code

apps/backend/src/
├── maintenance/                                      # new module
│   ├── maintenance.module.ts
│   ├── maintenance.repository.ts                     # state + audit, transactional set()
│   ├── maintenance.service.ts                        # isInMaintenance(), list(), set(actor, ...)
│   ├── maintenance.controller.ts                     # GET /domains/maintenance (any signed-in user)
│   ├── maintenance-admin.controller.ts               # GET/PUT /admin/domains[/:id] (ADMIN)
│   └── maintenance.exceptions.ts                     # DomainMaintenanceException -> 503
├── auth/domain.guard.ts                              # + maintenance check for non-admins
├── database/database.service.ts                      # + two tables
├── insurances/insurances-reminder.service.ts         # skip while in maintenance
└── openapi/dto/maintenance.ts                        # Swagger DTOs

libs/frontend/
├── shared-ui/src/lib/maintenance/                    # MaintenanceTileComponent, MaintenanceNoticeComponent
├── domain-access/src/lib/                            # DOMAIN_MAINTENANCE_SOURCE token, isDomainInMaintenance()
└── admin/src/lib/domains/                            # Domänen tab (component + service)

apps/frontend/src/app/
├── core/maintenance/                                 # DomainMaintenanceStore, DomainMaintenanceGateComponent
├── core/layout/app-sidebar/                          # wrench marker on nav items
├── dashboard/                                        # tile swap for domains in maintenance
├── core/http-error.interceptor.ts                    # refresh store on 503 DOMAIN_MAINTENANCE
└── app.routes.ts                                     # gate wrapper on domain routes + admin/domains child route
```

**Structure Decision**: Extend the existing backend `DomainGuard` instead of adding a second guard to
every controller, so any future `@RequiresDomain` route is covered automatically. Frontend state is a
store in `apps/frontend` exposed through a token in `domain-access` (same pattern as
`CURRENT_USER_SOURCE`), so scope:shared libraries stay free of app dependencies. No new Nx project.

## Complexity Tracking

No constitution violations.
