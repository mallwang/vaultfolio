# Implementation Plan: Notification Center

**Branch**: `043-notification-center` | **Date**: 2026-10-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/043-notification-center/spec.md`; approved layout in [design.md](./design.md)

## Summary

A frontend-only feature: a bell with a count badge in the authenticated header opens a panel (popover on desktop, modal on mobile) that lists the hints currently contributed by features, grouped by source, with hide/restore kept in the browser. Features contribute through a small contract in a new `scope:shared` library (`@vaultfolio/frontend-hints`) that also holds the pure logic (content signature, hidden-state reconciliation, ordering, badge count). The app shell owns the UI, the registry, and the entitlement and maintenance filtering. The first providers are Insurances (`InsurancesStore.gaps().redundant`) and Earnings (`GET /api/earnings/data-check`). No backend, API or database change.

## Technical Context

**Language/Version**: TypeScript (Angular ~22.1 frontend, Nx monorepo)

**Primary Dependencies**: Angular, PrimeNG ^22.1 (`p-popover`, `p-dialog`, `p-button`), existing `app-icon`/Material Symbols, existing i18n service. No new third-party dependency.

**Storage**: Browser `localStorage` only (per-user key for hidden state). No server storage.

**Testing**: Jest for the new pure library (same setup as `@vaultfolio/frontend-domain-access`); Vitest for Angular components/stores in `apps/frontend` and the domain libraries. Playwright verification via the `verify-ui` skill.

**Target Platform**: Modern evergreen browsers; desktop and mobile layouts.

**Project Type**: Frontend only (Nx monorepo); new shared lib + app-shell code + provider code in two domain libs.

**Performance Goals**: Panel opens instantly from already-held signals; providers add no request per navigation beyond what their domain store already does (refresh is throttled).

**Constraints**: The center never persists hint text, names or amounts; hidden state stores only ids, source and a content hash. A failing provider must not affect others or the shell.

**Scale/Scope**: A handful of providers, tens of hints per user at most.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle / rule                                    | Assessment                                                                                                                                                |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Library-First                                    | PASS. Contract and pure logic live in a new standalone lib `libs/frontend/hints`, tested without Angular. The shell only wires it.                        |
| II. API-First                                       | PASS / N/A. No new backend capability; providers use existing endpoints only.                                                                             |
| III. Test Coverage                                  | PASS. No monetary computation is added; findings are reused. Exact-value tests for signature, reconcile, ordering and badge logic.                        |
| IV. Integration Testing                             | PASS. Contract tests per provider (real store/service shapes, synthetic data) and a shell integration spec for registry, filtering and failure isolation. |
| V. Observability, Simplicity                        | PASS. No hint content is logged. Simplest mechanism that works: one registry, signals, localStorage. No server inbox.                                     |
| Sensitive Personal Data (log hygiene, minimization) | PASS. Hints are built in memory from data the user can already see; only a one-way hash and ids reach `localStorage`. No hint content is sent anywhere.   |
| Stack: Material Icons only                          | PASS. Adds `notifications` to the icon map; no PrimeIcons.                                                                                                |
| Stack: Frontend domain libraries / Nx tags          | PASS. New lib is `scope:shared`; domains depend on it only. Registry and UI live in the app shell. No domain imports another.                             |
| Stack: dashboard/settings contribution mechanism    | PASS. Same registry-in-shell, lazy-loaded contribution pattern as 021/042.                                                                                |

Re-check after Phase 1 design: no violations; Complexity Tracking not needed.

## Project Structure

### Documentation (this feature)

```text
specs/043-notification-center/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── design.md
├── mockup.html
├── contracts/
│   └── hint-provider.md
└── tasks.md             # created by /speckit-tasks
```

### Source Code (repository root)

```text
libs/frontend/hints/                          # NEW, scope:shared, jest
├── package.json  tsconfig*.json  jest.config.cts  .spec.swcrc
└── src/
    ├── index.ts
    └── lib/
        ├── hint.ts                           # Hint, HintSeverity, HintTarget
        ├── hint-provider.ts                  # HintProvider, HintProviderContribution
        ├── hint-signature.ts                 # stable content hash
        ├── hidden-state.ts                   # HiddenHintState, reconcile, purge, (de)serialize
        ├── hint-view.ts                      # partition, order, group, badge label
        └── hint-test-id.ts                   # id -> data-testid-safe string

apps/frontend/src/app/core/hints/             # NEW
├── hint-providers.registry.ts                # HINT_PROVIDER_CONTRIBUTIONS (lazy)
├── hints.store.ts                            # collect, filter, refresh, hide/restore
├── hints-storage.ts                          # per-user localStorage access (best effort)
├── hints-bell/                               # header trigger + badge
└── hints-panel/                              # list, groups, hidden section

apps/frontend/src/app/core/layout/app-header/ # bell added before the language select

libs/frontend/domain/insurances/src/lib/hints/   # InsurancesHintProvider
libs/frontend/domain/earnings/src/lib/hints/     # EarningsHintProvider
libs/frontend/shared-ui/src/lib/icon/icon-name.map.ts   # + 'notifications'
libs/frontend/shared-ui/src/lib/i18n/translations/      # hints.* (en/de), provider texts
```

**Structure Decision**: One new tiny shared library for the contract and pure logic (Library-First); UI and orchestration in the app shell next to the existing `core/maintenance` store; provider implementations inside the two domain libraries behind lazy registry entries. Feature 044 later adds its own registry entry; nothing in this plan changes for it.

## Complexity Tracking

No constitution violations.
