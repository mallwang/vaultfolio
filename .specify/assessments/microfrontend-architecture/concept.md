# Concept: Structuring Vaultfolio for a multi-domain product pivot

- **Slug**: microfrontend-architecture
- **Created**: 2026-09-05
- **Recommended option**: Option B — Nx domain libraries with enforced boundaries + scoped entitlements

## Options

### Option A — Lazy-loaded route modules only (status quo, formalized)

- **Sketch**: Keep one Angular application and one deployable. Each new domain (retirement, insurances, household planner, historic wealth development, account overview) becomes a lazy-loaded route tree under the existing `/app` shell (spec 009), same as all 19 specs shipped to date. The only change from today's practice: replace the binary Administrator/member check with a small per-route "can this user see this domain" guard, backed by a new scope/entitlement field on the user record, so gating stops being a single side-nav conditional and becomes a declared property of each route.
- **Appetite**: small (days–low weeks)
- **Trade-offs**: Wins — zero new tooling, zero new deploy pipeline, reuses everything the team already operates and understands; lowest risk to ship the first domain fast. Sacrifices — nothing stops a new domain's code from quietly importing another domain's services/components directly (no enforced boundary), so coupling risk is only reduced by discipline, not by the structure itself; six domains in over time with no guardrail could still tangle exactly as the problem statement fears.
- **Rabbit holes**: The entitlement field's shape (single scope enum vs. list of domain flags) can balloon if not capped up front; resist designing a general-purpose permissions engine for what is, today, six known domains.

### Option B — Nx domain libraries with enforced boundaries + scoped entitlements

- **Sketch**: Same single deployable and lazy-loaded routing as Option A, but each domain is scaffolded as its own Nx library (or small set of libs: `feature`, `data-access`, `ui`) with Nx module-boundary tags that make cross-domain imports a lint failure, not just a convention. A small shared `entitlements` lib exposes "does this user have access to domain X" (backed by the existing role system, extended with a scope field), consumed by route guards and nav rendering alike, so gating logic lives in one place instead of scattered conditionals. Holdings itself is gradually re-homed into this same structure as the first "domain," proving the pattern before the other five follow it.
- **Appetite**: medium (a small number of weeks: mostly for the first domain + retrofitting holdings; each subsequent domain is fast once the pattern exists)
- **Trade-offs**: Wins — directly answers both stated goals (coupling controlled by tooling, not discipline; gating centralized and extensible to finer scopes later) without adopting a deployment/runtime model the team has never operated. Nx boundary tags are already the workspace's own convention (per CLAUDE.md's Nx guidance), so this extends an existing practice rather than inventing one. Sacrifices — still one build/deploy artifact, so this does not give independent deploy cadences per domain (explicitly a non-goal today) or independent runtime composition; if a future hosted/multi-tenant/billing-gated offering does materialize, some of this may need revisiting (though the entitlements seam makes that revisit smaller, not bigger).
- **Rabbit holes**: Retrofitting "holdings" out of the current monolithic structure into the new library shape is the part most likely to balloon — scope it as "boundary + entitlement check only," not a rewrite of holdings' internals. Deciding the exact lib-per-domain split (feature/data-access/ui vs. a single lib per domain) can also consume unbounded design time; pick the simplest split that satisfies boundary lint and move on.

### Option C — Module Federation (the originally proposed approach)

- **Sketch**: Split each domain into an independently built and independently deployable Angular application (an Nx `remote`), composed at runtime into a shell `host` application via Webpack Module Federation, using `@nx/angular`'s host/remote generators already available in the workspace's toolchain. The host would decide which remotes to fetch/mount per user based on role/scope (and, speculatively, future billing data).
- **Appetite**: large (months, plus ongoing operational cost thereafter)
- **Trade-offs**: Wins — the only option that delivers true independent deploy cadences per domain and matches the letter of the original idea. Sacrifices — the research is unambiguous that the two conditions that normally justify this pattern (multiple independent teams, deploy-cadence conflicts) are explicitly absent and are a stated non-goal; it adds shared-dependency version negotiation, remote versioning, cross-remote testing/debugging, and bundle-duplication risk the team has zero operating experience with; and it requires reworking today's single static-build → single nginx container NAS deployment to host multiple independently-versioned remotes — friction the research flags as hardest to justify in exactly this self-hosted deployment context. It also does nothing for the cross-domain data-aggregation need (account overview, historic wealth development) that several planned domains have — Module Federation composes UI, not data.
- **Rabbit holes**: Shared Angular/RxJS/PrimeNG dependency version skew between host and remotes; CI/CD and versioned-artifact hosting for remotes on a NAS-style single-container deployment; cross-remote E2E testing; and the temptation to also solve cross-domain data aggregation as part of "the architecture," which is explicitly out of scope.

