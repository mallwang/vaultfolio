# UI Contract: Klaro Navigation Entry & Info Page

This feature has no backend API — the "contract" here is the frontend registration/routing surface
new code must satisfy, since that's the interface other parts of the app-shell (route table, nav
filter, admin accounts screen) depend on.

## `ApplicationArea` entry (nav + routing contract)

```ts
{
  id: 'klaro',
  label: 'Klaro',
  labelKey: 'nav.klaro',
  path: 'klaro',
  icon: 'handshake',            // fallback glyph if logoAsset fails to load (research.md #4)
  logoAsset: 'klaro-logo.png',  // served from apps/frontend/public/, new field (data-model.md)
  domainId: 'klaro',
}
```

Inserted in `APPLICATION_AREAS` between the `account-overview` entry and the `settings` entry
(design.md placement).

## `DomainDescriptor` entry (entitlement contract)

```ts
{ id: 'klaro', labelKey: 'nav.klaro', path: 'klaro', icon: 'handshake' }
```

Appended to `DOMAIN_REGISTRY`. Consumed unchanged by:

- `isDomainEntitled(user, 'klaro')` — sidebar filter and route guard both call this; no code
  change to either function is required, they're already domain-agnostic.
- The admin accounts screen's domain-scopes multiselect (`accounts.component.ts`), which lists
  every `DOMAIN_REGISTRY` entry generically.

## Route table entry

```ts
{
  path: 'klaro',
  title: 'pageTitle.klaro',
  canActivate: [domainGuard('klaro')],
  loadComponent: () =>
    import('@vaultfolio/frontend-domain-klaro').then((m) => m.KlaroPageComponent),
}
```

Inserted in `apps/frontend/src/app/app.routes.ts` alongside the other domain routes (same nesting
level as `account-overview`, under the `/app` shell).

## `@vaultfolio/frontend-domain-klaro` library public surface

```ts
// libs/frontend/domain/klaro/src/index.ts
export { KlaroPageComponent } from './lib/klaro-page/klaro-page.component.js';
```

`KlaroPageComponent`: no `@Input()`s, no `@Output()`s, no injected service beyond
`TranslatePipe`/PrimeNG modules — a fully static, standalone component (mirrors every existing
placeholder-domain component's contract; FR-011 forbids it from accepting or requesting any real
Klaro account data).

## i18n keys (content contract)

New keys required in both `en.ts` and `de.ts` (exact wording is a content/implementation detail,
not fixed by this contract — only the key names and their semantic purpose are):

| Key                             | Purpose                                                          |
| ------------------------------- | ---------------------------------------------------------------- |
| `nav.klaro`                     | Sidebar label (FR-001)                                           |
| `pageTitle.klaro`               | Browser tab title (matches every other domain route's `title`)   |
| `klaroPage.heroSubtitle`        | One-line subtitle under the hero mark+title (design.md)          |
| `klaroPage.description`         | Plain-language "what Klaro does" paragraph (FR-004)              |
| `klaroPage.feature1`…`feature4` | Feature-highlight bullets (design.md, illustrative content)      |
| `klaroPage.standaloneBanner`    | "currently its own, separate application" callout (FR-005)       |
| `klaroPage.externalLinkLabel`   | "Open Klaro ↗" button text (FR-006)                              |
| `klaroPage.externalLinkCaption` | "your Vaultfolio session stays open" caption (FR-006)            |
| `klaroPage.roadmapToday`        | Roadmap card "Today" row — separate account requirement (FR-008) |
| `klaroPage.roadmapSync`         | Roadmap card "Sync" row — same-email requirement (FR-009)        |
| `klaroPage.roadmapFuture`       | Roadmap card "Future" row — planned integration (FR-007)         |

## Out of contract scope

- Exact copy/wording for every `klaroPage.*` key — content detail, verified against
  FR-004–FR-009's _presence_ requirements in quickstart.md, not fixed verbatim here.
- The broken-logo-image fallback's exact CSS/markup shape — implementation detail (research.md #4).
