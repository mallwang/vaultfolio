# Phase 0 Research: Klaro Navigation Entry

## 1. How does the sidebar render a real logo image instead of a Material Symbols glyph for one entry?

**Decision**: Add an optional `logoAsset?: string` field to `ApplicationArea` (alongside the
existing required `icon`), pointing at a static asset path served from `apps/frontend/public/`
(e.g. `'klaro-logo.svg'`, matching how `vaultfolio-logo.png` is already referenced from that same
directory). `app-sidebar.component.html` renders `<img [src]="area.logoAsset" ...>` in the icon
slot when `area.logoAsset` is set, and falls back to the existing `<app-icon [name]="area.icon">`
otherwise. `icon` stays required on every `ApplicationArea` (including Klaro's) so the field keeps
working as a fallback and so `DomainDescriptor.icon` (used unchanged by the admin accounts screen's
domain-scopes multiselect, which never needs the logo) has a value to point at.

**Rationale**: This is the smallest change that satisfies FR-002 without weakening the
constitution's "Material Icons is the sole icon library" rule anywhere else: every other nav entry
and every other consumer of `ApplicationArea`/`DomainDescriptor.icon` (the admin multiselect) is
completely unaffected — `logoAsset` is additive, opt-in, and used by exactly one entry, matching
design.md's explicit call-out that Klaro is the _one_ entry that intentionally departs from the
icon system. Keeping `icon` required also means the Edge Case ("What if the Klaro logo asset fails
to load?") has a natural, cheap answer (see #4 below) without inventing a second fallback
mechanism.

**Alternatives considered**:

- _New `ApplicationArea` variant/union type just for logo-bearing entries_ — rejected: adds a
  second shape every consumer of `APPLICATION_AREAS` (sidebar, route table, any future consumer)
  would need to discriminate against, for a single entry; not justified by YAGNI (Principle V).
- _Extend `IconComponent` itself to accept an image URL_ — rejected: `IconComponent`'s whole
  contract (data-model.md "Icon Name Map") is "semantic name → Material Symbols glyph"; teaching
  it to also render arbitrary images blurs that contract for every other call site and every
  future audit of "is Material Icons the sole icon source" (constitution Stack Decision).

## 2. Where does the real Klaro logo asset come from?

**Decision**: The Klaro repository (https://github.com/mallwang/klaro) has a brand mark at
`klaro.png` in its repo root. That file is pulled into this repo as a static asset (recommend
converting to fit the sidebar's small square mark slot; PNG is acceptable if no SVG source
exists — matches the precedent of `apps/frontend/public/vaultfolio-logo.png` already being a PNG,
not an SVG) and committed at `apps/frontend/public/klaro-logo.png`, referenced by
`ApplicationArea.logoAsset`.

**Rationale**: The spec's Assumptions explicitly deferred "obtaining/preparing that asset file" to
planning; it has now been located and is a real, current file, not a placeholder — no
NEEDS CLARIFICATION remains.

**Alternatives considered**:

- _Keep the mockup's placeholder teal "K" mark_ — rejected: FR-002 explicitly requires "the
  Klaro application's own logo," and the real asset is available, so shipping a placeholder would
  be a known, avoidable gap.

## 3. Does Klaro need a new backend domain-access/entitlement mechanism?

**Decision**: No. Klaro is registered as one more entry in the existing, generic
`DOMAIN_REGISTRY` (`libs/frontend/domain-access`) with `id: 'klaro'`. `isDomainEntitled` and
`domainGuard` already work against arbitrary `domainId` strings compared to
`SessionUser.domainScopes` (itself a generic `string[]` on the backend, per
`libs/api-contract/src/lib/auth.ts`) — no backend code change is needed for an admin to grant a
user the `'klaro'` scope via the existing accounts admin screen, which already reads
`DOMAIN_REGISTRY` generically.

**Rationale**: Directly satisfies FR-010 and the spec's Assumption that this feature "does not add
new access-control logic beyond reusing the existing per-domain entitlement mechanism" — confirmed
by reading `is-domain-entitled.ts`, `domain.guard.ts`, and the admin `accounts.component.ts`, all
of which are domain-agnostic already.

**Alternatives considered**: N/A — no alternative mechanism exists in the codebase to consider;
this is a direct reuse, not a design choice with trade-offs.

## 4. Broken-logo-image fallback (Edge Cases)

**Decision**: Add an `(error)` handler on the `<img>` in `app-sidebar.component.html` that swaps
the failed image out for the existing `<app-icon [name]="area.icon">` glyph at render time (a
small boolean signal per area, or a simple `[hidden]`/class toggle set from the handler) — reusing
the `icon` field Klaro's `ApplicationArea` entry already carries (see #1) rather than introducing a
second, logo-specific fallback icon.

**Rationale**: Satisfies the Edge Case requirement ("a broken image MUST NOT hide or disable the
entry") with no new data on `ApplicationArea` beyond what #1 already adds, and keeps the entry
selectable throughout (the `<a routerLink>` wrapper is unaffected by which child renders).

**Alternatives considered**:

- _`alt` text only, no swap_ — rejected: a broken `<img>` with alt text still renders as a
  visibly-broken small box in most browsers, which is a worse "accessible text fallback" than
  reusing the same Material Symbols glyph every other entry already uses.

## 5. Page content structure / component shape

**Decision**: Model `KlaroPageComponent` on the existing placeholder-domain components (e.g.
`InsurancesPlaceholderComponent`) for boilerplate (inline template/styles for the same
`@angular/build:unit-test` cross-package externalization reason documented on `IconComponent` and
`InsurancesPlaceholderComponent`), but with the richer, multi-section layout design.md specifies
(hero, description, feature-highlight list, standalone-app banner, external link, "Where this is
headed" card) instead of the single empty-state card the placeholders use — this page is not a
placeholder, it has real, final content per FR-004–FR-009.

**Rationale**: Reuses established conventions (PrimeNG `p-card`, `TranslatePipe`, inline
template/styles) while matching design.md's approved layout, which is intentionally richer than a
"not built yet" placeholder since Klaro's page is fully specified content, not a stub.

**Alternatives considered**:

- _Reuse `InsurancesPlaceholderComponent`'s exact single-card shape_ — rejected: does not fit
  design.md's approved mockup (hero, banner, external link, roadmap card) or satisfy FR-004–FR-009,
  which require several distinct pieces of content, not one paragraph.

## 6. i18n key placement

**Decision**: New keys — `nav.klaro`, `pageTitle.klaro`, and a `klaroPage.*` namespace (title,
subtitle, description, feature bullets, banner text, link label/caption, roadmap row labels/body)
— are added to the existing central dictionaries `libs/frontend/shared-ui/src/lib/i18n/
translations/en.ts` and `de.ts`, exactly where `insurancesPlaceholder.*` and `nav.insurances` /
`pageTitle.insurances` already live, in both languages.

**Rationale**: Matches the codebase's single centralized i18n dictionary pattern (no per-domain
i18n files exist today) — confirmed by grepping for `insurancesPlaceholder` and finding it only in
the two shared-ui translation files plus its own component.

**Alternatives considered**: N/A — no other i18n mechanism exists in this codebase to consider.
