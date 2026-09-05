# Contract: Dashboard & Settings Extension Points

**Types**: `libs/frontend/domain-access` (`@vaultfolio/frontend-domain-access`, `scope:shared`)
**Registries**: `apps/frontend` (`scope:frontend`) — see research.md #1
**Rendering primitive**: `libs/frontend/shared-ui` (`@vaultfolio/frontend-shared-ui`, `scope:shared`)

This is the mechanism FR-001–FR-004 require: a domain library contributes a Dashboard widget and/or
a Settings tab, filtered by the same entitlement check already used for that domain's nav entry and
route guard (`isDomainEntitled`, `domainGuard` — 020), without `domain-access` ever importing a
domain library (FR-007).

## Public API additions (`libs/frontend/domain-access/src/index.ts`)

```ts
export interface DashboardWidgetContribution {
  domainId: string; // matches a DomainDescriptor.id
  loadComponent: () => Promise<Type<unknown>>; // dynamic import factory, never eager
}

export interface SettingsTabContribution {
  domainId: string;
  path: string; // router path segment under /app/settings
  labelKey: string; // i18n key for the tab label
  loadComponent: () => Promise<Type<unknown>>;
}
```

These are type-only additions — `domain-access` gains no new runtime export and no new dependency.

## Registries (`apps/frontend`, NEW files)

```ts
// apps/frontend/src/app/dashboard/dashboard-widgets.registry.ts
export const DASHBOARD_WIDGET_CONTRIBUTIONS: DashboardWidgetContribution[] = [
  {
    domainId: 'holdings',
    loadComponent: () =>
      import('@vaultfolio/frontend-domain-holdings').then((m) => m.HoldingsDistributionComponent),
  },
];
```

```ts
// apps/frontend/src/app/settings/settings-tabs.registry.ts
export const SETTINGS_TAB_CONTRIBUTIONS: SettingsTabContribution[] = [
  // Empty for this spec — no domain besides holdings is built here, and
  // holdings itself contributes only a dashboard widget (Assumptions).
  // A future domain adds one entry here; nothing else in this file changes.
];
```

Adding a domain's contribution = adding one entry to the relevant array (SC-001) — no change to
`DashboardComponent`'s/`SettingsComponent`'s own template or class logic, and no change to any other
domain's code (FR-003).

## Rendering (`libs/frontend/shared-ui`, NEW)

```ts
// DynamicOutletComponent — generic "await a loader, render the component" host.
@Component({
  selector: 'app-dynamic-outlet',
  template: `@if (type(); as t) {
    <ng-container [ngComponentOutlet]="t" />
  }`,
})
export class DynamicOutletComponent {
  loader = input.required<() => Promise<Type<unknown>>>();
  protected readonly type = /* resolves loader()() once, as a signal */;
}
```

`DashboardComponent` consumes it:

```html
@for (widget of visibleWidgets(); track widget.domainId) {
<app-dynamic-outlet [loader]="widget.loadComponent" />
}
```

```ts
protected readonly visibleWidgets = computed(() =>
  DASHBOARD_WIDGET_CONTRIBUTIONS.filter((w) => isDomainEntitled(this.currentUser(), w.domainId)),
);
```

## Settings tab routing (`apps/frontend/src/app/app.routes.ts`)

```ts
{
  path: 'settings',
  loadComponent: () => import('./settings/settings.component').then((m) => m.SettingsComponent),
  children: [
    { path: '', pathMatch: 'full', redirectTo: 'profile' },
    { path: 'profile', loadComponent: /* ProfileComponent, unchanged */ },
    { path: 'preferences', loadComponent: /* PreferencesComponent, unchanged */ },
    // NEW: one child per SETTINGS_TAB_CONTRIBUTIONS entry, entitlement-guarded
    ...SETTINGS_TAB_CONTRIBUTIONS.map((c) => ({
      path: c.path,
      canActivate: [domainGuard(c.domainId)],
      loadComponent: c.loadComponent,
    })),
  ],
}
```

`SettingsComponent`'s tab list (`settings.component.html`) is the fixed Profile/Preferences
`<p-tab>`s plus one `<p-tab>` per `SETTINGS_TAB_CONTRIBUTIONS` entry currently visible to the signed-
in user (same `isDomainEntitled` filter as above) — computed the same way
`AppSidebarComponent.areas` already filters `APPLICATION_AREAS` (020).

## Consumers

| Consumer                                                 | Uses                                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `apps/frontend/src/app/dashboard/dashboard.component.ts` | `DASHBOARD_WIDGET_CONTRIBUTIONS`, `isDomainEntitled`, `DynamicOutletComponent` |
| `apps/frontend/src/app/settings/settings.component.ts`   | `SETTINGS_TAB_CONTRIBUTIONS`, `isDomainEntitled`                               |
| `apps/frontend/src/app/app.routes.ts`                    | `SETTINGS_TAB_CONTRIBUTIONS`, `domainGuard`                                    |

## Verification (US1/US2's Independent Tests)

1. Confirm the Dashboard still renders the holdings distribution widget unchanged for a
   holdings-entitled user, and that it disappears when that entitlement is revoked (US1
   Acceptance Scenarios 1–2).
2. Add a throwaway second domain (a scratch `scope:frontend-domain` library plus one
   `DASHBOARD_WIDGET_CONTRIBUTIONS`/`SETTINGS_TAB_CONTRIBUTIONS` entry) and confirm its widget/tab
   appears only for an entitled user, without editing any other domain's code or
   `DashboardComponent`/`SettingsComponent`'s own logic (SC-001). Remove the throwaway library
   afterward.
3. Visit a contributed settings tab's URL directly while not entitled to its domain — confirm the
   same redirect `domainGuard` already produces for a domain's main route (US2 Acceptance Scenario
   4).
