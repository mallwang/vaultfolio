# Contract: Placeholder Domain Library (per new domain)

Applies identically to all five new libraries — `frontend-domain-retirement`,
`frontend-domain-insurances`, `frontend-domain-haushaltsplaner`,
`frontend-domain-historic-wealth-development`, `frontend-domain-account-overview` — mirroring the
existing `frontend-domain-holdings` library's contract, minimized to what a placeholder needs.

## Project shape

- Nx project name: `@vaultfolio/frontend-domain-<id>` (research.md #1).
- `project.json` tags: `["scope:frontend-domain"]` — identical to `frontend-domain-holdings`, so
  the existing ESLint boundary rule (`scope:frontend-domain` → only `scope:shared`) applies with no
  new rule needed.
- `package.json`: same shape as `libs/frontend/domain/holdings/package.json` (module type, no
  runtime `dependencies` beyond what's inherited from the workspace's Angular/PrimeNG setup),
  `name` set to the library's package name.
- Public API (`src/index.ts`): exports exactly one component.

## Public API

```ts
// src/index.ts
export { <Domain>PlaceholderComponent } from './lib/<domain>-placeholder/<domain>-placeholder.component.js';
```

Where `<Domain>PlaceholderComponent` is a standalone Angular component (e.g.
`RetirementPlaceholderComponent`). No other symbol is exported — a placeholder has no service,
model, or additional component to publish.

## Component contract

- Standalone Angular component, no route logic of its own (routing/guarding is the app-shell's
  responsibility per `app.routes.ts`, exactly as for Holdings' own route).
- Renders, at minimum: the domain's display name (matching its `DOMAIN_REGISTRY` entry's label) and
  a statement that the domain's functionality is not yet available (FR-003).
- Takes no `@Input()`s and depends on no backend endpoint — a placeholder needs no data (research.md #4).
- Only dependency allowed by the `scope:frontend-domain` boundary rule: `scope:shared` libraries
  (e.g. `@vaultfolio/frontend-shared-ui` for the translate pipe / shared empty-state presentational
  pattern, if reused).

## Consumers

- `app.routes.ts` lazy-loads the component via `loadComponent: () => import('@vaultfolio/frontend-domain-<id>').then(m => m.<Domain>PlaceholderComponent)`,
  guarded by `domainGuard('<id>')`, exactly like Holdings' main route.
- No other project imports these libraries (they contribute no Dashboard widget or Settings tab —
  FR-005).
