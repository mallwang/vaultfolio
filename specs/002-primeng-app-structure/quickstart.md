# Quickstart: PrimeNG UI Foundation & Application Structure

**Feature**: [spec.md](./spec.md) | **Contract**: [contracts/application-areas.md](./contracts/application-areas.md)

Validates the feature end-to-end against the spec's Acceptance Scenarios and Success Criteria.

## Prerequisites

- Dependencies installed at the repo root: `npm install` (adds `primeng`, `@primeuix/themes`,
  `primeicons` to `apps/frontend` per [research.md](./research.md)).
- Backend running (for the relocated health-status check under Settings):
  `docker compose up` or `npm exec nx serve backend`, per the existing project README.

## Run the app

```bash
npm exec nx serve frontend
```

Open the printed local URL (default `http://localhost:4200`).

## Validation scenarios

1. **Consistent look and feel (User Story 1 / SC-002)**
   - Load the app; confirm buttons, nav, and any inputs render with PrimeNG/Aura styling (rounded
     buttons, styled focus rings) — no unstyled native `<button>`/`<select>` elements visible.

2. **Navigation shell present and functional (User Story 2 / SC-001, SC-004)**
   - Confirm a sidebar (desktop width) lists all four areas: Dashboard, Holdings, Imports,
     Settings.
   - Click each nav entry; confirm only the content region changes, the shell persists, and the
     clicked entry shows an active indicator (`aria-current="page"`).
   - Resize the viewport to a phone width (~375px); confirm the sidebar collapses into a
     horizontally scrollable top bar with all four areas still reachable (FR-009).

3. **Not-found handling (Acceptance Scenario 3, User Story 2 / FR-006)**
   - Navigate to a nonexistent path (e.g. `/nope`); confirm a "not found" state renders inside the
     shell (sidebar/header still visible), with a way back to Dashboard.

4. **Placeholder areas (FR-005)**
   - Visit Dashboard, Holdings, and Imports; confirm each renders a clear "coming soon"/empty
     state via PrimeNG components, not a blank page or error.

5. **Health-status relocation, zero regression (FR-007 / SC-005)**
   - Visit Settings; confirm the health-status section shows the same
     healthy/unhealthy-per-check output it did before this feature (compare against the previous
     standalone `/health-status` behavior, e.g. via `git show` on the pre-move component or a
     manual pre-change smoke check).

6. **New-area extensibility (User Story 3 / SC-003)**
   - Following only `contracts/application-areas.md` and `apps/frontend/README.md`, add one new
     placeholder area; time the change. Confirm it appears in nav, is reachable, and matches
     existing styling with no extra CSS — target: under 30 minutes.

## Automated checks

```bash
npm exec nx lint frontend
npm exec nx test frontend
```

No new contract/integration tests are required beyond the frontend's existing unit-test
conventions — this feature introduces no backend contract or shared schema change (Principle IV
applies to service/library contracts, not this UI-only shell).