## Recommendation

**Option B.** It is the only option that satisfies both stated goals — bounded coupling as domains grow, and centralized/extensible access gating — without requiring the team to take on an operational model (independent deploy pipelines, runtime remote composition) that the problem statement's own non-goals and the research's evidence say isn't needed today. Option A under-delivers on the coupling goal (no enforcement, just convention); Option C over-delivers on a deploy-independence dimension nobody asked for, at a cost (self-hosted NAS deployment rework, zero prior operating experience, months of appetite) the evidence says isn't justified by current team scale or deployment model. Option B also keeps the door open: if a hosted/multi-tenant, billing-gated, or multi-team future actually arrives, the entitlements seam and enforced domain boundaries it establishes make a later move toward Option C strictly easier, not wasted work.

## Out of Scope (for the recommended option)

- Independent deploy cadences or independently versioned/deployed domain bundles (inherited non-goal; not a goal of Option B either).
- Any billing/subscription system or billing-based gating — the entitlements seam is scope-based only; billing is not designed here.
- Cross-domain data aggregation/API design (e.g., a combined net-worth view spanning holdings, banking, and insurance data) — a separate data-architecture problem.
- Deciding which of the five new domains ships first, or whether they ship together or incrementally — that is a roadmap/sequencing decision for specification, not architecture.
- Retrofitting holdings' internal implementation beyond what's needed to sit inside a domain library boundary with an entitlement check.

## Assumptions to Validate

- Nx module-boundary tags (`@nx/enforce-module-boundaries`) can express "domain libraries may not import each other's internals" cleanly in this workspace's existing project structure — not verified this session.
- Extending the current binary Administrator/member role with a scope field is acceptable as an incremental change to the existing auth/session model (spec 005) rather than requiring a broader auth redesign.
- All six domains can, in fact, be built by extending Angular's own lazy-loading + Nx boundaries without a runtime composition mechanism — i.e., nothing about the six domains' actual requirements demands independently deployable bundles.

## Resolved (2026-09-05)

- **No hosted/multi-tenant offering is being considered** — Vaultfolio stays self-hosted/single-household. Billing-based gating remains speculative and stays out of scope; this removes the strongest lever that could have pulled toward Option C.
- **No near-term plan to add additional teams/contributors** — "single team owns all domains" holds for the foreseeable future, confirming independent deploy cadences remain a non-goal.

Both confirmations remove the two conditions that would have most strengthened Option C's case, reinforcing the Option B recommendation as-is — no change to the recommendation.

## Appendix: Option B illustrated — Nx library layout & module boundaries

This appendix elaborates the recommended option's mechanics at a concrete level (still concept-level illustration, not a locked design — final shape belongs to `/speckit-specify`).

### Today's baseline

- `libs/domain/*` (`auth`, `holdings`, `invitations`, `example`) already exist, but hold pure shared model/validation logic consumed by **both** backend and frontend (e.g. [holding.ts](libs/domain/holdings/src/lib/holding.ts), [holding-validation.ts](libs/domain/holdings/src/lib/holding-validation.ts)) — not Angular feature code.
- All Angular feature code lives inline under `apps/frontend/src/app/*` (`holdings/`, `admin/`, `settings/`, …), lazy-loaded via `loadComponent`/routes in [app.routes.ts](apps/frontend/src/app/app.routes.ts).
- [eslint.config.mjs](eslint.config.mjs) already enforces a 4-tag `scope:*` boundary scheme (`frontend` / `backend` / `domain` / `shared`) via `@nx/enforce-module-boundaries`, running in CI through every project's `lint` target — but nothing today enforces boundaries _between_ domains or _within_ the frontend app, because there's only one frontend "thing" so far.

