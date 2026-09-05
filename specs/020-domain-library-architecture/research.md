# Research: Domain Library Architecture

**Feature**: 020-domain-library-architecture | **Date**: 2026-09-05

All items below resolve assumptions/unknowns from the spec and Technical Context. No item is left as NEEDS CLARIFICATION.

## 1. Where do frontend domain libraries live, relative to the existing `libs/domain/*`?

- **Decision**: New frontend feature libraries live under `libs/frontend/domain/<name>` (e.g.
  `libs/frontend/domain/holdings`), a sibling tree to the existing `libs/domain/<name>` backend
  finance-logic libraries — not inside them.
- **Rationale**: `libs/domain/*` already exists and is tagged `scope:domain` under the constitution's
  Stack Decision — it holds framework-independent backend finance logic (Principle I), consumed only
  by `scope:backend`. The new frontend "domain" concept from this spec (feature code: components,
  routes, an Angular service) is a different axis entirely (UI/routing, not calculation logic) and
  must never be reachable from the backend. Reusing the same `libs/domain/<name>` folder for both
  would conflate two unrelated boundary systems under one name and force one npm package to carry
  both an Angular dependency and a `scope:domain` tag that the backend rule already assumes is
  framework-free.
- **Alternatives considered**:
  - Reuse `libs/domain/holdings` for both backend logic and frontend feature code — rejected: mixes
    Angular into a library the backend depends on, and collapses two independent boundary concerns
    (backend calculation isolation vs. frontend feature isolation) into one tag.
  - `apps/frontend/src/app/<domain>` (status quo, just reorganized folders) — rejected: an Nx
    `depConstraints` boundary is only enforceable between _projects_ (libraries/apps), not between
    folders inside one project; this is exactly the "discipline only" problem User Story 1 exists to
    fix.

## 2. How is "cannot import another domain's internal files" mechanically enforced?

- **Decision**: Two changes to the existing `@nx/enforce-module-boundaries` config
  ([eslint.config.mjs](eslint.config.mjs)), plus the workspace's existing "public API via
  `package.json` `exports`" convention (already used by every `libs/domain/*` and `libs/api-contract`
  package):
  1. A new `scope:frontend-domain` tag for frontend domain libraries, with the `depConstraints` rule
     `onlyDependOnLibsWithTags: ['scope:shared']` — **deliberately omitting** `scope:frontend-domain`
     itself, so no frontend domain library may depend on any other frontend domain library, ever
     (Edge Case: shared code must live in a `scope:shared` library instead).
  2. The existing `scope:frontend` rule gains `scope:frontend-domain` as an allowed target
     (`onlyDependOnLibsWithTags: ['scope:shared', 'scope:frontend-domain']`), so the app-shell may
     depend on a domain's published entry point.
  3. Each domain library's `package.json` declares `"exports"` with only `"."` (→ `src/index.ts`) and
     `"./package.json"`, matching the existing `libs/domain/*` pattern. Combined with
     `moduleResolution: "bundler"` + `customConditions` in `tsconfig.base.json`, TypeScript refuses to
     resolve a deep/relative import into another package's internals — this is what makes "internal
     file" (not just "internal folder") unreachable, not the eslint rule alone.
  - Together: cross-domain deep imports fail at the TypeScript/module-resolution level (any domain,
    even before a second one exists) and cross-domain _any_ import (even of another domain's public
    entry point) fails at lint time via `depConstraints` — satisfying Acceptance Scenario 1 for both
    "internal file" and "any file" cases, while Acceptance Scenario 2 (intra-domain imports) is
    untouched because those files resolve entirely inside one project.
- **Alternatives considered**:
  - Per-domain tags (`domain:holdings`, `domain:retirement`, …) with a rule per domain — rejected as
    unnecessary: since no cross-domain dependency is ever legitimate (per the spec's own Edge Case),
    a single blanket rule that excludes `scope:frontend-domain` from its own allow-list is simpler,
    requires zero new lines of config per future domain (FR-011), and needs no generator/codegen step
    to keep the per-domain rule list in sync.
  - Nx's `sourceTag`-per-project-name matching (rather than a shared type tag) — rejected: would
    require one bespoke `depConstraints` entry per domain, which is exactly the "changes to holdings'
    code/tests" cost FR-011 rules out for future domains (it would in fact require touching the
    _shell's shared config_, not holdings itself, but still doesn't scale as cleanly as one shared
    rule).

## 3. How does FR-003 map this onto the existing CI boundary check?

- **Decision**: No new CI step. The new `depConstraints` entries live in the same
  `eslint.config.mjs` `@nx/enforce-module-boundaries` block already linted by the existing `lint`
  target on every project (run via `nx affected -t lint` / `nx run-many -t lint` in CI per
  CLAUDE.md), so a violation fails the same job that already fails on a `scope:*` violation today.
- **Rationale**: Directly satisfies FR-003 ("the same continuous-integration step") with zero new
  moving parts (Principle V, YAGNI).
- **Alternatives considered**: A dedicated `nx graph`/custom script CI job — rejected, redundant with
  the existing lint-based enforcement and adds a second place boundary rules could drift out of sync.

