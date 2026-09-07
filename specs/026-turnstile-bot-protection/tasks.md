# Tasks: Cloudflare Turnstile Bot Protection

**Input**: Design documents from `specs/026-turnstile-bot-protection/`

**Branch**: `026-turnstile-bot-protection`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Environment config, CDN script, and type declarations — no business logic.

- [x] T001 Add Turnstile CDN `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer>` to `apps/frontend/src/index.html`
- [x] T002 [P] Add `turnstileSiteKey?: string` to the `Window.__env` interface in `apps/frontend/src/env.d.ts` (alongside `primengLicenseKey`)
- [x] T003 [P] Add `turnstileSiteKey: ''` placeholder field to `apps/frontend/src/environments/environment.ts`
- [x] T004 [P] Document `turnstileSiteKey` (with Cloudflare always-pass test key `1x00000000000000000000AA`) in `apps/frontend/src/environments/environment.local.example.ts`
- [x] T005 [P] Add `window.__env.turnstileSiteKey = "${TURNSTILE_SITE_KEY}"` to `docker/frontend-entrypoint.sh` (follow the same pattern as `primengLicenseKey`)
- [x] T006 [P] Add `TURNSTILE_SECRET_KEY`, `TURNSTILE_SITE_KEY`, and `TURNSTILE_HOSTNAMES` entries (with comments) to `.env.example`

**Checkpoint**: Runtime config delivery is wired — both CDN script and `window.__env` ready.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: API contract, the backend `TurnstileModule`, and the shared frontend `TurnstileComponent` — all three user stories depend on these.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### 2a — API Contract (Principle II: must be written before implementation)

- [x] T007 [P] Add `turnstileToken: string` to `CreateSignupRequest` and `'bot_protection_failed'` to `SignupsErrorResponse.error` union in `libs/api-contract/src/lib/signups.ts`
- [x] T008 [P] Add `turnstileToken: string` to `ForgotPasswordRequest` and `'bot_protection_failed'` to `ProfileErrorResponse.error` union in `libs/api-contract/src/lib/profile.ts`

### 2b — Backend TurnstileModule

- [x] T009 Create `@TurnstileAction(action: string)` metadata decorator in `apps/backend/src/turnstile/turnstile-action.decorator.ts` using `SetMetadata('turnstile_action', action)`
- [x] T010 Implement `TurnstileService.verify(token, action, clientIp?)` in `apps/backend/src/turnstile/turnstile.service.ts`:
  - Pre-flight: throw `HttpException(422, 'bot_protection_failed')` if `!token || token.length > 2048`
  - Call `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` with `Content-Type: application/x-www-form-urlencoded` body (`URLSearchParams({ secret, response: token, remoteip: clientIp })`) and `AbortSignal.timeout(10_000)` using `globalThis.fetch`
  - Assert `result.success === true`, `result.action === action`, and `TURNSTILE_HOSTNAMES.has(result.hostname)`
  - Log `warn` on any assertion failure (including `error-codes`); log `error` on network/timeout failure
  - Any failure throws `HttpException(422, 'bot_protection_failed')` (fail-closed)
- [x] T011 Implement `TurnstileGuard` (`CanActivate`) in `apps/backend/src/turnstile/turnstile.guard.ts`:
  - Read `@TurnstileAction` metadata via `Reflector`
  - Extract `req.body.turnstileToken` and `req.ip` / `X-Forwarded-For` header
  - Delegate to `TurnstileService.verify(token, action, clientIp)`
- [x] T012 Create `TurnstileModule` in `apps/backend/src/turnstile/turnstile.module.ts` (providers: `TurnstileService`, `TurnstileGuard`; exports: `TurnstileGuard`, `TurnstileService`)
- [x] T013 Import `TurnstileModule` into `apps/backend/src/app.module.ts`

### 2c — Frontend TurnstileComponent

- [x] T014 Create standalone `TurnstileComponent` in `apps/frontend/src/app/shared/turnstile/turnstile.component.ts`:
  - Inputs: `siteKey: string`, `action: string`
  - Output: `tokenChange: OutputEmitterRef<string | null>`
  - Public method: `reset()` — calls `window.turnstile.reset(widgetId)`
  - On `AfterViewInit`: call `window.turnstile.render(container, { sitekey, action, callback, 'expired-callback', 'error-callback' })`
  - `callback`: emits token string; `expired-callback`: emits `null` (widget auto-renews); `error-callback`: emits `null`
  - On `OnDestroy`: call `window.turnstile.remove(widgetId)`
  - Declare `window.turnstile` type in `apps/frontend/src/env.d.ts`

### 2d — Tests (Constitution Principle IV: required for new module public contract)

- [x] T015 [P] Write `TurnstileService` unit + integration tests in `apps/backend/src/turnstile/turnstile.service.spec.ts`:
  - Mock `globalThis.fetch`; test: happy path (`success: true`, correct action + hostname); `success: false`; action mismatch; hostname not in allow-list; network error; timeout (`AbortError`); pre-flight rejection (empty token, token > 2048 chars)
  - Each failure case: assert `HttpException(422)` thrown and `warn`/`error` logged
- [x] T016 [P] Write `TurnstileComponent` unit tests in `apps/frontend/src/app/shared/turnstile/turnstile.component.spec.ts`:
  - Stub `window.turnstile`; test: `tokenChange` emits on `callback`; emits `null` on `expired-callback` and `error-callback`; `reset()` calls `turnstile.reset(widgetId)`; `remove()` called on destroy

**Checkpoint**: Foundation ready — `TurnstileModule` tested and registered; `TurnstileComponent` ready to embed; API contract types updated.

---

## Phase 3: User Story 1 — Signup Form Bot Protection (Priority: P1) 🎯 MVP

