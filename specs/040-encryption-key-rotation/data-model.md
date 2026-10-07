# Data Model: Encryption Key Rotation and Recovery

## Domains

Domain ids: `earnings`, `retirement`, `wealth`, `insurances`, `account-overview`.

| Domain           | Encrypted tables (ciphertext column)                        |
| ---------------- | ----------------------------------------------------------- |
| earnings         | `earnings_records`, `earnings_certificates` (`amounts_enc`) |
| retirement       | `retirement_records` (`payload_enc`)                        |
| wealth           | `wealth_snapshots`, `wealth_settings` (`payload_enc`)       |
| insurances       | `insurance_contracts`, `insurance_settings` (`payload_enc`) |
| account-overview | `account_overview_entries` (`payload_enc`)                  |

Each encrypted table already has `key_version INTEGER NOT NULL DEFAULT 1`; no change to those
tables. AAD stays `<table>|<id>|<owner_id>` (settings tables use `owner_id` as id, as today).

## Ciphertext format

`v<N>:<iv b64>:<tag b64>:<ciphertext b64>`

- `N = 1`: legacy, encrypted directly with the master key (read-only after upgrade; rewritten
  during the one-time migration).
- `N >= 2`: encrypted with the domain's data key of version `N`.
- `key_version` column of the row equals `N` and is written together with the ciphertext.

## New tables

### `encryption_data_keys` (entity: Data key)

| Column            | Type    | Notes                                                                                                                     |
| ----------------- | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| `domain`          | TEXT    | PK part, one of the domain ids                                                                                            |
| `version`         | INTEGER | PK part, `>= 2`, increases by 1 per domain                                                                                |
| `wrapped_dek`     | TEXT    | `k1:<iv>:<tag>:<ct>` (AES-256-GCM, AAD `dek\|<domain>\|<version>`); `NULL` once destroyed                                 |
| `kek_fingerprint` | TEXT    | 16 hex chars of `SHA-256("vaultfolio-kek\|" + master key)`; identifies which master key wrapped it; `NULL` once destroyed |
| `status`          | TEXT    | `current`, `retired`, `destroyed`                                                                                         |
| `created_at`      | TEXT    | ISO timestamp                                                                                                             |
| `retired_at`      | TEXT    | nullable                                                                                                                  |
| `destroyed_at`    | TEXT    | nullable                                                                                                                  |

Constraints: `PRIMARY KEY (domain, version)`; `CHECK (status IN ('current','retired','destroyed'))`;
`CHECK ((status = 'destroyed') = (wrapped_dek IS NULL))`; partial unique index
`ON encryption_data_keys (domain) WHERE status = 'current'` (exactly one current key per domain).

State transitions: `current -> retired` (when a newer key is created by re-encryption),
`retired -> destroyed` (explicit admin action, only if no row of any table of the domain still has
that `key_version`). A destroyed key is never reused; its version number is never reissued.

The wrapped data key is also the **key check value**: unwrapping succeeds only with the right
master key.

### `encryption_rotation_runs` (entity: Rotation run)

| Column                 | Type    | Notes                                                                                      |
| ---------------------- | ------- | ------------------------------------------------------------------------------------------ |
| `id`                   | TEXT    | PK (UUID)                                                                                  |
| `domain`               | TEXT    | domain id                                                                                  |
| `kind`                 | TEXT    | `MASTER_KEY`, `DATA_KEY`, `KEY_DESTROY`, `LEGACY_MIGRATION`                                |
| `status`               | TEXT    | `RUNNING`, `SUCCEEDED`, `FAILED`, `INTERRUPTED`                                            |
| `started_at`           | TEXT    | ISO timestamp                                                                              |
| `finished_at`          | TEXT    | nullable while running                                                                     |
| `triggered_by_user_id` | TEXT    | nullable, `ON DELETE SET NULL` on `users(id)`; `NULL` for system runs (startup migration)  |
| `triggered_by_email`   | TEXT    | nullable snapshot so history survives account deletion                                     |
| `from_version`         | INTEGER | nullable (data key version rows moved from; for `MASTER_KEY` unused)                       |
| `to_version`           | INTEGER | nullable (data key version rows moved to or destroyed)                                     |
| `records_total`        | INTEGER | rows to process (0 for `MASTER_KEY`: use keys re-wrapped count in `records_done`)          |
| `records_done`         | INTEGER | progress counter                                                                           |
| `error_code`           | TEXT    | nullable machine code (e.g. `KEY_MISMATCH`, `DB_ERROR`); never key material or row content |

Index on `(domain, started_at DESC)`. At every start, rows still `RUNNING` become `INTERRUPTED`.
Only one `RUNNING` row per domain is allowed (enforced in the service and by a partial unique
index `ON encryption_rotation_runs (domain) WHERE status = 'RUNNING'`).

## In-memory entities (not persisted)

### Master key (entity: Master key)

`ENCRYPTION_KEY` (current) and optional `ENCRYPTION_KEY_PREVIOUS`, read from the environment at
start and shared by all domains. Held as `Buffer`; never
serialized, logged or returned by an API.

### Domain keyring state

| Field                  | Meaning                                                                      |
| ---------------------- | ---------------------------------------------------------------------------- |
| `state`                | `READY`, `KEY_MISSING`, `KEY_MISMATCH`, `MIGRATING`, `REENCRYPTING`          |
| `dataKeys`             | version -> unwrapped data key (RAM only), plus which one is current          |
| `rotationPending`      | at least one non-destroyed data key is wrapped under the previous master key |
| `previousKeyRemovable` | previous key configured and no data key depends on it                        |
| `available`            | `state === READY` (the only state in which encrypt/decrypt work)             |

Transition summary: start -> `KEY_MISSING` | `KEY_MISMATCH` | (`MIGRATING` ->) `READY`;
`READY -> REENCRYPTING -> READY` on admin action or after a failure (failure keeps readable
state, run is `FAILED`). A runtime GCM failure on a row flips the domain to `KEY_MISMATCH` as
today (fail closed). Restoring the key and restarting returns it to `READY` (Story 3).

## Derived view: key status per domain (admin API)

Fields: `domain`, `state`, `currentVersion`, `retiredVersions[]`, `rotationPending`,
`previousKeyRemovable`, `rowsPerVersion` (map version -> count), `lastRun` (summary of the newest
run), `runningRun` (progress when active). Never includes keys, fingerprints or row content.

## Validation rules

- Master key values: base64 of exactly 32 bytes (unchanged); previous key must differ from current.
- Re-encryption request: `confirm` must equal the domain id; refused unless state is `READY` and no
  run is `RUNNING`.
- Destroy request: version must be `retired` and have zero rows at `key_version` equal to it.
- Master key rotation: refused unless state is `READY`; all non-destroyed data keys must unwrap with
  current or previous key, otherwise nothing changes (single transaction).
