# Contract: Registry Additions

The four existing, shared registries/allow-lists this feature touches, and exactly what each new
domain adds to it. Each is additive-only — no existing entry's shape or value changes.

## 1. `DOMAIN_REGISTRY` (`libs/frontend/domain-access/src/lib/domain-registry.ts`)

Adds five `DomainDescriptor` entries (shape unchanged, per data-model.md), appended after
`holdings`, in the order from research.md #3:

```ts
export const DOMAIN_REGISTRY: DomainDescriptor[] = [
  { id: 'holdings', labelKey: 'nav.holdings', path: 'holdings', icon: 'briefcase' },
  { id: 'retirement', labelKey: 'nav.retirement', path: 'retirement', icon: 'elderly' },
  { id: 'insurances', labelKey: 'nav.insurances', path: 'insurances', icon: 'shield' },
  {
    id: 'haushaltsplaner',
    labelKey: 'nav.haushaltsplaner',
    path: 'haushaltsplaner',
    icon: 'receipt-long',
  },
  {
    id: 'historic-wealth-development',
    labelKey: 'nav.historicWealthDevelopment',
    path: 'historic-wealth-development',
    icon: 'trending-up',
  },
  {
    id: 'account-overview',
    labelKey: 'nav.accountOverview',
    path: 'account-overview',
    icon: 'account-balance',
  },
];
```

Consumers unaffected by shape (`domainGuard`, `isDomainEntitled`, the admin accounts screen's
domain-scope checkboxes) automatically pick up the five new entries with no code change — this is
the mechanism SC-001 ("zero code changes ... beyond registering the new domain itself") depends on.

## 2. `APPLICATION_AREAS` (`apps/frontend/src/app/core/layout/application-areas.ts`)

Adds five `ApplicationArea` entries (shape unchanged), each with `domainId` set to the matching new
domain id, inserted after the existing `holdings` area and before `settings`:

```ts
{ id: 'retirement', label: 'Retirement', path: 'retirement', icon: 'elderly', domainId: 'retirement' },
{ id: 'insurances', label: 'Insurances', path: 'insurances', icon: 'shield', domainId: 'insurances' },
{ id: 'haushaltsplaner', label: 'Haushaltsplaner', path: 'haushaltsplaner', icon: 'receipt-long', domainId: 'haushaltsplaner' },
{ id: 'historic-wealth-development', label: 'Historic Wealth Development', path: 'historic-wealth-development', icon: 'trending-up', domainId: 'historic-wealth-development' },
{ id: 'account-overview', label: 'Account Overview', path: 'account-overview', icon: 'account-balance', domainId: 'account-overview' },
```

(`label` here may be swapped for a translate-pipe call if the surrounding sidebar component already
renders `ApplicationArea.label` through the translate pipe — follow whatever `holdings`'s existing
entry does today; the value shown is unaffected either way.)

The sidebar/mobile-nav rendering logic (already filtering `APPLICATION_AREAS` by `roles` and
`domainId` per 020) requires no change — it already calls `isDomainEntitled` per-area.

## 3. `app.routes.ts` route table (`apps/frontend/src/app/app.routes.ts`)

Adds five sibling route objects to the `app` parent route's `children`, alongside the existing
`holdings` block, each following Holdings' own top-level route shape minus the `imports` child tab
(a placeholder has no sub-tabs):

```ts
{
  path: 'retirement',
  title: 'Retirement',
  canActivate: [domainGuard('retirement')],
  loadComponent: () =>
    import('@vaultfolio/frontend-domain-retirement').then((m) => m.RetirementPlaceholderComponent),
},
// ...one such block per remaining domain, same shape, id/title/import swapped
```

No change to any existing route object (`holdings`, `dashboard`, `settings`, `admin`, redirects).

## 4. `KNOWN_DOMAIN_IDS` (`apps/backend/src/accounts/accounts.service.ts`)

Adds the five new ids to the existing `Set`, kept as the single source of truth's backend mirror
(per its own existing comment):

```ts
const KNOWN_DOMAIN_IDS: ReadonlySet<string> = new Set([
  'holdings',
  'retirement',
  'insurances',
  'haushaltsplaner',
  'historic-wealth-development',
  'account-overview',
]);
```

This is the only backend change in this feature (FR-008): it makes
`PATCH /accounts/:id/domain-scopes` accept the five new ids instead of rejecting them as
`invalid_domain`. No controller, module, or route is added.

## Explicitly unchanged (no entry added)

- `DASHBOARD_WIDGET_CONTRIBUTIONS` (`apps/frontend/src/app/dashboard/dashboard-widgets.registry.ts`) — FR-005.
- `SETTINGS_TAB_CONTRIBUTIONS` (`apps/frontend/src/app/settings/settings-tabs.registry.ts`) — FR-005.
