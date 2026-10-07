# Implementation Plan: Encryption Key Rotation and Recovery

**Branch**: `040-encryption-key-rotation` | **Date**: 2026-10-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/040-encryption-key-rotation/spec.md`

## Summary

Replace the single "operator key encrypts all data directly" scheme of the five encrypted domains
(Earnings, Retirement, Wealth, Insurances, Account Overview) with **envelope encryption and key
versioning**. The operator-supplied key (one `ENCRYPTION_KEY` shared by all domains) becomes a **master key** that
only wraps randomly generated, versioned **data keys**; the data keys live wrapped in the database
and encrypt the user data. Consequences:

- Master key rotation = re-wrap a handful of data keys (seconds, no downtime, no data touched).
- Data key rotation = new data key version plus a locked-domain bulk re-encryption (leak case).
- Startup verifies, per domain, that the configured master key opens the stored key material
  (or, before the upgrade, one legacy row); on mismatch/absence the domain is unavailable and
  nothing is written.
- Existing installations upgrade on the first start: legacy `v1` rows are re-encrypted once under
  the first data key, using the configured `ENCRYPTION_KEY`.
- Admins operate everything from a new admin screen (status, rotate master key, re-encrypt,
  destroy retired key, history); key values are only ever supplied via environment variables.

The pure key-handling logic becomes a new framework-independent library `libs/encryption`; the
backend gets one shared `EncryptionModule` that the five existing `*-crypto.service.ts` classes
delegate to, so repositories and routes keep their current behaviour (`503 *_UNAVAILABLE`).

## Technical Context

**Language/Version**: TypeScript (Node.js LTS runtime for the backend), Angular for the admin screen

**Primary Dependencies**: NestJS, Angular, PrimeNG, Nx. No new third-party dependency: Node's
built-in `node:crypto` (AES-256-GCM, already used by `apps/backend/src/shared/field-crypto.ts`).

**Storage**: SQLite via the existing `DatabaseService` (`better-sqlite3`); two new tables
(`encryption_data_keys`, `encryption_rotation_runs`). The `key_version` column already exists on
all eight encrypted tables. See [data-model.md](data-model.md).

**Testing**: Jest per existing project setup; exact round-trip assertions; integration/e2e tests
against a real temp SQLite file (Principle IV).

**Target Platform**: Linux server container (backend, SQLite bind mount), evergreen browsers

**Project Type**: web-service + frontend, Nx monorepo

**Performance Goals**: Master key rotation under 1 minute and full re-encryption under 10 minutes
for 10,000 records per domain (SC-007); AES-GCM on 10k small rows is well within this using
500-row transactional batches.

**Constraints**: Single backend process (SQLite) so the per-domain lock is in-process; keys never
enter the API, logs or history; ciphertext stays bound to table/row/owner via AAD (FR-012);
crash-safe at every step (FR-010); no change to what end users see.

**Scale/Scope**: 5 domains, 8 encrypted tables, 1 new lib, 1 new backend module, 1 new admin page,
5 admin endpoints.

## Constitution Check

_Gate: passes before Phase 0; re-checked after Phase 1 design._

| Principle / rule                                 | Assessment                                                                                                                                                                                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I. Library-First                                 | PASS. Key wrapping, ciphertext format and key-ring state logic live in new `libs/encryption` (`scope:shared`, no Nest, no DB), unit-tested in isolation. The backend module is only wiring and persistence.                    |
| II. API-First                                    | PASS. `/admin/encryption/*` contract written first ([contracts/admin-encryption.openapi.yml](contracts/admin-encryption.openapi.yml)), merged into `api/openapi.yml`, structured error bodies, Bruno requests added.           |
| III. Test Coverage                               | PASS. Exact-value assertions (decrypted plaintexts, row counts per version, statuses). Money is never interpreted by rotation, only re-encrypted as opaque payloads.                                                           |
| IV. Integration Testing                          | PASS. e2e tests boot the real app on a temp SQLite file with a pre-feature fixture (legacy `v1` rows) and cover upgrade, master rotation, re-encryption, missing/wrong key.                                                    |
| V. Observability, Versioning, Simplicity         | PASS. Structured log events carry domain, condition and counts only. Ciphertext format and API are versioned. Simplicity: no external KMS, no per-user keys, no CLI, no new dependency; each element is justified in research. |
| Sensitive Personal Data: encryption at rest      | PASS. Still a server-held operator key, fail closed when missing/invalid. The rule only says "a server-held key", so a MINOR amendment (3.12.0) documents the master/data key hierarchy and closes the rotation TODO.          |
| Sensitive Personal Data: owner-only, log hygiene | PASS. The admin screen exposes status, versions and counts only, never records or key material; AAD binding preserved.                                                                                                         |
| Technology: embedded SQLite, bind mount, no CLI  | PASS. Operations are in-app (admin screen), per clarification; backups remain a filesystem copy of the data directory plus a separate key backup (documented).                                                                 |

Post-design re-check: PASS, no violations; Complexity Tracking stays empty.

## Project Structure

### Documentation (this feature)

```text
specs/040-encryption-key-rotation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── admin-encryption.openapi.yml
└── tasks.md              # created later by /speckit-tasks
```

### Source Code (repository root)

```text
libs/
├── encryption/                         # NEW, scope:shared, framework-independent
│   └── src/lib/
│       ├── envelope.ts                 # wrap/unwrap data key, encrypt/decrypt with versioned format
│       ├── key-fingerprint.ts          # non-reversible master-key id for status messages
│       ├── keyring.ts                  # in-memory key ring: current/retired DEKs, state derivation
│       └── *.spec.ts
└── api-contract/src/lib/encryption.ts  # NEW DTOs shared by backend and admin screen

apps/backend/src/
├── encryption/                         # NEW global module
│   ├── encryption.module.ts
│   ├── domain-encryption.registry.ts   # encrypted tables + AAD rule
│   ├── key-store.repository.ts         # encryption_data_keys, encryption_rotation_runs
│   ├── domain-keyring.service.ts       # per-domain state, lock, encrypt/decrypt
│   ├── legacy-migration.service.ts     # one-time v1 -> data key re-encryption on upgrade
│   ├── rotation.service.ts             # master key re-wrap, data key re-encryption, destroy
│   ├── encryption-admin.controller.ts  # /admin/encryption/*, ADMIN only
│   └── *.spec.ts
├── database/database.service.ts        # new tables + synchronous transaction helper
├── shared/field-crypto.ts              # delegates to libs/encryption (v1 reader kept)
├── {earnings,retirement,wealth,insurances,account-overview}/*-crypto.service.ts
│                                       # delegate to DomainKeyringService; same public API
├── {…}/*.repository.ts                 # write key_version from the keyring instead of the literal 1
└── tests/encryption.e2e-spec.ts        # upgrade, rotation, re-encryption, key loss, history

libs/frontend/admin/src/lib/encryption/ # NEW admin page: status cards, actions, history table
apps/frontend/src/app/app.routes.ts     # + admin/encryption route (adminGuard)
apps/frontend/src/assets/i18n/{de,en}   # new strings (de + en)

api/openapi.yml, api/bruno/             # contract + requests
.env.example, docker-compose*.yml       # + ENCRYPTION_KEY(_PREVIOUS)
README.md, README.de.md, docs/development*.md   # operator guidance
.specify/memory/constitution.md         # MINOR amendment 3.12.0
```

**Structure Decision**: One new library (`libs/encryption`) holds the pure envelope logic so it is
testable without Nest or SQLite (Principle I). One new global backend module owns persistence,
the per-domain lock, startup verification, rotation and the admin API. The five domain crypto
services stay as thin adapters so no repository, guard or route behaviour changes other than the
`key_version` value written. The admin UI is a new page inside the existing `frontend/admin` lib.

## Complexity Tracking

No constitution violations to justify.