**Goal**: Guard `POST /signups` with Turnstile; embed the widget in the signup form; gate the submit button until a token is received.

**Independent Test**: Use the Cloudflare always-pass test key — load `/signup`, wait for widget to issue a token (submit button enables), fill form, submit; verify account is created. Then submit via `curl` without `turnstileToken`; verify HTTP 422 `bot_protection_failed`.

- [x] T017 [US1] Apply `@TurnstileAction('signup')` and `@UseGuards(TurnstileGuard)` to `SignupsController.create()` in `apps/backend/src/signups/signups.controller.ts`
- [x] T018 [US1] Embed `<app-turnstile>` in `apps/frontend/src/app/signup/signup.component.ts`: bind `[siteKey]="turnstileSiteKey"`, `action="signup"`, `(tokenChange)="onTokenChange($event)"`, `#turnstileRef`; bind `[disabled]="!turnstileToken"` on the submit button; call `turnstileRef.reset()` after successful submission; read `turnstileSiteKey` from `window.__env?.turnstileSiteKey ?? environment.turnstileSiteKey`
- [x] T019 [US1] Include `turnstileToken` in the request body in `apps/frontend/src/app/signup/signup.service.ts` (add it to the `this.http.post(...)` body alongside `email` and `password`)

**Checkpoint**: Signup form bot protection is end-to-end functional and independently testable.

---

## Phase 4: User Story 2 — Forgot-Password Form Bot Protection (Priority: P2)

**Goal**: Guard `POST /profile/forgot-password` with Turnstile; embed the widget in the forgot-password form; gate the submit button until a token is received.

**Independent Test**: Load `/forgot-password`, wait for widget token (submit enables), enter email, submit; verify reset flow proceeds. Then `curl` without `turnstileToken`; verify HTTP 422 `bot_protection_failed` and no reset email sent.

- [x] T020 [US2] Apply `@TurnstileAction('forgot-password')` and `@UseGuards(TurnstileGuard)` to `ProfileController.forgotPassword()` in `apps/backend/src/profile/profile.controller.ts`
- [x] T021 [US2] Embed `<app-turnstile>` in `apps/frontend/src/app/account/forgot-password/forgot-password.component.ts`: bind `[siteKey]="turnstileSiteKey"`, `action="forgot-password"`, `(tokenChange)="onTokenChange($event)"`, `#turnstileRef`; bind `[disabled]="!turnstileToken"` on the submit button; call `turnstileRef.reset()` after successful submission; read `turnstileSiteKey` from `window.__env?.turnstileSiteKey ?? environment.turnstileSiteKey`
- [x] T022 [US2] Pass `turnstileToken` through the service call that backs `forgot-password.component.ts` (update `ProfileService.requestPasswordReset(...)` or the inline HTTP call to include `turnstileToken` in the request body)

**Checkpoint**: Forgot-password form bot protection is end-to-end functional and independently testable.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [x] T023 Run `pnpm nx run frontend:lint` and `pnpm nx run backend:lint` and fix any lint errors introduced by this feature
- [x] T024 Run `pnpm nx run-many -t test --projects=frontend,backend` and confirm all tests pass
- [x] T025 Invoke the `verify-ui` skill and drive the signup and forgot-password pages with Playwright: confirm submit button is disabled on load, enables after token issued, and re-disables after reset (per CLAUDE.md guidelines for frontend changes)
- [x] T026 Walk through quickstart.md Scenarios 1–7 and confirm each expected result is observed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (Setup): No dependencies — start immediately; all T002–T006 are parallel.
- **Phase 2** (Foundational): Depends on Phase 1. T007–T008 parallel; T009 → T010 → T011 → T012 → T013 sequential (module build-up); T014 parallel with the module tasks; T015–T016 parallel with each other, after their subjects are implemented.
- **Phase 3** (US1): Depends on Phase 2 complete. T017 → T018 → T019 sequential (guard first, then frontend wires token into body).
- **Phase 4** (US2): Depends on Phase 2 complete. Can run in parallel with Phase 3 (different files). T020 → T021 → T022 sequential.
- **Phase 5** (Polish): Depends on all desired user story phases complete.

### Within Phase 2 — sequential backbone

```
T009 → T010 → T011 → T012 → T013   (decorator → service → guard → module → register)
T014                                  (component — parallel with above)
T015, T016                            (tests — after T010/T014 respectively)
```

### Parallel Opportunities

```
# Phase 1 — all parallel after T001:
T002, T003, T004, T005, T006

# Phase 2a — parallel:
T007, T008

# Phase 2c + 2b — parallel:
T014 alongside T009–T013

# Phase 2d — parallel with each other:
T015, T016

# Phase 3 and Phase 4 — parallel if two developers:
Developer A: T017 → T018 → T019  (signup)
Developer B: T020 → T021 → T022  (forgot-password)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (signup)
4. **STOP and VALIDATE**: `curl` test + Playwright UI check on signup page
5. Ship / demo

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 → signup protected (MVP)
3. US2 → forgot-password protected
4. Polish → clean lint + full test run + UI verification

---

## Notes

- No new npm packages — `globalThis.fetch` (Node 18+) and the CDN `<script>` tag only.
- `TURNSTILE_HOSTNAMES` MUST NOT include `localhost` or `127.0.0.1` in production (prevents local-dev tokens from bypassing production verification).
- Test keys: always-pass site `1x00000000000000000000AA` / secret `1x0000000000000000000000000000000AA`; always-fail site `2x00000000000000000000AB` / secret `2x0000000000000000000000000000000AA`.
- Production site key (non-secret): `0x4AAAAAAEreSPMcekykFDqv` — goes in `TURNSTILE_SITE_KEY` env var only, not committed with a real value.
- Each `[P]` task touches a different file and has no in-flight dependency on other parallel tasks in the same batch.