### Proposed tag scheme

Add a second, orthogonal tag dimension — `domain:<name>` — alongside the existing `scope:*` tags:

```
scope:frontend + domain:holdings
scope:frontend + domain:retirement
scope:frontend + domain:insurances
scope:frontend + domain:household
scope:frontend + domain:wealth-history
scope:frontend + domain:account-overview
scope:frontend + domain:shell          ← app-shell, nav, routing composition
scope:shared    + domain:entitlements  ← new: role/scope gating, shared by all domains + shell
```

New `depConstraints` in `eslint.config.mjs`, one block per domain plus the shell:

```js
{
  sourceTag: 'domain:holdings',
  onlyDependOnLibsWithTags: ['domain:holdings', 'domain:entitlements', 'scope:shared'],
},
{
  sourceTag: 'domain:retirement',
  onlyDependOnLibsWithTags: ['domain:retirement', 'domain:entitlements', 'scope:shared'],
},
// ...one block per domain, same shape...
{
  sourceTag: 'domain:shell',
  onlyDependOnLibsWithTags: ['domain:entitlements', 'scope:shared'], // shell never imports a domain's internals directly — only routes to it
},
```

This is what turns "a new domain can't tangle with another domain's code" into a lint failure instead of a hope — reusing the exact mechanism (`@nx/enforce-module-boundaries`) already governing `scope:*` today.

### Library layout per domain

Each new domain gets 2–3 libs under a new `libs/frontend/<domain>/` grouping folder (parallel to today's `libs/domain/`):

```
libs/frontend/retirement/
  feature/       # smart components, routes, route guards — the only thing app.routes.ts imports
  data-access/   # HTTP services, state, calls into libs/api-contract's retirement contract
  ui/            # dumb/presentational components, optional — only if reused within the domain
```

`holdings` migrates into the equivalent shape (`libs/frontend/holdings/feature|data-access|ui`), pulling code out of `apps/frontend/src/app/holdings/*` — proving the pattern rather than inventing a second one for holdings alone (per the "Retrofitting holdings" rabbit hole above).

`apps/frontend` itself shrinks to: app-shell (nav, layout — already `core/layout`, spec 009), root routing, auth/session bootstrap, and the composition root that wires domain `feature` libs into routes. It becomes tagged `domain:shell`.

### The entitlements seam

New `libs/frontend/entitlements/` (`scope:shared`, `domain:entitlements`):

```ts
// one place, not scattered conditionals
export function canAccessDomain(user: SessionUser, domain: DomainKey): boolean;
```

Backed by the existing binary role (spec 005), extended with a `scopes: DomainKey[]`-style field on the user/session record. Two consumers:

1. **Route guards** — each domain's `feature` lib exports its own guard (`retirementAccessGuard`) calling `canAccessDomain`, applied in `app.routes.ts` alongside `authGuard`/`adminGuard` the same way today.
2. **Nav rendering** — the app-shell's side-nav (spec 009) filters its menu items through the same function, so "can see the route" and "can see the nav entry" can't drift apart.

### Route composition

Same lazy-loading style already in use in [app.routes.ts](apps/frontend/src/app/app.routes.ts), pointed at libs instead of local folders, with the entitlement guard added per domain:

```ts
{
  path: 'retirement',
  canActivate: [authGuard, domainGuard('retirement')],
  loadChildren: () => import('@vaultfolio/frontend-retirement-feature').then(m => m.RETIREMENT_ROUTES),
},
```

### Net effect vs. Option C

Same single `apps/frontend` build, same nginx/NAS deploy — nothing in [docker/frontend.Dockerfile](docker/frontend.Dockerfile) changes. What's new is purely at the Nx-graph level: per-domain `feature`/`data-access`/`ui` libs, a `domain:*` tag, a lint rule, and one shared `entitlements` lib both routing and nav read from. The actual per-domain UI/data work is what `/speckit-specify` scopes out domain by domain.
