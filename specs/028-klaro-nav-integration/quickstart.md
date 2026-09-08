# Quickstart: Validate the Klaro Navigation Entry

Manual/Playwright validation for the acceptance scenarios in spec.md. See
[verify-ui skill](../../.claude/skills/verify-ui) for app URLs, seeded admin login, and selector
conventions — use `data-testid="sidebar-nav-item-klaro"` (follows the existing
`sidebar-nav-item-<area.id>` convention already used by every other entry).

## Prerequisites

1. Backend + frontend running locally (per `verify-ui` skill's launch instructions).
2. A signed-in test account entitled to the `klaro` domain — either an `ADMIN` account (entitled
   to every domain automatically, per `isDomainEntitled`) or a non-admin account whose
   `domainScopes` includes `'klaro'` (grant it via the admin Accounts screen's domain-scopes
   multiselect, `data-testid="accounts-row-<id>-domain-scopes"`).

## US1 — Discover Klaro from the side navigation (P1)

1. Sign in, open the side navigation.
2. **Expect**: an entry labeled "Klaro" (`data-testid="sidebar-nav-item-klaro"`), positioned after
   "Account Overview" and before "Settings", rendering the Klaro logo image — not a Material
   Symbols glyph like every other entry.
3. Select the entry.
4. **Expect**: navigation to `/app/klaro`, browser tab title updates to the Klaro page title.

## US2 — Understand what Klaro is and how to reach it (P1)

1. On `/app/klaro`, read the page content.
2. **Expect**: a plain-language description of what Klaro does, and an explicit statement that it
   is currently a separate, standalone application from Vaultfolio.
3. Select the external link ("Open Klaro ↗" or similar).
4. **Expect**: a new browser tab opens at `https://klaro.allwang.family/`; the original Vaultfolio
   tab/session remains open and unaffected.

## US3 — Understand the account and data-sync relationship (P2)

1. On `/app/klaro`, read the "Where this is headed" (roadmap) content.
2. **Expect** all three statements are present:
   - Klaro's functionality is planned to be integrated into Vaultfolio under this same nav entry
     in the future.
   - Until then, users must create a separate account directly in Klaro.
   - Future data synchronization requires the identical email address on both accounts.

## Edge cases

- **Logo asset fails to load**: temporarily break the `logoAsset` path (or block the request via
  devtools), reload the sidebar. **Expect**: the "Klaro" entry still renders, remains selectable,
  and falls back to a Material Symbols glyph in place of the broken image (research.md #4) — the
  entry is never hidden or disabled.
- **No entitlement**: as a non-admin account without `'klaro'` in `domainScopes`, confirm the
  sidebar entry is absent, and navigating directly to `/app/klaro` redirects to `/app/dashboard`
  (same behavior as any other un-entitled domain, via `domainGuard`).
- **Collapsed/mobile sidebar**: collapse the sidebar (desktop) and resize to a mobile viewport.
  **Expect**: the Klaro entry follows the same icon-only / horizontal-scrollable-top-bar behavior
  as every other entry (e.g. Holdings), with the logo mark scaled the same way the collapse
  behavior already scales `app-icon`.

## Automated coverage (implementation phase, not this quickstart)

- `app-sidebar.component.spec.ts`: extend existing role/domain-filter tests with a `klaro`
  fixture; add a test asserting the `<img>`/`<app-icon>` fallback swap on an `(error)` event.
- `app.routes.spec.ts`: extend existing route-table assertions with the `klaro` route + guard.
- `klaro-page.component.spec.ts` (new): asserts presence of the FR-004–FR-009 content blocks and
  that the external link has `target="_blank"` (and `rel="noopener"`) pointing at
  `https://klaro.allwang.family/`.
