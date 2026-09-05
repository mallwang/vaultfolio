# Phase 1 Data Model: Placeholder Domains for the Multi-Domain Pivot

No new persisted entity, table, or column is introduced by this feature. The two "Key Entities"
named in the spec are both existing 020 concepts extended with new values, not new shapes.

## Domain (registry entry)

Already defined by 020 as `DomainDescriptor` (`libs/frontend/domain-access/src/lib/domain-registry.ts`):

| Field      | Type   | Notes                                                                          |
| ---------- | ------ | ------------------------------------------------------------------------------ |
| `id`       | string | Stable key; see research.md #1 for the five new values.                        |
| `labelKey` | string | i18n key for the nav label, `nav.<camelCaseId>`.                               |
| `path`     | string | Router path segment under `/app`; equal to `id` for all five (research.md #1). |
| `icon`     | string | `vf-icon` semantic name; see research.md #2.                                   |

**This feature's change**: five new `DomainDescriptor` entries appended to `DOMAIN_REGISTRY`, in
the order given in research.md #3. No field is added to the interface.

## Domain Entitlement

Already defined by 020 as `SessionUser.domainScopes: string[]` (`libs/api-contract`) and
`AccountSummary.domainScopes: string[]` — an unordered set of domain ids an account may access,
evaluated by the existing `isDomainEntitled` (ADMIN bypass; otherwise membership test) on the
frontend and `DomainGuard`/`RequiresDomain` on the backend.

**This feature's change**: the backend's `KNOWN_DOMAIN_IDS` allow-list
(`apps/backend/src/accounts/accounts.service.ts`) — which the accounts service validates
`ChangeDomainScopesRequest.domainScopes` against before persisting — gains the five new ids
alongside `'holdings'`. No schema change: `domainScopes` is already a `string[]` column/field with
no foreign-key/enum constraint at the storage layer (per its own 020 documentation, this list is
"deliberately duplicated" application-side validation, not a DB-level constraint).

No row of any existing account gains a new domain id as a side effect (FR-010) — this is a
property of _not_ writing to any account row, which this feature does not do.

## Non-entities: Dashboard Widget / Settings Tab Contributions

`DashboardWidgetContribution` and `SettingsTabContribution` (021) are consumed, not extended: this
feature adds **zero** entries to `DASHBOARD_WIDGET_CONTRIBUTIONS` / `SETTINGS_TAB_CONTRIBUTIONS`
for any of the five new domains (FR-005, Assumptions). They are listed here only to make explicit
that "no change" to these two registries is itself part of this feature's design, not an
oversight.
