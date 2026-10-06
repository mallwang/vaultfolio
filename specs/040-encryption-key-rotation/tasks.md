---
description: 'Task list for Encryption Key Rotation and Recovery'
---

# Tasks: Encryption Key Rotation and Recovery

**Input**: Design documents from `/specs/040-encryption-key-rotation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/admin-encryption.openapi.yml, quickstart.md

**Tests**: Included. The constitution (Principles III and IV) requires exact-value unit tests and
real-SQLite integration tests; plan.md and research.md R13 specify them.

**Organization**: Tasks are grouped by user story. Ordering note: the envelope foundation
(Phase 2) already delivers new-install encryption, startup verification states and the legacy
upgrade engine; the stories then add the behaviour and operator surface each one is about.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 master key rotation, US2 data re-encryption, US3 missing/wrong key safety,
  US4 seamless upgrade, US5 backup/recovery docs

## Path Conventions

Nx monorepo: `apps/backend/src/`, `apps/frontend/src/`, `libs/<lib>/src/`. Frontend i18n lives in
`libs/frontend/shared-ui/src/lib/i18n/translations/{de,en}.ts`. Backend e2e tests live in
`apps/backend/src/tests/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: New library and configuration scaffolding

- [ ] T001 Generate the new `scope:shared` library `libs/encryption` (`@vaultfolio/encryption`) following the layout of `libs/earnings` (package.json with `nx.tags: ["scope:shared"]`, `src/index.ts`, `tsconfig*.json`, `jest.config.cts`), then run `npm install` at the repo root so the workspace symlink exists
- [ ] T002 [P] Register the `@vaultfolio/encryption` path in `tsconfig.base.json` and add the dependency to `apps/backend/package.json`
- [ ] T003 [P] Add the five optional `<DOMAIN>_ENCRYPTION_KEY_PREVIOUS` variables (empty default, with warnings about key loss) to `.env.example`, `docker-compose.yml` and `docker-compose.portainer.yml`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Envelope encryption core, persistence, per-domain keyring, domain adapters

**CRITICAL**: No user story work can begin until this phase is complete

### Library `libs/encryption`

- [ ] T004 [P] Implement `libs/encryption/src/lib/envelope.ts`: wrap/unwrap data key (`k1:<iv>:<tag>:<ct>`, AES-256-GCM, AAD `dek|<domain>|<version>`) and encrypt/decrypt of values in the `v<N>:<iv>:<tag>:<ct>` format with caller-supplied AAD (v1 = master key, N>=2 = data key)
- [ ] T005 [P] Implement `libs/encryption/src/lib/key-fingerprint.ts`: `SHA-256("vaultfolio-kek|" + key)` first 8 bytes as 16 hex chars
- [ ] T006 Implement `libs/encryption/src/lib/keyring.ts`: in-memory key ring (current/retired data keys), domain state derivation (`READY`, `KEY_MISSING`, `KEY_MISMATCH`, `MIGRATING`, `REENCRYPTING`) and the `rotationPending` / `previousKeyRemovable` flags (depends on T004, T005)
- [ ] T007 [P] Unit tests in `libs/encryption/src/lib/envelope.spec.ts`: exact round trips, tamper detection, wrong key, AAD mismatch (moved row/owner), version routing, v1 legacy read
- [ ] T008 [P] Unit tests in `libs/encryption/src/lib/key-fingerprint.spec.ts` and `libs/encryption/src/lib/keyring.spec.ts`: determinism, state derivation, pending/removable flags
- [ ] T009 Export the public API from `libs/encryption/src/index.ts`

### Contract DTOs

- [ ] T010 [P] Add `libs/api-contract/src/lib/encryption.ts` (DomainId, DomainState, DomainKeyStatus, RotationRun, request/response types per the contract) and export it from the api-contract index

### Backend persistence and wiring

