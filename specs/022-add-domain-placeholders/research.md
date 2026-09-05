# Phase 0 Research: Placeholder Domains for the Multi-Domain Pivot

All Technical Context fields were resolvable directly from the existing 020/021 implementation and
its contracts — no NEEDS CLARIFICATION markers remain. This document records the decisions made
for the handful of feature-specific choices not already dictated by 020/021.

## 1. Domain ids and library names

**Decision**: Use the following stable ids (matching `DomainDescriptor.id` / `domainScopes`
entries / `KNOWN_DOMAIN_IDS`), library package names, and route path segments:

| Domain (intake name)        | `id`                          | Library                                                   | Route path                    |
| --------------------------- | ----------------------------- | --------------------------------------------------------- | ----------------------------- |
| Retirement                  | `retirement`                  | `@vaultfolio/frontend-domain-retirement`                  | `retirement`                  |
| Insurances                  | `insurances`                  | `@vaultfolio/frontend-domain-insurances`                  | `insurances`                  |
| Haushaltsplaner             | `haushaltsplaner`             | `@vaultfolio/frontend-domain-haushaltsplaner`             | `haushaltsplaner`             |
| Historic Wealth Development | `historic-wealth-development` | `@vaultfolio/frontend-domain-historic-wealth-development` | `historic-wealth-development` |
| Account Overview            | `account-overview`            | `@vaultfolio/frontend-domain-account-overview`            | `account-overview`            |

**Rationale**: Lowercase-kebab ids are consistent with `holdings` (the only existing id) and are
directly reusable as router path segments, avoiding a separate id↔path mapping. Package names
follow the exact `@vaultfolio/frontend-domain-<id>` convention already used for
`frontend-domain-holdings`.

**Alternatives considered**: CamelCase or abbreviated ids (e.g. `hwd` for Historic Wealth
Development) — rejected because the intake and spec always refer to domains by their full name,
and an abbreviation would make navigation/settings copy and account-management screens (which
already render `DOMAIN_REGISTRY` ids as read-only labels via `labelKey`) harder to map back to the
domain without documentation.

## 2. Icons

**Decision**: Reuse existing `vf-icon` semantic names already available in
`frontend-shared-ui`'s `icon-name.map.ts` that plausibly match each domain, choosing generic,
recognizable Material Symbols glyphs: `retirement` → `elderly`, `insurances` → `shield`,
`haushaltsplaner` → `receipt-long`, `historic-wealth-development` → `trending-up`,
`account-overview` → `account-balance`. If any of these five names is not already present in the
shared icon map, it is added there via the existing Material Icons pipeline (constitution's Stack
Decision — Material Symbols, PrimeIcons prohibited), since `DomainDescriptor.icon` requires a
pre-registered `vf-icon` name.

**Rationale**: Icons are explicitly not a design goal of this feature (Assumptions: "exact
user-facing copy, ordering, and iconography may be refined without re-scoping"); any reasonable,
semantically-adjacent glyph satisfies FR-002/FR-003 without blocking later refinement.

**Alternatives considered**: A single generic "placeholder" icon for all five — rejected because
Edge Case 4 ("two domains with similar names") implies each nav entry should remain visually
distinguishable, and per-domain icons cost nothing extra to pick now.

## 3. Registry ordering

**Decision**: Append the five new domains to `DOMAIN_REGISTRY` and `APPLICATION_AREAS` in the same
order as the intake document and the spec's FR-001 list: Retirement, Insurances, Haushaltsplaner,
Historic Wealth Development, Account Overview — inserted after the existing `holdings` entry.

**Rationale**: Satisfies Edge Case 2 ("stable, predictable order") with the simplest possible rule
(source-of-truth-list order); avoids inventing a separate sort key.

**Alternatives considered**: Alphabetical ordering — rejected as no more "predictable" than
source-list order and would put Holdings out of its natural first position.

## 4. Placeholder page content and i18n key shape

**Decision**: Each placeholder component renders a single, centered informational panel (reusing
whatever shared "empty state" presentational pattern `frontend-shared-ui` already exposes, e.g.
the pattern behind Holdings' "coming soon" imports/distribution copy) with two translation keys:
`<domainKey>Placeholder.title` (domain name) and `<domainKey>Placeholder.body` (a fixed "not yet
available" sentence, parameterizable per domain if useful but not required). Nav labels use
`nav.<id>` keys (camelCase id where the id itself contains hyphens, e.g. `nav.historicWealthDevelopment`),
matching the existing `nav.holdings` convention.

**Rationale**: Matches FR-003 exactly (identify by name, communicate "not yet built") with the
least new UI surface; reuses `en.ts`/`de.ts`'s existing flat-namespaced-object translation
structure instead of introducing a new one.

**Alternatives considered**: One shared generic `PlaceholderComponent` parameterized by domain
name/id, instantiated identically from all five libraries' routes — considered but rejected in
favor of five thin per-domain components: FR-007 requires each domain's later real build-out to
require _no_ change outside that domain's own library, and a shared component living outside any
one domain's library would need to move (or become an extension point of its own) the moment the
first of the five gets real content, which is unnecessary churn for what Assumptions already say
needs no polish. A five-line component per domain, each free to diverge independently, is simpler
end-to-end (Principle V, YAGNI) than building a reusable abstraction for a one-time need.
