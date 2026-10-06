# Research: Encryption Key Rotation and Recovery

All Technical Context items are resolved; no `NEEDS CLARIFICATION` remains. The current code
(`apps/backend/src/shared/field-crypto.ts`, five `*-crypto.service.ts`, `database.service.ts`)
and the explanation in `tmp/envelope-encryption.html` were the inputs.

## R1: Key hierarchy

- **Decision**: Two levels per domain. The operator key `<DOMAIN>_ENCRYPTION_KEY` (32 bytes,
  base64, unchanged format) is the **master key**; it only wraps **data keys** (random 32 bytes,
  AES-256-GCM, AAD `dek|<domain>|<version>`). Data keys encrypt user rows.
- **Rationale**: Rotating the master key then touches a few small rows instead of all data;
  a lost or wrong master key is detected by failing to unwrap, before any data is touched.
- **Alternatives**: (a) Keep one key and re-encrypt everything on every rotation: slow, needs a
  lock, and does not fix the accidental-loss problem. (b) External KMS: out of scope (spec
  assumption). (c) Derive data keys from the master key via HKDF with a version label: no stored
  key material, but the master key then can never be rotated without re-encrypting data.

## R2: Ciphertext format and key versions

- **Decision**: Keep the existing layout `v<N>:<iv b64>:<tag b64>:<ciphertext b64>`, where `N` is
  the key version. `v1` is the legacy format (encrypted directly with the master key). `N >= 2`
  names a data key version of that domain. The row's existing `key_version` column mirrors `N`
  (indexable "which rows still use version X" queries); the prefix is authoritative.
- **Rationale**: The current format already carries `v1` and all eight tables already have a
  `key_version INTEGER NOT NULL DEFAULT 1` column, so no table changes and legacy rows need no
  conversion before they are readable. AAD `<table>|<id>|<owner_id>` is unchanged, which keeps
  FR-012.
- **Alternatives**: A separate envelope header or JSON blob: needs a parser and breaks the simple
  "starts with `v`" format check used in existing tests.

## R3: Upgrade of existing data (FR-006, SC-005)

- **Decision**: On the first start after the upgrade, per domain: (1) if `v1` rows exist, decrypt
  one with the configured key (current, then previous); on failure the domain is a **mismatch**
  and nothing is written; (2) create data key version 2, wrap it with the current master key;
  (3) re-encrypt all `v1` rows under it in 500-row transactions, recording a
  `LEGACY_MIGRATION` run; (4) domain available. The step is idempotent and resumable (rows are
  selected by `key_version = 1`; the domain is readable throughout because `v1` rows are still
  decryptable with the master key).
- **Rationale**: If `v1` rows stayed, rotating the master key would orphan them, and FR-011
  (old key opens nothing) would be violated. Migrating them once at upgrade keeps "no manual
  step" and makes every row follow the same rules afterwards.
- **Alternatives**: Treat the legacy master key as data key v1 forever: then a leaked old master
  key still reads all legacy data, defeating rotation. Migrate lazily on write: leaves old rows
  unreachable after a master rotation.
- **Note**: The migration runs inside startup before the domain reports available, so the domain
  answers `503` for its duration (seconds for 10k rows). Documented in the operator guide.

## R4: Startup verification and states (FR-007, FR-008, Story 3)

- **Decision**: Per domain the keyring computes exactly one state: `READY`, `KEY_MISSING`
  (env unset or not base64 of 32 bytes), `KEY_MISMATCH` (stored key material or a legacy row does
  not open with current or previous key), plus transient `MIGRATING` / `REENCRYPTING`. Orthogonal
  flags: `rotationPending` (some data key still wrapped under the previous key) and
  `previousKeyRemovable` (previous key configured but unused). An unavailable domain never
  writes: encrypt/decrypt throw the domain's existing `*UnavailableException` (HTTP 503).
  A wrapped-key fingerprint (first 8 bytes of `SHA-256("vaultfolio-kek|" + key)`) is stored with
  each wrapped data key so the admin screen can say "wrapped with previous key" without ever
  holding key material beyond RAM. The wrapped data key's GCM authentication is itself the key
  check value (no separate canary row).
- **Rationale**: A key that opens the wrapped data key is proven correct; a separate canary adds a
  second thing that can drift. A failing domain does not stop the app (clarification) and the
  admin screen stays up.
- **Alternatives**: Crash on mismatch: contradicts the clarification and takes the admin screen
  down with it.

## R5: Master key rotation (Story 1)

- **Decision**: Operator sets `<DOMAIN>_ENCRYPTION_KEY=<new>` and
  `<DOMAIN>_ENCRYPTION_KEY_PREVIOUS=<old>`, restarts, the status shows `rotationPending`; the
  admin triggers "Rotate master key", which in one SQLite transaction unwraps every non-destroyed
  data key with whichever key matches its fingerprint and re-wraps it under the current key.
  Then the operator removes the previous variable. Re-running is idempotent. No domain lock
  (FR-013), no user data touched.
- **Rationale**: Atomic and tiny; the transaction makes interruption harmless.
- **Alternatives**: Automatic re-wrap at boot: hides an operator action that the spec wants
  explicit and reported per domain (FR-003).

