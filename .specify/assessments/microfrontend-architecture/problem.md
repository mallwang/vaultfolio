# Problem Definition: Structuring Vaultfolio for a multi-domain product pivot

- **Slug**: microfrontend-architecture
- **Created**: 2026-09-05
- **Inputs used**: intake.md, research.md

## Problem Statement

Vaultfolio is planned to grow from a single-purpose investment-tracking app into a multi-domain personal finance app spanning six domains (holdings, retirement, insurances, household/budget planning, historic wealth development, and account overview), but today's single Angular application has no established structure for adding, gating, and maintaining multiple product domains side by side. Without a deliberate approach, each new domain risks entangling further with the existing "holdings" code and with each other, and there is no mechanism to control which domains a given user sees based on role/scope (and possibly future billing tier) as the number of domains grows. This matters now because the domain list and pivot are concrete and about to move into building, and the structural choice made for the first new domain will shape how the other five are added.

## Affected Users & Stakeholders

- **Users**: Vaultfolio end users (self-hosted household/personal-finance audience) — affected by which domains they can see/use and by the coherence and performance of the app as it grows from one to six domains.
- **Users**: Administrators (existing binary Administrator role) — affected by whatever mechanism ends up controlling which domains are visible to which members.
- **Stakeholders**: The single development team building and maintaining Vaultfolio (currently the sole owner of all domains) — decides the architecture, bears all build/maintenance/operational cost, and has no current pain point forcing a change. — [source: intake.md Clarifications, research.md "Users & Demand"]
- **Stakeholders**: [NEEDS CLARIFICATION: whether a hosted/multi-tenant offering (and its operator/business stakeholder) is also being considered — this would introduce a stakeholder with a real interest in billing-gated access that doesn't exist under the current self-hosted/NAS deployment model — see research.md "Update" section]

## Goals

- Allow the product to expand from one domain (holdings) to the planned six domains without each addition increasing coupling or maintenance cost across unrelated domains.
- Have a way to control which domains/features a given user can see and use, building on the existing role system, that can extend to finer-grained scope (and potentially billing) as those dimensions mature.
- Keep the single team's ongoing build and maintenance effort sustainable as domain count grows, without assuming multi-team deploy-cadence needs that don't exist today.

## Non-Goals

- Enabling multiple independent teams with independent deploy cadences — one team owns all domains for the foreseeable future. — [source: intake.md Clarifications]
- Designing or building a billing/subscription system — no such system exists today, and billing-based gating is speculative. — [source: research.md "Prior Art", "Evidence Against the Idea"]
- Solving cross-domain data aggregation (e.g., a combined net-worth view drawing on holdings, banking, and insurance data) — this is a related but distinct data/API design problem, not addressed here. — [source: research.md "Update" section]
- Selecting a specific technical implementation (e.g., Module Federation, lazy-loaded route modules, or any other pattern) — that choice belongs to shaping/deciding, not to this problem definition.

## Success Metrics

- Qualitative: A new domain can be added to the product without requiring changes to unrelated existing domains' code, tests, or deploy path. (baseline: unknown — no domain beyond holdings exists yet to measure against)
- Qualitative: Whether a given user can see/use a given domain can be controlled per-user (via role/scope) without shipping domain-specific conditionals scattered through the app. (baseline: today's single side-nav is gated only by a binary authenticated/Administrator-vs-member check — [source: research.md, specs/009-app-shell-restructure/spec.md, specs/005-auth-sessions-isolation/spec.md])
- Qualitative: The single team's per-domain build/maintenance effort does not grow superlinearly as domains are added. (baseline: unknown — no multi-domain data point exists yet)

## Cost of Inaction

If nothing changes, all six domains would most likely be added the way all 19 prior specs have been built: as new routes/modules inside the existing single Angular application, gated (if at all) by the existing binary Administrator/member role check. This has produced no reported pain to date and requires no new tooling or operational capability. — [source: research.md "Market & Context", "Evidence Against the Idea"]. The risk of inaction is speculative rather than observed: as the domain count grows from one to six within a single codebase, coupling between domains and the cost of adding fine-grained, per-domain access control could increase — but no evidence yet shows this becoming a blocker, and the team's own clarification is that no current pain point exists.

## Open Questions

- [NEEDS CLARIFICATION: Do all six domains ship together, or incrementally — and if incremental, which domain ships first and establishes the pattern the others will follow?]
- [NEEDS CLARIFICATION: Do the domains share an underlying data model (e.g., "historic wealth development" or "account overview" aggregating holdings, banking, and insurance data)? If so, structuring the frontend alone will not resolve the cross-domain data/API design question.]
- **RESOLVED (2026-09-05)**: Vaultfolio remains self-hosted/single-household — no hosted/multi-tenant offering is being considered. Billing-based gating stays out of scope; see concept.md Assumptions to Validate.
- **RESOLVED (2026-09-05)**: "Single team" holds for the foreseeable future — no near-term plan to bring in additional teams/contributors. Independent deploy cadences per domain remain a non-goal.
- [NEEDS CLARIFICATION: What would make the existing extension path (role-gated app shell + lazy-loaded route modules, each behind a route guard) insufficient as the domain count grows to six — i.e., what specifically would it fail to do that a different structure would need to provide? — addressed at shape stage: see concept.md's Option A vs. Option B trade-off (lack of enforced boundaries).]
