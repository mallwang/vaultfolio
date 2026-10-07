# Research: Domain Maintenance Mode

## D1 - Where to enforce the API block

- **Decision**: Extend the global `DomainGuard` (`apps/backend/src/auth/domain.guard.ts`). After the
  existing entitlement check passes, if the `@RequiresDomain` id is in maintenance and the caller is
  not an `ADMIN`, throw `DomainMaintenanceException` (`503`, code `DOMAIN_MAINTENANCE`).
- **Rationale**: Every domain controller already declares `@RequiresDomain(...)` (holdings,
  retirement, insurances, earnings, historic-wealth-development, account-overview), so all read,
  write and export routes are covered with one change, and future domains are covered automatically.
  Entitlement (403) stays first, so non-entitled callers learn nothing about maintenance.
- **Alternatives**: A per-controller guard like `InsurancesAvailableGuard` (repetitive, easy to
  forget); an HTTP interceptor on URL prefixes (duplicates the route-to-domain mapping).

## D2 - Status code and error body

- **Decision**: `503 Service Unavailable` with the existing structured error shape and
  `error: 'DOMAIN_MAINTENANCE'`, plus the domain id. Distinct from `403` (permission) and from the
  encryption `503 *_UNAVAILABLE` codes.
- **Rationale**: 503 means "temporarily unavailable", matches the existing `*_UNAVAILABLE` pattern
  and lets the frontend tell the cases apart by code.

## D3 - Persistence

- **Decision**: Table `domain_maintenance` (one row per domain, only domains ever toggled have a row;
  missing row means active) and an append-only `domain_maintenance_audit`. Change and audit insert
  happen in one transaction. State is read per request, no in-memory cache.
- **Rationale**: Single backend process on SQLite, single-row primary-key lookup is cheap and avoids
  cache-invalidation bugs. Matches FR-003, FR-016.
- **Alternatives**: Environment/config flag (needs restart, no audit); in-memory cache with TTL
  (staleness for no measurable gain).

## D4 - Which domains can be put into maintenance

- **Decision**: All ids of the frontend `DOMAIN_REGISTRY`, mirrored as `MAINTENANCE_DOMAIN_IDS` in
  `@vaultfolio/api-contract`. A unit test asserts both lists are equal.
- **Rationale**: Backend enforcement applies where routes exist; frontend-only domains
  (`haushaltsplaner`, `klaro`) still show the notice and tile state in the UI. Validating the id
  server-side prevents junk rows.

## D5 - How the frontend learns the state

- **Decision**: `GET /domains/maintenance` returns the ids currently in maintenance for any signed-in
  user; an app-level `DomainMaintenanceStore` loads it with the session on page load. No polling or
  push (FR-013). A 503 `DOMAIN_MAINTENANCE` response triggers a store refresh.
- **Rationale**: Keeps `SessionUser`/auth contract unchanged and the response tiny. Maintenance is
  not a secret, only the admin tab data (actor, timestamp) is admin-only.
- **Alternatives**: Add the list to `SessionUser` (touches every auth fixture and test builder).

## D6 - Rendering the notice on a domain page

- **Decision**: A route wrapper component `DomainMaintenanceGateComponent` (data: `domainId`) around
  the child router outlet. Member in maintenance: shared `MaintenanceNoticeComponent`. Admin: banner
  plus the outlet. Otherwise: outlet only.
- **Rationale**: One place for all domains instead of editing every domain component; routes and
  lazy loading stay untouched.

## D7 - Dashboard tile

- **Decision**: The dashboard host decides per widget: member and in maintenance renders
  `MaintenanceTileComponent` instead of the domain widget (the widget is not loaded, so it makes no
  API calls that would fail); admin renders the widget plus a badge.
- **Rationale**: Mirrors the empty-tile approach, and avoids 503 noise from widgets.

## D8 - Reminder catch-up

- **Decision**: `InsurancesReminderService.sweep` returns early while the `insurances` domain is in
  maintenance. No new state.
- **Rationale**: A reminder row is claimed only on send, and `dueDeadline` keeps returning the
  deadline while `0 <= daysLeft <= leadDays`. The first sweep after maintenance (hourly) therefore
  sends skipped reminders exactly once (the `(contract_id, deadline_date)` key dedups), and past
  deadlines are never sent. Matches FR-014/FR-015 exactly.
- **Alternatives**: A separate "missed reminders" queue (more state, same result).

## D9 - Other background jobs

- **Decision**: Out of scope (spec Assumptions). Retention sweeps and signup expiry are not
  domain-data jobs; market-data refresh is not user-facing.