## R6: Data key rotation / full re-encryption (Story 2)

- **Decision**: Admin confirms (must type the domain id) -> service creates data key `N+1`
  (previous current becomes `retired`, still readable), sets the in-process lock for that domain
  (`available === false`, so all its routes answer the existing 503), re-encrypts rows with
  `key_version < N+1` in 500-row transactions (decrypt old, encrypt new, `UPDATE`), repeats until a
  sweep finds none, releases the lock, records the run. Destroying the retired key is a separate
  explicit action that is refused while any row still has that version and then deletes the
  wrapped key material (status `destroyed`, tombstone row kept).
- **Rationale**: The lock removes read-modify-write races (FR-004); retire-after-verify avoids data
  loss. A crash leaves rows at mixed but all readable versions (both data keys exist), so the
  domain needs no startup lock afterwards; the run is marked `INTERRUPTED` at the next start and
  re-running continues where it stopped (FR-010).
- **Alternatives**: Online re-encryption with per-row optimistic checks: more code and more
  failure modes for a rare operation; the clarification already accepts a brief lock.

## R7: Domain registry and AAD

- **Decision**: A `DomainEncryptionRegistry` lists per domain: id, env variable names, and the
  encrypted tables with (id column, owner column, ciphertext column, AAD builder). It is the single
  source for startup checks, migration, re-encryption and counts per version. Domain crypto
  services call `DomainKeyringService` with their domain id and keep their current method
  signatures. Settings tables whose primary key is `owner_id` keep their existing AAD.
- **Rationale**: Today the same code is copied five times; one registry also guarantees "each
  domain rotates independently" (edge case) by construction.
- **Alternatives**: Per-domain rotation logic: five copies of the riskiest code in the app.

## R8: Transactions and batching

- **Decision**: Add a small synchronous transaction helper to `DatabaseService` (wrapping
  `better-sqlite3`'s `db.transaction`) and use it for master key re-wrap and each re-encryption
  batch. Between batches the event loop is released so health checks and other domains keep
  responding.
- **Rationale**: SQLite is embedded and single-process (constitution), so a transaction per batch
  is the simplest crash-safe unit.

## R9: Admin operation model and history (clarifications)

- **Decision**: ADMIN-only REST under `/admin/encryption`. Re-encryption returns `202` and runs in
  the background (progress via the status endpoint) because it can take minutes; master key
  rotation returns `200` with the result. A persistent `encryption_rotation_runs` table records
  time, domain, kind (`MASTER_KEY`, `DATA_KEY`, `KEY_DESTROY`, `LEGACY_MIGRATION`), outcome, the
  triggering admin (user id plus e-mail snapshot, `NULL` for system runs) and counts. No key
  material or user data is stored. One running operation per domain (`409` otherwise).
- **Rationale**: Matches the Portainer-only operating model; history gives the audit trail asked
  for in the clarifications.

## R10: Per-user keys later (not precluded)

- **Decision**: No schema for them now. The ciphertext prefix names only a key version, and the
  keyring resolves the key from `(domain, version)`; extending the key identity with a scope
  (e.g. an owner) later only needs a new column on `encryption_data_keys` with a default and a
  lookup by the row owner already available in the AAD.
- **Rationale**: Honours "must not preclude" without building it (YAGNI).

## R11: Admin screen

- **Decision**: New page `/admin/encryption` in the existing `frontend/admin` lib behind
  `adminGuard`: one card per domain (status chip, data key version, wrapped-with-previous hint,
  last run), actions "Rotate master key", "Re-encrypt data" (confirm dialog requiring the domain
  name), "Destroy retired key", and a history table. Strings in de and en; `data-testid` on the
  actions and rows per `docs/frontend/testid-conventions.md`. The page only reads the new status
  endpoint, which works while domains are locked, so the cause is visible (FR-017).
- **Alternatives**: Per-domain admin tabs: contradicts FR-008.

## R12: Configuration, documentation, constitution

- **Decision**: Add the five optional `<DOMAIN>_ENCRYPTION_KEY_PREVIOUS` variables to
  `.env.example`, `docker-compose.yml` and `docker-compose.portainer.yml` (empty default). Operator
  documentation (EN and DE README plus development docs) covers backing up keys apart from the
  database, restore verification, scheduled rotation and emergency rotation after a leak.
  Constitution gets a MINOR amendment (3.12.0): the "Encryption at rest" rule names the master/data
  key hierarchy, and the open "encryption-key rotation" TODO is closed.
- **Rationale**: FR-014, FR-015; the existing rule text predates a rotation design.

## R13: Testing approach

- **Decision**: Library unit tests (wrap/unwrap, tamper, wrong key, version routing, fingerprint
  non-reversibility smoke); backend integration tests on a real temp SQLite file seeded with
  pre-feature `v1` rows (upgrade), covering Stories 1 to 4 for at least two domains plus a table
  driven check that all five domains register correctly; a 10k-row timing check (SC-007) kept as a
  local script/test marked slow. Real personal data is never used; synthetic rows only.
