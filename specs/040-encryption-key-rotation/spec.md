# Feature Specification: Encryption Key Rotation and Recovery

**Feature Branch**: `040-encryption-key-rotation`

**Created**: 2026-10-06

**Status**: Draft

**Input**: User description: "Klären und überarbeiten der Verschlüsselung: Wenn ein Encryption Key rotiert wird oder versehentlich aus der produktiven Konfiguration verschwindet, sind alle existierenden Daten nicht mehr entschlüsselbar. Gewünscht ist eine Lösung (Envelope Encryption mit Key-Versionierung), damit Keys rotiert werden können (z. B. nach einem Leak) und ein versehentlicher Key-Verlust nicht zu Datenverlust führt."

## Clarifications

### Session 2026-10-06

- Q: Should full re-encryption run online or may the domain be briefly locked? → A: Brief lock; the affected domain reports "temporarily unavailable" meanwhile, other domains keep working.
- Q: How does the operator start a rotation or re-encryption? → A: Through an admin-only screen in the app (the instance runs in Portainer containers without convenient shell access); no command-line tool is required.
- Q: Should rotations be traceable afterwards? → A: Yes, a persistent history of all rotations (time, domain, kind, outcome, triggering admin; no key material).
- Q: On a key mismatch at startup, should the app still start? → A: Yes; the app starts, only the affected domain is locked, and the admin screen shows the cause.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Rotate a leaked or aging master key without data loss (Priority: P1)

The operator (self-hosting admin) suspects or knows that a domain's master key has leaked, or wants to rotate it on a schedule. They supply a new master key alongside the previous one in the deployment configuration, start the rotation from the admin screen in the app, and afterwards remove the old key. All users' data stays readable throughout; no user notices anything.

**Why this priority**: Rotating a key today is impossible without losing all data. This is the core gap and the reason for the feature.

**Independent Test**: Seed a domain with encrypted data, rotate the master key, remove the old key from the configuration, restart. All data is still readable and the old key no longer opens anything.

**Acceptance Scenarios**:

1. **Given** a domain with stored encrypted data and a configured current key, **When** the operator configures a new current key plus the old key as previous and runs the rotation, **Then** all data remains readable and, after the old key is removed and the app restarted, still reads correctly.
2. **Given** a completed rotation, **When** someone tries the old master key against the stored data, **Then** it no longer grants access to any key material needed to read the data.
3. **Given** a rotation is interrupted midway, **When** it is run again, **Then** it resumes safely and ends in a fully consistent state with no unreadable records.

---

### User Story 2 - Re-encrypt data after a compromise of key and database (Priority: P2)

If both a master key and a copy of the database may have leaked, rotating only the master key is not enough for data written so far. The operator can additionally trigger a full re-encryption from the admin screen of a domain's data under a freshly generated data key, so that everything stored from then on is protected by material the attacker never saw.

**Why this priority**: Closes the real-leak case. It builds on Story 1 but is needed less often.

**Independent Test**: Trigger full re-encryption on a domain with many records; verify every record is readable afterwards and that the previous data key is retired once no record depends on it.

**Acceptance Scenarios**:

1. **Given** a domain with records under data key version N, **When** the operator triggers re-encryption, **Then** all records are rewritten under version N+1 and remain readable for their owners during and after the process.
2. **Given** re-encryption is running, **When** users access the affected domain, **Then** they see "temporarily unavailable" (no partial or wrong data), all other domains keep working, and the domain is fully available again once re-encryption finishes.
3. **Given** all records now use the new version, **When** the operator retires the old data key, **Then** it is no longer available for reading or writing.

---

### User Story 3 - Missing or wrong key never causes silent damage (Priority: P1)

When a master key is accidentally deleted from the production configuration, mistyped, or replaced, the application detects this at startup, refuses to touch the affected domain, and tells the operator precisely what is wrong. Nothing is overwritten, and restoring the correct key brings everything back.

**Why this priority**: This protects against the most likely operator mistake and is cheap to guarantee. Must never regress.

