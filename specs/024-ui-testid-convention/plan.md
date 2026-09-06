# Implementation Plan: UI Test-ID Convention

**Branch**: `024-ui-testid-convention` | **Date**: 2026-09-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/024-ui-testid-convention/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Define a written `data-testid` naming convention for the Angular frontend (static elements,
repeated rows, and components reused across screens), document it in a location both a human and
the `verify-ui` skill can reference, retrofit existing templates so every FR-002-qualifying element
carries a `data-testid` per that convention, and update `CLAUDE.md` / the `verify-ui` skill so new
UI work adds the attribute as part of the same change instead of a follow-up chore. This is a
documentation + Angular-template-attribute feature: no backend, API, or data-model changes are
involved, and behavior/rendering must not change (FR-007) — only the new attribute is added.

## Technical Context

**Language/Version**: TypeScript (Angular frontend only — no backend/database work in this
feature)

**Primary Dependencies**: Angular (templates being retrofitted), `@ngx-translate` (the i18n
mechanism the convention must stay independent of), PrimeNG (the UI-library wrapper case in
FR-002); no new dependency is introduced

**Storage**: N/A — no persisted data, no backend/database touched by this feature

**Testing**: Existing Jest/Angular unit tests for retrofitted components MUST still pass unchanged
(FR-007); ad-hoc Playwright verification (per the `verify-ui` skill) is the acceptance mechanism for
SC-002/SC-003, not a committed e2e suite (see spec Assumptions)

**Target Platform**: Modern evergreen browsers (Angular frontend), same as the rest of the app

**Project Type**: Documentation convention + frontend-only template retrofit, within the existing
Nx monorepo (see Project Structure below) — no new Nx project/library is created

**Performance Goals**: N/A — adding a static HTML attribute has no runtime performance impact

**Constraints**: Retrofit MUST be behaviorally inert (FR-007): no visual, DOM-structure (beyond the
added attribute), or existing-test-result changes; convention MUST not assume any i18n string
value, per SC-002 (locale independence)

**Scale/Scope**: Every Angular template under `apps/frontend/src` and the six `libs/frontend/domain/*`
libraries (`holdings`, `retirement`, `insurances`, `haushaltsplaner`, `historic-wealth-development`,
`account-overview`) plus `libs/frontend/admin` — reviewed against the FR-002 categories; only
qualifying elements are changed (not a full rewrite, per spec Assumptions)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Principle I (Library-First)**: N/A to this feature — it adds no domain/finance logic and no new
  library; it only documents a convention and adds attributes inside existing Angular component
  templates. PASS (not applicable, no violation).
- **Principle II (API-First Interface)**: N/A — no API surface, contract, or backend change.
  PASS.
- **Principle III (Test Coverage)**: No monetary/financial-calculation code is touched, so the
  exact-value assertion rule doesn't apply; existing unit tests for retrofitted components must
  keep passing unchanged (FR-007), which is verified per touched component rather than added as new
  test coverage. PASS.
- **Principle IV (Integration Testing)**: N/A — no new library contract, service boundary, or shared
  schema is introduced. PASS.
- **Principle V (Observability, Versioning & Simplicity)**: The convention document itself is the
  "simple, documented" artifact (YAGNI-compliant: one plain-language convention doc, no tooling/
  lint-rule framework introduced to enforce it in this feature). PASS.
- **Frontend domain library boundaries (Stack Decision)**: Retrofitting adds only a static
  `data-testid` attribute inside each domain's own templates — it does not add cross-domain imports
  or shared logic, so the `scope:frontend-domain` boundary rules are unaffected. PASS.

No violations identified. Complexity Tracking is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/024-ui-testid-convention/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command) — naming-convention contract
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
# Nx monorepo (frontend + backend) — this feature touches the frontend side only

apps/
└── frontend/
    ├── src/app/                       # app-shell templates reviewed/retrofitted
    │   ├── auth/                      # sign-in etc.
    │   ├── core/layout/app-header/    # already has language-switcher / theme-toggle
    │   └── settings/, dashboard/, ... # shell screens
    └── src/tests/

libs/
├── frontend/
│   ├── domain/
│   │   ├── holdings/                        # each is its own Nx lib, own templates
│   │   ├── retirement/
│   │   ├── insurances/
│   │   ├── haushaltsplaner/
│   │   ├── historic-wealth-development/
│   │   └── account-overview/
│   └── admin/

# New documentation artifact (this feature's primary deliverable, User Story 1):
docs/
└── frontend/
    └── testid-conventions.md   # exact location confirmed in research.md

.claude/
├── CLAUDE.md                  # updated per FR-008
└── skills/verify-ui/SKILL.md  # updated per FR-008/FR-009
```

**Structure Decision**: No new Nx app or library is created. Work is confined to (1) a new
convention document (location decided in Phase 0 research — likely under `docs/frontend/` so it's
discoverable outside any single Nx project), (2) attribute-only edits inside existing templates in
`apps/frontend` and the `libs/frontend/domain/*` / `libs/frontend/admin` libraries, and (3) edits to
the two agentic-guidance files named in FR-008/FR-009 (`CLAUDE.md`, `.claude/skills/verify-ui/
SKILL.md`).

## Complexity Tracking

> Not applicable — Constitution Check has no violations to justify.
