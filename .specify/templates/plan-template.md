# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript (Node.js LTS runtime for the backend)

**Primary Dependencies**: NestJS (backend), Angular (frontend), Nx (monorepo tooling) — per the
constitution's Stack Decision. Note any feature-specific additions here (e.g., a charting library,
a market-data client) beyond this baseline.

**Storage**: PostgreSQL, accessed via the backend only (Principle II)

**Testing**: Jest (Nx default for both NestJS and Angular projects); contract/integration tests per
Principle IV

**Target Platform**: Linux server (backend + PostgreSQL containers), modern evergreen browsers
(Angular frontend)

**Project Type**: web-service + frontend, Nx monorepo (see Project Structure below)

**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]

**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]

**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

[Gates determined based on constitution file]

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# DEFAULT: Nx monorepo (frontend + backend), per the constitution's Stack Decision
apps/
├── backend/                  # NestJS
│   ├── src/
│   │   ├── modules/          # feature modules (controllers, DTOs, wiring)
│   │   └── main.ts
│   └── src/tests/            # e2e/integration tests for this app
└── frontend/                 # Angular
    ├── src/
    │   ├── app/               # components, pages, routing
    │   └── main.ts
    └── src/tests/

libs/
├── domain/[domain-name]/     # standalone finance/domain logic (Principle I),
│                             # framework-independent, unit-tested in isolation
├── api-contract/             # shared DTOs/types between backend and frontend
└── [market-data-provider]/   # external market-data integration, isolated per
                              # Product Scope's External Market Data rules

# [REMOVE IF UNUSED] Only if this feature also needs a standalone project outside
# the monorepo's normal app/lib shape (rare — justify in Complexity Tracking):
src/
tests/
```

**Structure Decision**: [Document the selected Nx apps/libs for this feature —
which existing libs it extends, which new libs (if any) it introduces, and why]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
