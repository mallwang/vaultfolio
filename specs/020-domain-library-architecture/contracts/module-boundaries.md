# Contract: Nx Module Boundaries (Domain Isolation)

**Enforced by**: `@nx/enforce-module-boundaries` in [eslint.config.mjs](../../../eslint.config.mjs),
run by every project's existing `lint` target.

## Tags

| Tag                     | Applied to                                                                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scope:frontend-domain` | Every frontend domain library, e.g. `libs/frontend/domain/holdings` (NEW)                                                                            |
| `scope:frontend`        | `apps/frontend` (existing, unchanged)                                                                                                                |
| `scope:shared`          | `libs/api-contract`, `libs/market-data`, `libs/notifications`, and the new `libs/frontend/domain-access` (existing tag, one new library added to it) |
| `scope:backend`         | `apps/backend` (existing, unchanged)                                                                                                                 |
| `scope:domain`          | `libs/domain/*` — backend finance logic (existing, unchanged; unrelated to this feature)                                                             |

## `depConstraints` (additions in **bold**)

```js
depConstraints: [
  {
    sourceTag: 'scope:frontend',
    onlyDependOnLibsWithTags: ['scope:shared', /* NEW */ 'scope:frontend-domain'],
  },
  {
    sourceTag: 'scope:backend',
    onlyDependOnLibsWithTags: ['scope:shared', 'scope:domain'],
  },
  {
    sourceTag: 'scope:domain',
    onlyDependOnLibsWithTags: ['scope:domain', 'scope:shared'],
  },
  {
    sourceTag: 'scope:shared',
    onlyDependOnLibsWithTags: ['scope:shared'],
  },
  /* NEW */
  {
    sourceTag: 'scope:frontend-domain',
    onlyDependOnLibsWithTags: ['scope:shared'],
  },
],
```

## Guarantees this contract provides

1. **A frontend domain library can never depend on another frontend domain library** —
   `scope:frontend-domain`'s allow-list contains only `scope:shared`, deliberately excluding
   `scope:frontend-domain` itself. This is what makes User Story 1 / SC-001 hold for every future
   domain (FR-011) without a config change per new domain.
2. **The app-shell may depend on a domain's published entry point** — `scope:frontend` now also
   allows `scope:frontend-domain`, satisfying Acceptance Scenario 3 (US1).
3. **A domain's own internal files may freely import each other** — untouched by any
   `depConstraints` rule, since those imports never cross a project boundary (Acceptance Scenario 2,
   US1).
4. **Two domains sharing common code must put it in a `scope:shared` library** — the only tag both
   `scope:frontend-domain` and `scope:frontend` are allowed to depend on (Edge Case: shared helper).
5. **Deep/internal imports across any project boundary are unresolvable**, not just linted against —
   every library's `package.json` restricts `"exports"` to `"."` and `"./package.json"` (already the
   convention for `libs/domain/*` and `libs/api-contract`; the same convention is applied to
   `libs/frontend/domain/holdings` and `libs/frontend/domain-access`), so `moduleResolution:
"bundler"` refuses to resolve `@vaultfolio/frontend-domain-holdings/lib/internal-thing` even before
   lint runs.

## Verification

- `npx nx run-many -t lint` (already the CI-enforced target per FR-003) fails with an
  `@nx/enforce-module-boundaries` error if any of the above is violated — no new CI step.
- Manual check (per US1's Independent Test): add a second throwaway domain library, import a
  non-exported file from `libs/frontend/domain/holdings/src/lib/...` in it, run
  `npx nx lint <throwaway-domain>` — expect failure. Remove the throwaway library afterward.