- [ ] T011 Add tables `encryption_data_keys` and `encryption_rotation_runs` (constraints, partial unique indexes, history index per data-model.md) and a synchronous transaction helper to `apps/backend/src/database/database.service.ts`; extend `database.service.spec.ts`
- [ ] T012 [P] Create `apps/backend/src/encryption/domain-encryption.registry.ts`: per domain id, env variable names (current/previous), encrypted tables with id/owner/ciphertext columns and AAD builder (data-model.md table); spec `domain-encryption.registry.spec.ts` covering all five domains
- [ ] T013 Create `apps/backend/src/encryption/key-store.repository.ts`: CRUD for `encryption_data_keys` and `encryption_rotation_runs`, mark leftover `RUNNING` runs as `INTERRUPTED` at start, rows-per-version counts via the registry; spec `key-store.repository.spec.ts` (depends on T011, T012)
- [ ] T014 Create `apps/backend/src/encryption/domain-keyring.service.ts`: per-domain startup verification (unwrap stored data key with current then previous master key; `KEY_MISSING` / `KEY_MISMATCH`), in-process lock, `encrypt`/`decrypt`/`currentVersion`, bootstrap of data key v2 for empty or new domains, structured log events without key material; spec `domain-keyring.service.spec.ts` (depends on T006, T013)
- [ ] T015 Create `apps/backend/src/encryption/encryption.module.ts` (global) and register it in `apps/backend/src/app/app.module.ts`
- [ ] T016 Make `apps/backend/src/shared/field-crypto.ts` delegate to `@vaultfolio/encryption` while keeping the v1 reader; update its spec
- [ ] T017 [P] Refactor `apps/backend/src/earnings/earnings-crypto.service.ts` to delegate to `DomainKeyringService` (same public API, existing `EarningsUnavailableException` / 503 on unavailable); update its spec
- [ ] T018 [P] Refactor `apps/backend/src/retirement/retirement-crypto.service.ts` likewise; update its spec
- [ ] T019 [P] Refactor `apps/backend/src/wealth/wealth-crypto.service.ts` likewise; update its spec
- [ ] T020 [P] Refactor `apps/backend/src/insurances/insurances-crypto.service.ts` likewise; update its spec
- [ ] T021 [P] Refactor `apps/backend/src/account-overview/account-overview-crypto.service.ts` likewise; update its spec
- [ ] T022 Make the repositories write `key_version` from the keyring instead of the literal `1` in `apps/backend/src/earnings/earnings.repository.ts`, `apps/backend/src/retirement/retirement.repository.ts`, `apps/backend/src/wealth/wealth.repository.ts`, `apps/backend/src/insurances/insurances.repository.ts`, `apps/backend/src/account-overview/account-overview.repository.ts` and update their specs (depends on T017-T021)
- [ ] T023 Run the existing e2e suites (`apps/backend/src/tests/{earnings,retirement,wealth,insurances,account-overview}.e2e-spec.ts`) via `npx nx test backend` and fix regressions; they must pass unchanged in behaviour

**Checkpoint**: New installs encrypt with envelope keys; wrong/missing key states exist; domain APIs unchanged

---

## Phase 3: User Story 4 - Existing installations upgrade without manual migration (Priority: P1) MVP

**Goal**: A pre-feature database starts with the existing keys, all data readable, legacy `v1` rows migrated once under data key v2.

**Independent Test**: Start the new version on a database containing `v1` rows with the same keys; every encrypted domain reads correctly and new writes use the data key.

- [ ] T024 [P] [US4] Create a pre-feature fixture helper (writes `v1` rows with the legacy format for all eight tables on a temp SQLite file) in `apps/backend/src/tests/encryption-e2e.helpers.ts`
- [ ] T025 [US4] Implement `apps/backend/src/encryption/legacy-migration.service.ts`: if `v1` rows exist, prove the key by decrypting one row (current, then previous), create data key v2 wrapped with the current master key, re-encrypt `v1` rows in 500-row transactions (resumable via `key_version = 1`), record a `LEGACY_MIGRATION` run (`triggered_by` null), set `MIGRATING` state meanwhile; wire into the keyring startup (depends on T014, T024)
- [ ] T026 [P] [US4] Unit tests `apps/backend/src/encryption/legacy-migration.service.spec.ts`: idempotent, resumable after partial batch, wrong key writes nothing, empty domain completes trivially
- [ ] T027 [US4] E2E `apps/backend/src/tests/encryption.e2e-spec.ts` (upgrade part): boot the real app on the fixture, assert all five domains readable with exact plaintexts, `key_version` counts, history contains a `LEGACY_MIGRATION` run, new writes use version 2 (SC-005)