## 4. Where does the shared domain-entitlement mechanism (FR-004) live, and what shape does it have?

- **Decision**: A new library, `libs/frontend/domain-access`, tagged `scope:shared` (not
  `scope:frontend-domain` — it must be a legal dependency _of_ every frontend domain library and of
  the shell, which the `scope:frontend-domain` rule above forbids for anything but `scope:shared`).
  It exports:
  - `DOMAIN_REGISTRY`: a static list of `{ id, labelKey, path, icon }` entries — one per domain that
    exists in the codebase (today: just `holdings`) — extending the existing `ApplicationArea` idea
    ([application-areas.ts](apps/frontend/src/app/core/layout/application-areas.ts)) with a
    domain identity.
  - `isDomainEntitled(user: SessionUser | null, domainId: string): boolean` — the one place FR-004/
    SC-003 requires: `true` for `role === 'ADMIN'` (FR-008) or when `domainId` appears in
    `user.domainScopes`.
  - `domainGuard(domainId: string): CanActivateFn` — a guard _factory_ (mirrors the existing
    `adminGuard`/`authGuard` functional-guard pattern) built on top of `isDomainEntitled`, so a
    domain's route wires up its own guard with one line (`canActivate: [domainGuard('holdings')]`)
    without a domain library needing to depend on anything beyond `scope:shared`.
- **Rationale**: One library, one function used by both the route guard and the nav filter, satisfies
  SC-003 ("exactly one shared mechanism") directly. Building it as an Angular-aware library tagged
  `scope:shared` is consistent with the workspace's existing use of that tag for cross-tier-callable
  code (`libs/api-contract` is depended on by both `scope:frontend` and `scope:backend` today) — the
  tag expresses "who may depend on this," not "this is framework-free."
- **Alternatives considered**:
  - Inlining the check into `app-sidebar.component.ts` and `auth.guard.ts` directly (status quo
    pattern for the admin-only check) — rejected: this is precisely the "domain-specific access
    conditionals scattered through the app" SC-003 forbids as domains multiply.
  - A backend-computed "visible areas" API response — rejected as unnecessary indirection: the
    frontend already holds the full `SessionUser` (including role) at bootstrap; computing entitlement
    client-side from `domainScopes` needs no extra request, and the backend still independently
    enforces access via the same `domainScopes` column when the API layer needs it later.

## 5. How does the user/session model represent domain entitlements (FR-007)?

- **Decision**: Add a nullable `domain_scopes TEXT` column to the existing `users` table (a JSON
  array of domain ids, e.g. `["holdings"]`), added directly to the single `CREATE TABLE users`
  statement in [database.service.ts](apps/backend/src/database/database.service.ts) (per the
  workspace's now-collapsed single-init-script convention — no incremental migration file). Existing
  rows get a default of `'["holdings"]'` so every current user's access is unchanged (US2, FR-009).
  `SessionUser` ([auth.ts](libs/api-contract/src/lib/auth.ts)) gains `domainScopes: string[]`,
  populated by `AuthService` alongside `role` wherever a `SessionUser` is already assembled
  (sign-in, session bootstrap).
- **Rationale**: Directly satisfies FR-007 ("extend... without altering... Administrator/member
  distinction") — `role` is untouched, `domain_scopes` is additive. Matches the existing storage
  convention (`TEXT` columns, JSON-encoded lists are already used elsewhere in this schema, e.g.
  `SUPPORTED_LANGUAGES`-style enums) and the recent decision (462794d) to keep one authoritative
  init script rather than incremental migrations.
- **Alternatives considered**: A separate `user_domain_scopes` join table — rejected as
  over-engineering (YAGNI) for a handful of domain ids per user with no need for relational queries
  across it; a JSON column is simpler and matches Principle V.

## 6. How does an admin actually grant/revoke a domain scope, to make US3's test meaningful?

- **Decision**: Extend the existing admin Accounts screen
  ([accounts.component.ts](apps/frontend/src/app/admin/accounts/accounts.component.ts)) and its
  backend counterpart (`PATCH /accounts/:id/role` sibling route,
  [accounts.controller.ts](apps/backend/src/accounts/accounts.controller.ts)) with a parallel
  `PATCH /accounts/:id/domain-scopes` endpoint and a small multi-select control driven by
  `DOMAIN_REGISTRY`, reusing the same `@Roles('ADMIN')`-guarded controller and `AccountSummary` DTO
  (extended with `domainScopes: string[]`).
- **Rationale**: US3's independent test ("changing a test user's domain access") needs a real,
  product-level way to change it, not just a database edit — and the Accounts screen is already the
  existing place role changes are made, so extending it (rather than building a new
  domain-entitlements admin page) keeps this additive and minimal (Principle V), while staying
  consistent with FR-004's "one shared mechanism" (the new endpoint writes the same `domain_scopes`
  column the guard and nav both read via `isDomainEntitled`).
- **Alternatives considered**: A dedicated "Domain Access" admin page — rejected as scope creep for a
  feature with exactly one domain to manage today; revisit if/when a future domain spec needs
  per-domain admin workflows beyond a checkbox list.