**Independent Test**: Start the app with the key removed, then with a wrong key, then with the correct key. The first two leave the domain unavailable with a clear message and untouched data; the third restores full function.

**Acceptance Scenarios**:

1. **Given** existing encrypted data and a missing key, **When** the app starts, **Then** the affected domain reports "temporarily unavailable", all other domains work, and the log states which key is missing.
2. **Given** existing encrypted data and a wrong key, **When** the app starts, **Then** the domain stays unavailable, no new data is written under the wrong key, and the log states that the key does not match the stored data.
3. **Given** a domain was unavailable because of a missing key, **When** the operator restores the correct key and restarts, **Then** all prior data is readable again.

---

### User Story 4 - Existing installations upgrade without manual data migration (Priority: P1)

An operator running the current version upgrades. Their existing single-key encrypted data keeps working with the same key they already have, with no export, re-import, or downtime beyond a normal restart.

**Why this priority**: Without a seamless upgrade path the feature would be unusable for existing installations, including the production one.

**Independent Test**: Take a database created by the current version, start the new version with the same keys, and verify all data in every encrypted domain is readable and new writes work.

**Acceptance Scenarios**:

1. **Given** a database created before this feature, **When** the new version starts with the existing keys, **Then** all data in all encrypted domains is readable.
2. **Given** such an upgraded installation, **When** the operator rotates keys, **Then** both old and newly written data are covered.

---

### User Story 5 - Operator can back up and recover keys with confidence (Priority: P3)

The operator has clear, verified guidance on how to back up keys separately from the database, how to restore from backup, and how to check that a restore works.

**Why this priority**: Process and documentation, valuable but does not block functionality.

**Independent Test**: Follow the documented backup and restore steps on a fresh environment and confirm all data is readable.

**Acceptance Scenarios**:

1. **Given** a database backup and a separately stored key backup, **When** the operator follows the documented restore steps on a clean environment, **Then** all encrypted data is readable.
2. **Given** the documentation, **When** an operator needs to rotate keys, **Then** the steps for the leak and non-leak cases are unambiguous.

---

### Edge Cases

- Both previous and current keys are configured but the stored data matches neither: the domain stays unavailable and the log names the mismatch, with no writes.
- A rotation is started while a domain has no data yet: it completes trivially without error.
- A new key is configured without the previous one: this is treated as a wrong key (Story 3), never as a silent re-initialization.
- The previous key remains configured long after rotation: the app keeps working and warns that it can be removed.
- Backup of the database is restored into an environment holding only a newer key: unreadable data is reported clearly; the older key must be supplied as previous.
- Insufficient disk space or crash during bulk re-encryption: no record ends up half-written or unreadable.
- Each encrypted domain (Earnings, Retirement, Wealth, Insurances, Account Overview) can be rotated independently without affecting the others.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST allow an operator to rotate the master key of any encrypted domain without losing or having to re-enter any user data.
- **FR-002**: The system MUST support configuring a current and a previous master key at the same time during rotation.
- **FR-003**: The system MUST provide an admin-only action in the app that re-protects stored key material under the current master key and reports success or failure per domain.
- **FR-004**: The system MUST provide an admin-only action in the app that re-encrypts all of a domain's data under newly generated key material, and MUST make the affected domain temporarily unavailable (not other domains) while it runs, so no write can race with the rewrite.
- **FR-005**: Every stored encrypted value MUST carry its key version so the system always picks the correct key to read it and always the current one to write it.
- **FR-006**: The system MUST remain able to read data written by the current (pre-feature) version using the existing keys, without a manual migration step.
- **FR-007**: At startup the system MUST verify, per domain, that the configured key actually opens the stored data. On mismatch or absence it MUST make that domain unavailable and MUST NOT write any data.
- **FR-008**: A failing or missing key in one domain MUST NOT affect other domains, MUST NOT prevent the application (including the admin screen) from starting, and MUST NOT require any per-domain admin screen: affected domains reuse their existing "temporarily unavailable" behavior.
- **FR-009**: Startup and rotation messages MUST state which domain and which condition (missing key, wrong key, previous key still configured) applies, and MUST NOT include key material or decrypted data.
- **FR-016**: The admin screen MUST be reachable only by administrators and MUST show, per domain, the key status (healthy, key missing, key mismatch, previous key still configured), the data key version in use, and the outcome of the last rotation.
- **FR-019**: The system MUST keep a persistent history of every rotation and re-encryption (time, domain, kind, outcome, triggering admin) visible to administrators in the admin screen; entries MUST NOT contain key material or user data.
- **FR-017**: The admin screen MUST stay usable when one or more domains are unavailable because of a key problem, so the cause is visible without server access, and MUST require explicit confirmation before starting re-encryption.
- **FR-018**: Key values MUST never be entered, displayed, or transmitted through the app; they are only supplied through the deployment configuration.
- **FR-010**: A rotation or re-encryption interrupted at any point MUST be safely re-runnable and MUST leave no record unreadable.
- **FR-011**: After a master key has been rotated and the old key removed, the old key MUST NOT be able to read any key material or data in the system.
- **FR-012**: The system MUST preserve the existing protection that a stored value cannot be moved to another record or another user and still be accepted.
- **FR-013**: Rotation and re-encryption MUST NOT require end users to take any action or log in again; master key rotation (Story 1) MUST NOT make any domain unavailable.
- **FR-014**: Operator documentation MUST cover key backup and storage separate from the database, restore verification, scheduled rotation, and emergency rotation after a suspected leak, in both supported documentation languages.
- **FR-015**: The configuration example MUST describe every new key setting and warn about the consequences of losing a key.