**Checkpoint**: Upgrade is safe and automatic

---

## Phase 4: User Story 3 - Missing or wrong key never causes silent damage (Priority: P1)

**Goal**: Missing or mismatching master key makes only that domain unavailable, never writes, and restoring the key restores everything.

**Independent Test**: Start with key removed, then wrong, then correct: first two leave the domain 503 with untouched data and a clear log; the third restores function.

- [ ] T028 [US3] Ensure `DomainKeyringService` blocks all writes in `KEY_MISSING` / `KEY_MISMATCH` (encrypt/decrypt throw the domain unavailable exception, migration never runs on mismatch) and that a runtime GCM failure flips the domain to `KEY_MISMATCH`; log messages state domain and condition (missing key, wrong key, previous key still configured) without key material (FR-007, FR-009) in `apps/backend/src/encryption/domain-keyring.service.ts`
- [ ] T029 [P] [US3] Add the "previous key still configured but removable" warning log and the new-key-without-previous-is-mismatch rule in `apps/backend/src/encryption/domain-keyring.service.ts` (edge cases)
- [ ] T030 [P] [US3] Unit tests in `apps/backend/src/encryption/domain-keyring.service.spec.ts`: missing key, wrong key, new key without previous, both configured but data matches neither, other domains unaffected
- [ ] T031 [US3] E2E in `apps/backend/src/tests/encryption.e2e-spec.ts` (key-loss part): remove key -> domain 503 `*_UNAVAILABLE`, other domains and admin endpoints up, DB rows byte-identical; wrong key -> same; restore key -> all data readable (SC-003, SC-004)

**Checkpoint**: Key loss and mistyping are harmless and diagnosable

---

## Phase 5: User Story 1 - Rotate a leaked or aging master key without data loss (Priority: P1)

**Goal**: Admin re-wraps all data keys under the new master key with no downtime; the old key then opens nothing.

**Independent Test**: Seed data, set new key plus previous, run rotation, remove previous, restart: data readable, old key rejected.

- [ ] T032 [US1] Create `apps/backend/src/encryption/rotation.service.ts` (master key part): refuse unless `READY`, one transaction that unwraps every non-destroyed data key with the key matching its fingerprint and re-wraps under the current key, records a `MASTER_KEY` run (`records_done` = keys re-wrapped, idempotent), one running operation per domain (depends on T014)
- [ ] T033 [US1] Create `apps/backend/src/encryption/encryption-admin.controller.ts`: ADMIN-only `GET /admin/encryption/status` (works while domains are locked; counts only, no keys or fingerprints), `GET /admin/encryption/history` (domain, limit), `POST /admin/encryption/domains/:domain/master-key-rotation`; structured errors (`ENCRYPTION_DOMAIN_NOT_READY` 409, 404 unknown domain); register in `encryption.module.ts`
- [ ] T034 [P] [US1] Unit tests `apps/backend/src/encryption/rotation.service.spec.ts` (master key part): re-wrap, interruption leaves state consistent, idempotent re-run, unknown fingerprint rejects with no change
- [ ] T035 [P] [US1] Controller tests `apps/backend/src/encryption/encryption-admin.controller.spec.ts`: ADMIN-only (401/403), status and history shapes, error codes
- [ ] T036 [US1] OpenAPI (see 031 rule): add `@Api...` decorators and decorated DTO classes under `apps/backend/src/openapi/dto/` for the status, history and master-key-rotation routes, merge the contract paths, then run `npx nx run backend:openapi` and commit the regenerated `api/openapi.yml`
- [ ] T037 [P] [US1] Add Bruno requests under `api/bruno/encryption/` (status, history, master-key-rotation)
- [ ] T038 [US1] E2E in `apps/backend/src/tests/encryption.e2e-spec.ts` (master rotation part, two domains plus table-driven registration of all five): rotate, drop previous, restart, exact plaintexts; old key unwraps nothing (SC-006); no 503 during rotation (FR-013)

