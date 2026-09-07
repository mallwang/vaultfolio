# Implementation Plan: Cloudflare Turnstile Bot Protection

**Branch**: `026-turnstile-bot-protection` | **Date**: 2026-09-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/026-turnstile-bot-protection/spec.md`

## Summary

Add Cloudflare Turnstile bot protection to the public Signup (`POST /signups`) and Forgot-Password (`POST /profile/forgot-password`) endpoints. The Angular frontend loads the Turnstile widget via CDN, collects a token in managed/invisible mode, and includes it in the request body. A new `TurnstileGuard` on the backend calls Cloudflare's siteverify API (via Node's built-in `fetch`) before any business logic runs, rejecting requests with missing, invalid, or unverifiable tokens (fail-closed). No new npm packages required.

## Technical Context

**Language/Version**: TypeScript; Node.js LTS (18+) for backend (provides `globalThis.fetch`)

**Primary Dependencies**: NestJS (backend), Angular (frontend), Nx monorepo tooling — no new packages

**Storage**: No DB changes; tokens are transient (verified in-flight, not persisted)

**Testing**: Jest (Nx default for both projects); `TurnstileService` integration-tested with a mocked fetch/siteverify response

**Target Platform**: Linux container (backend), modern evergreen browsers (Angular frontend)

**Project Type**: web-service + frontend, Nx monorepo

**Performance Goals**: Siteverify call < 2 s (SC-004); page-load impact < 500 ms (SC-003, widget async/defer)

**Constraints**: No new npm packages (spec assumption); fail-closed on siteverify outage (FR-007)

**Scale/Scope**: Two protected endpoints; one new backend module; one new frontend component; two modified api-contract interfaces

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design._

| Principle                         | Assessment                                                                                                                                                                                                                                                         | Status  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| **I. Library-First**              | `TurnstileModule` is a NestJS module with a single coherent responsibility (bot-token verification). Backend-only; does not belong in a shared Nx lib. Angular `TurnstileComponent` is a standalone component with a clear boundary (renders widget, emits token). | ✅ Pass |
| **II. API-First Interface**       | `turnstileToken: string` added to `CreateSignupRequest` and `ForgotPasswordRequest` in `libs/api-contract`; `bot_protection_failed` error code added to both error unions. Contract written before implementation.                                                 | ✅ Pass |
| **III. Test Coverage**            | No monetary/financial logic involved. Standard coverage required: `TurnstileService` (unit + integration with mocked siteverify), `TurnstileGuard` (unit), `TurnstileComponent` (unit — token emit, disabled state).                                               | ✅ Pass |
| **IV. Integration Testing**       | `TurnstileService` integration test required: exercises the full HTTP-call → parse → throw path with a mocked fetch (nock or Jest fetch mock).                                                                                                                     | ✅ Pass |
| **V. Observability & Simplicity** | Failure cases logged at `warn`/`error` with structured context. No new abstraction beyond the minimal guard+service. YAGNI: no retry logic (fail-closed is correct).                                                                                               | ✅ Pass |

**No violations. Complexity Tracking section not required.**

## Project Structure

### Documentation (this feature)

```text
specs/026-turnstile-bot-protection/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   └── turnstile-api.md ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
apps/
├── backend/src/
│   ├── turnstile/                  # NEW — TurnstileModule, TurnstileService, TurnstileGuard
│   │   ├── turnstile.module.ts
│   │   ├── turnstile.service.ts    # calls siteverify (form-encoded, action+hostname validation)
│   │   ├── turnstile.guard.ts      # reads @TurnstileAction metadata, calls service
│   │   ├── turnstile-action.decorator.ts  # @TurnstileAction('signup') etc.
│   │   └── turnstile.service.spec.ts
│   ├── signups/
│   │   └── signups.controller.ts   # CHANGED — @UseGuards(TurnstileGuard) on create()
│   └── profile/
│       └── profile.controller.ts   # CHANGED — @UseGuards(TurnstileGuard) on forgotPassword()
└── frontend/src/
    ├── index.html                  # CHANGED — add Turnstile CDN <script> tag
    ├── env.d.ts                    # CHANGED — add turnstileSiteKey to Window.__env
    ├── environments/
    │   ├── environment.ts          # CHANGED — add turnstileSiteKey: '' placeholder
    │   └── environment.local.example.ts # CHANGED — document TURNSTILE_SITE_KEY
    └── app/
        ├── shared/turnstile/
        │   ├── turnstile.component.ts  # NEW — wraps Turnstile widget
        │   └── turnstile.component.spec.ts
        ├── signup/
        │   ├── signup.component.ts     # CHANGED — embed TurnstileComponent, gate submit
        │   └── signup.service.ts       # CHANGED — include turnstileToken in POST body
        └── account/forgot-password/
            └── forgot-password.component.ts  # CHANGED — embed TurnstileComponent, gate submit

libs/
└── api-contract/src/lib/
    ├── signups.ts                  # CHANGED — turnstileToken on CreateSignupRequest
    └── profile.ts                  # CHANGED — turnstileToken on ForgotPasswordRequest

docker/
└── frontend-entrypoint.sh          # CHANGED — write TURNSTILE_SITE_KEY into window.__env
.env.example                        # CHANGED — document TURNSTILE_SECRET_KEY, TURNSTILE_SITE_KEY
```

**Structure Decision**: No new Nx library. `TurnstileModule` lives inside the backend app (backend-only infrastructure). `TurnstileComponent` lives in `apps/frontend/src/app/shared/turnstile/` (app-scoped, not domain logic). The api-contract lib (`libs/api-contract`) is the only shared library touched, per existing patterns.

## Complexity Tracking

_No violations — section not required._
