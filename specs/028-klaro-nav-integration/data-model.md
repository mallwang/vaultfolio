# Data Model: Klaro Navigation Entry

This feature adds no persisted/database entities (Principle II, no backend change). The "entities"
below are frontend, code-defined structures — extensions to existing registries, not new storage.

## ApplicationArea (extended)

Existing interface, `apps/frontend/src/app/core/layout/application-areas.ts`. One field added:

| Field           | Type         | Required     | Notes                                                                                                                                              |
| --------------- | ------------ | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`            | `string`     | yes          | unchanged — `'klaro'` for the new entry                                                                                                            |
| `label`         | `string`     | yes          | unchanged — `'Klaro'`                                                                                                                              |
| `labelKey`      | `string`     | yes          | unchanged — `'nav.klaro'`                                                                                                                          |
| `path`          | `string`     | yes          | unchanged — `'klaro'`                                                                                                                              |
| `icon`          | `string`     | yes          | unchanged, still required — used as the broken-image fallback glyph for entries that also set `logoAsset` (research.md #4)                         |
| `roles`         | `UserRole[]` | no           | unchanged — Klaro's entry omits this (available to all entitled roles, like Holdings)                                                              |
| `domainId`      | `string`     | no           | unchanged — `'klaro'` for the new entry, ties it into `isDomainEntitled`                                                                           |
| **`logoAsset`** | `string`     | **no (new)** | **New.** Static asset path (served from `apps/frontend/public/`) rendered in place of the `icon` glyph when present. Only Klaro's entry sets this. |

**Validation rules**: none beyond TypeScript's structural typing — `logoAsset`, when present, must
resolve to a file actually present under `apps/frontend/public/` (build-time/manual check, no
runtime validation needed since a 404'd image degrades via the `(error)` handler, research.md #4).

**State transitions**: none — this is a static, code-defined list, not a stateful entity.

## DomainDescriptor (extended entry, no shape change)

Existing interface, `libs/frontend/domain-access/src/lib/domain-registry.ts`. No field added to
the interface itself — one new entry is appended to `DOMAIN_REGISTRY`:

```ts
{ id: 'klaro', labelKey: 'nav.klaro', path: 'klaro', icon: 'handshake' /* placeholder semantic
  icon for the admin domain-scopes multiselect, which never renders logoAsset — any Material
  Symbols glyph already in ICON_NAME_MAP works here; exact choice is a content/implementation
  detail, not a data-model concern */ }
```

**Relationships**: `DomainDescriptor.id` and `ApplicationArea.domainId` both use the same string
key (`'klaro'`) — this is the existing convention every other domain already follows (e.g.
`'account-overview'`), not a new coupling mechanism.

## SessionUser.domainScopes (unchanged)

`libs/api-contract/src/lib/auth.ts` — no change. `'klaro'` becomes a valid, admin-assignable value
in this existing `string[]` the same way `'account-overview'` already is; no schema/migration is
needed since the backend stores/compares domain scopes generically as strings.

## Klaro Information Page (content, not a data entity)

The page's content (hero copy, description, feature bullets, standalone-app banner text, external
link, "Where this is headed" roadmap rows) is static, translated (i18n) text defined in
`libs/frontend/shared-ui/src/lib/i18n/translations/{en,de}.ts` under a `klaroPage.*` namespace and
consumed directly by `KlaroPageComponent`'s template (research.md #5, #6) — there is no dynamic
model object backing it; it is not fetched, stored, or user-editable (FR-011).