**Checkpoint**: Story 1 works through the API

---

## Phase 6: User Story 2 - Re-encrypt data after a compromise (Priority: P2)

**Goal**: Admin generates a new data key and re-encrypts all domain data with only that domain locked; retired key can then be destroyed.

**Independent Test**: Run re-encryption on a domain with many records; all rows end on version N+1 and are readable; the old key is destroyed only when unused.

- [ ] T039 [US2] Extend `apps/backend/src/encryption/rotation.service.ts`: `startReencryption` (confirm equals domain id, state `READY`, no running run; create data key N+1, retire previous, lock domain `REENCRYPTING`, 500-row transactional batches yielding the event loop, sweep until none left, release lock in `finally`, record `DATA_KEY` run with progress) and `destroyDataKey` (version must be `retired`, zero rows at that `key_version`, set `destroyed` tombstone with `wrapped_dek`/fingerprint NULL, `KEY_DESTROY` run)
- [ ] T040 [US2] Add `POST /admin/encryption/domains/:domain/reencryption` (202, body `confirm`, 400 on mismatch) and `POST /admin/encryption/domains/:domain/data-keys/:version/destroy` (409 `ENCRYPTION_KEY_IN_USE` / not retired / busy) to `apps/backend/src/encryption/encryption-admin.controller.ts`
- [ ] T041 [P] [US2] Unit tests in `apps/backend/src/encryption/rotation.service.spec.ts` (data key part): mixed-version state after a crash stays readable and resumes, lock released on failure, destroy refused while in use, destroyed version never reissued
- [ ] T042 [P] [US2] Extend `apps/backend/src/encryption/encryption-admin.controller.spec.ts` for the two new routes
- [ ] T043 [US2] OpenAPI: decorators and DTOs for the re-encryption and destroy routes under `apps/backend/src/openapi/dto/`, run `npx nx run backend:openapi`, commit `api/openapi.yml`; add Bruno requests `api/bruno/encryption/` (reencryption, destroy)
- [ ] T044 [US2] E2E in `apps/backend/src/tests/encryption.e2e-spec.ts` (re-encryption part): affected domain answers 503 while running and others stay up, all rows at N+1 afterwards with exact plaintexts, retired key destroyed, history entries (SC-001, SC-002)
- [ ] T045 [P] [US2] Slow-marked 10k-row timing check for SC-007 (master rotation under 1 minute, re-encryption under 10 minutes) in `apps/backend/src/tests/encryption-performance.e2e-spec.ts` using synthetic rows only

**Checkpoint**: Both rotation kinds work end to end through the API

---

## Phase 7: Admin screen (spans US1, US2, US3; FR-016, FR-017, FR-019)

**Goal**: Admins operate everything from the app without server access.

**Independent Test**: As admin open `/admin/encryption`, see per-domain status (including a locked domain), run a master key rotation, a confirmed re-encryption and a destroy; history lists them.

- [ ] T046 [P] [US1] Add `libs/frontend/admin/src/lib/encryption/encryption.service.ts` (+ `encryption.service.spec.ts`) calling the five endpoints using the DTOs from `@vaultfolio/api-contract`
- [ ] T047 [US1] Add `libs/frontend/admin/src/lib/encryption/encryption.component.ts` (+ spec): one card per domain (status chip, data key version, "wrapped with previous key" hint, removable-previous-key hint, last run, running progress polling), actions "Rotate master key", "Re-encrypt data" (confirm dialog requiring the domain id), "Destroy retired key", and a history table; `data-testid` on actions and rows per `docs/frontend/testid-conventions.md`; usable while domains are locked
- [ ] T048 [P] [US1] Add German and English strings in `libs/frontend/shared-ui/src/lib/i18n/translations/de.ts` and `libs/frontend/shared-ui/src/lib/i18n/translations/en.ts` (including `pageTitle.adminEncryption`); translation parity spec must pass
- [ ] T049 [US1] Export the component from `libs/frontend/admin/src/index.ts`, add the `encryption` child route (adminGuard inherited, `title: 'pageTitle.adminEncryption'`) in `apps/frontend/src/app/app.routes.ts` and the tab in `libs/frontend/admin/src/lib/admin.component.ts` (+ spec updates)
- [ ] T050 [US2] Verify the screen in the running app with Playwright per the `verify-ui` skill (status, rotation, confirm dialog, history, locked-domain case); throw-away script, do not commit