### Key Entities _(include if feature involves data)_

- **Master key**: Secret held by the operator outside the database, one per encrypted domain, protecting that domain's data keys. Can have a current and a previous value during rotation.
- **Data key**: Randomly generated secret per domain and version, stored only in protected form, used to protect user data. Has a version and a status (current, retired, destroyed).
- **Encrypted record**: A stored value tagged with the data key version used to protect it.
- **Key check value**: A small stored value per domain that lets the system prove at startup that the configured key is the right one without reading user data.
- **Rotation run**: A single operator-triggered execution (master key rotation or data re-encryption) with a per-domain outcome.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: An operator can rotate the master key of all five encrypted domains with zero data loss and zero user-visible interruption; full re-encryption causes no data loss and affects only the domain being processed.
- **SC-002**: 100% of records in every encrypted domain are readable after a rotation, verified on a representative dataset including the existing 50-year test career data.
- **SC-003**: Removing or changing a master key results in the affected domain being unavailable within one startup, with zero records modified, in 100% of tested cases.
- **SC-004**: Restoring the correct key after such a failure restores full access to all data in a single restart.
- **SC-005**: Upgrading an existing installation requires no manual data migration; all pre-existing data is readable immediately after the first start.
- **SC-006**: After master key rotation completes, the previous key opens none of the stored data keys or data.
- **SC-007**: A master key rotation on a dataset of at least 10,000 records per domain completes in under one minute; full re-encryption of that dataset completes in under ten minutes.
- **SC-008**: An operator unfamiliar with the feature can complete a documented rotation and a documented restore on first attempt using only the documentation.

## Assumptions

- The operator is the instance administrator with an admin account in the app and access to the deployment configuration (environment variables of the backend container). Ordinary users see no new UI. Changing a key value itself always happens in the deployment configuration, never in the app.
- Master keys continue to be supplied through the existing configuration mechanism; integrating an external key management service is out of scope for this feature.
- All five existing encrypted domains (Earnings, Retirement, Wealth, Insurances, Account Overview) are in scope and share one common approach.
- The current stored format already carries a version marker, which the new design builds on; the existing keys remain valid as the initial master keys.
- Full re-encryption may make the affected domain briefly unavailable; master key rotation does not. Data loss or silent errors are never acceptable.
- Backup and key storage tooling (password manager, secrets files) is chosen by the operator; the feature documents recommendations only.
- Protection against an attacker who already copied the database and key before rotation is out of scope; rotation protects only data written after the compromise is closed.
