# Idea Intake: Split frontend into a microfrontend architecture

- **Slug**: microfrontend-architecture
- **Created**: 2026-09-05
- **Source**: pasted text
- **Type**: new-capability

## Idea (as captured)

> I am thinking of splitting the frontend into a microfrontend architecture for later adding new features as separate web applications, which will integrated into the application based on the users role, scope and maybe billing data.

## Restated

Restructure Vaultfolio's frontend into a microfrontend architecture so that future features can be built and shipped as independent web applications, then composed into the main application at runtime based on a user's role, scope, and possibly billing/subscription data. The underlying driver is a broader product pivot: Vaultfolio is to grow from a single investment-tracking app into a multi-domain personal finance app — retirement, insurances, household/budget planning, historic wealth development, and account overview — with today's entire application becoming just the "holdings" domain among several.

## Origin & Context

- **Raised by**: [NEEDS CLARIFICATION: not stated — appears to be the user's own idea, unconfirmed]
- **Trigger**: A product-scope pivot is planned, not just one feature: Vaultfolio is to expand from a single investment-tracking app into a multi-domain personal finance app. The planned domains, each intended as its own microfrontend:
  - **Retirement** — current retirement claims, retirement planning
  - **Insurances** — list current insurances, plan new ones, evaluate which are needed
  - **Haushaltsplaner (household/budget planner)** — spending vs. income, daily invoices/expenses, monthly budget planning
  - **Historic wealth development** — wealth over time, absolute/percentage change, debt vs. wealth
  - **Account overview** — banks, neobrokers, depots, and planned cash flow across all of them
  - **Holdings (existing)** — today's entire application (investment tracking incl. import) becomes just one feature/microfrontend among the above, rather than the whole product

## Clarifications

- **Technical approach**: Module Federation — runtime composition of independently built/deployed bundles (Webpack/Vite Module Federation), not iframes, web components, or plain Nx package splitting.
- **Role/scope model**: Vaultfolio already has a role/scope system in place today that could gate microfrontend visibility; it does not need to be built from scratch. (Research found this is currently a binary Administrator/member role, not a fine-grained scope system — see research.md.)
- **Billing gating**: No billing/subscription system exists yet. Gating by billing data is speculative/future-facing, not tied to a system in place or separately planned today.
- **Ownership**: A single team (the current team) will build and maintain all microfrontends for now — this is not (yet) about enabling multiple independent teams.
- **Pain points**: No current pain points with the existing frontend architecture are driving this — it is purely about enabling future flexibility, not fixing something broken today.
- **Expected scale**: ~6 microfrontends (5 new domains + holdings), within this year (2026) per the earlier "small, 2-3" estimate — the concrete domain list above suggests this may be an undercount; scale should be reconfirmed at define/shape.

## First-Glance Unknowns

- [NEEDS CLARIFICATION: Do all six domains ship as separate microfrontends from day one, or is this a target end-state reached incrementally — and if incremental, which domain ships first?]
- [NEEDS CLARIFICATION: Given no current pain points and a single team maintaining everything, what specifically justifies Module Federation (vs. lazy-loaded feature modules in the existing single Angular app) now, especially at a ~6-microfrontend, single-team scale?]
- [NEEDS CLARIFICATION: How will role/scope (existing, currently binary) and billing data (not yet existing) be surfaced to the shell app to decide which microfrontends to load — is there an existing entitlements/feature-flag mechanism, or does this need to be designed?]
- [NEEDS CLARIFICATION: Do the six domains share underlying data (e.g., does "historic wealth development" or "account overview" need holdings + insurances + banking data to compute a combined net-worth view), and if so, how do cross-domain views work when each domain is an independently deployed microfrontend?]
- [NEEDS CLARIFICATION: Is billing intended to gate access per domain (e.g., a paid tier unlocks "insurances" or "Haushaltsplaner")? If Vaultfolio is self-hosted/NAS-deployed for personal/household use (per research.md), what would billing even apply to — is a hosted/multi-tenant offering also being considered?]