**Checkpoint**: Operators can perform all operations in the UI

---

## Phase 8: User Story 5 - Backup and recovery guidance (Priority: P3)

**Goal**: Unambiguous operator documentation for backup, restore, scheduled and emergency rotation.

**Independent Test**: Follow the documented steps on a clean environment; all data readable (quickstart.md scenarios).

- [ ] T051 [P] [US5] Document key backup apart from the database, restore verification, scheduled rotation, emergency rotation after a leak, and upgrade note (brief 503 during migration) in `README.md` and `docs/development.md`
- [ ] T052 [P] [US5] German equivalents in `README.de.md` and `docs/development.de.md` (FR-014)
- [ ] T053 [US5] Run through `specs/040-encryption-key-rotation/quickstart.md` on a clean environment and correct any step that does not work as written

---

## Phase 9: Polish and Cross-Cutting Concerns

- [ ] T054 Amend `.specify/memory/constitution.md` to 3.12.0: "Encryption at rest" names the master/data key hierarchy and closes the key-rotation TODO (update version/date lines and sync-impact note)
- [ ] T055 [P] Add `data-testid` coverage check and update `docs/frontend/testid-conventions.md` only if new patterns were introduced
- [ ] T056 Run `npx nx run-many -t lint,test,build` (affected projects) and `npx nx run backend:openapi:check`; fix findings
- [ ] T057 [P] Run `knip` (`npx knip`) and remove any unused exports or files introduced by this feature
- [ ] T058 Run the `speckit-sonar-local` / `speckit-sonar-validate` checks and the coverage guide (`.specify/memory/test-coverage-guide.md`) for the new files

---

## Dependencies and Execution Order

- Phase 1 -> Phase 2 (blocks everything) -> stories.
- US4 (Phase 3) and US3 (Phase 4) both depend only on Phase 2 and are mostly independent; US4 first, because it protects existing production data.
- US1 (Phase 5) depends on Phase 2 (and uses the keyring from T014); US2 (Phase 6) extends `rotation.service.ts` and the controller from US1, so it follows US1.
- Phase 7 (admin screen) depends on the endpoints of Phases 5 and 6 (T033, T040) and the DTOs (T010).
- US5 docs (Phase 8) can start after the behaviour is stable; T051/T052 may run in parallel with Phase 7.
- Polish last. T054 may run any time after Phase 2.

### Within-phase notes

- T004/T005 before T006; T011/T012 before T013; T013 before T014; T017-T021 before T022.
- Controller tasks T033/T040 edit the same file as each other and must not run in parallel; same for the `encryption.e2e-spec.ts` tasks (T027, T031, T038, T044).

## Parallel Execution Examples

- Phase 2 library: T004 and T005 together, then T006; T007 and T008 together afterwards.
- Phase 2 adapters: T017, T018, T019, T020, T021 together.
- Phase 7: T046 and T048 together while T047 is written.
- Phase 8: T051 and T052 together.

## Implementation Strategy

- **MVP**: Phase 1 + Phase 2 + US4 (Phase 3) + US3 (Phase 4). This delivers envelope encryption, a safe automatic upgrade and fail-closed key checking, which already fixes the accidental-loss problem. It is the smallest shippable increment because nothing can ship without the upgrade path.
- **Increment 2**: US1 (master key rotation API + admin screen status and rotate action).
- **Increment 3**: US2 (data re-encryption, destroy), then docs (US5) and polish.
- Do not release before US1 and US5 docs if production operators are expected to rotate keys.
