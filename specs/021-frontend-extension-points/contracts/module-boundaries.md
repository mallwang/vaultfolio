# Contract: Nx Module Boundaries — Admin Module (delta on 020)

**Enforced by**: `@nx/enforce-module-boundaries` in [eslint.config.mjs](../../../eslint.config.mjs).

This extends 020's [module-boundaries.md](../../020-domain-library-architecture/contracts/module-boundaries.md)
contract, which remains otherwise unchanged (the `scope:frontend-domain`/`scope:shared`/
`scope:domain`/`scope:backend` tags and their rules from 020 are untouched by this feature). Only
the additions below are new.

## Tags (new row)

| Tag                    | Applied to                                                          |
| ---------------------- | ------------------------------------------------------------------- |
| `scope:frontend-admin` | `libs/frontend/admin` (NEW) — the relocated Admin/Verwaltung module |

Deliberately **not** `scope:frontend-domain`: Admin is role-gated back-office code, not a product
domain a user opts into (FR-013), and giving it a distinct tag stops it from being structurally
indistinguishable from one (research.md #6) — it must never be eligible for `DOMAIN_REGISTRY`,
`DASHBOARD_WIDGET_CONTRIBUTIONS`, or `SETTINGS_TAB_CONTRIBUTIONS` in a way a lint rule would accept.

## `depConstraints` (additions in **bold**, rest unchanged from 020)

```js
depConstraints: [
  {
    sourceTag: 'scope:frontend',
    onlyDependOnLibsWithTags: [
      'scope:shared',
      'scope:frontend-domain',
      /* NEW */ 'scope:frontend-admin',
    ],
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
  {
    sourceTag: 'scope:frontend-domain',
    onlyDependOnLibsWithTags: ['scope:shared'],
  },
  /* NEW */
  {
    sourceTag: 'scope:frontend-admin',
    onlyDependOnLibsWithTags: ['scope:shared'],
  },
],
```

## Guarantees this addition provides

1. **Admin can never depend on a product-domain library, or vice versa** —
   `scope:frontend-admin`'s allow-list contains only `scope:shared`, and no other tag's allow-list
   includes `scope:frontend-admin` except `scope:frontend` — mirroring exactly how
   `scope:frontend-domain` was isolated in 020, giving Admin the same guarantee (FR-012).
2. **The app-shell may depend on Admin's published entry point** — `scope:frontend` gains
   `scope:frontend-admin`, the same way it already depends on `scope:frontend-domain` libraries, so
   `app.routes.ts` can lazy-load `@vaultfolio/frontend-admin` (Acceptance Scenario 1, US4).
3. **`libs/frontend/admin`'s package.json restricts `"exports"`** to `"."` and `"./package.json"`
   only (same convention as every other `libs/frontend/*` package) — deep/internal imports are
   unresolvable, not just linted against.

## Verification

- `npx nx run-many -t lint` fails with an `@nx/enforce-module-boundaries` error if `libs/frontend/admin`
  is ever imported from a `scope:frontend-domain` library, or vice versa.
- Manual check (US4's Independent Test): inspect `libs/frontend/admin`'s `package.json` `nx.tags` and
  confirm it is `scope:frontend-admin`, distinct from every `libs/frontend/domain/*` library's
  `scope:frontend-domain`.
