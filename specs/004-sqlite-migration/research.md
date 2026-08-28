# Research: SQLite Migration & Self-Hosted Persistence

**Input**: Technical Context unknowns from [plan.md](./plan.md), read against the existing
PostgreSQL implementation in
[apps/backend/src/database/database.service.ts](../../apps/backend/src/database/database.service.ts)
and
[apps/backend/src/holdings/holdings.repository.ts](../../apps/backend/src/holdings/holdings.repository.ts).

## 1. SQLite driver (raw, no ORM)

**Decision**: `better-sqlite3` — a synchronous, native-binding SQLite driver used as a direct
replacement for `pg`'s `Pool`, behind the same `DatabaseService.query()` shape.

**Rationale**: Principle V and the existing `DatabaseService` comment ("Deliberately not an ORM")
require a raw driver, not a query builder or ORM. `better-sqlite3` is the most widely used,
actively maintained synchronous SQLite binding for Node.js; its synchronous API removes a whole
class of connection-pool/async-race concerns that don't apply to a single-file, single-process
database, and it ships a modern bundled SQLite amalgamation (supports `RETURNING`, `STRICT`
tables, `PRAGMA busy_timeout`, WAL mode) without depending on the host's system SQLite version.

**Alternatives considered**:

- **`node:sqlite`** (Node's built-in module, available in Node 24) — rejected for now: still
  documented as experimental/stability-1, so pinning production self-host durability to it is a
  bigger risk than adding one well-established npm dependency. Revisit once it's marked stable.
- **`sqlite3`** (the older node-sqlite3 package) — rejected: async callback/continuation API adds
  complexity for no benefit here, slower, and less actively maintained than `better-sqlite3`.
- **Prisma / Drizzle / TypeORM** — rejected outright: all are ORMs or query builders, which
  Principle V and the existing no-ORM pattern explicitly rule out for this project.

## 2. UUID generation (`gen_random_uuid()` replacement)

**Decision**: Generate the `id` in the application layer with Node's built-in
`crypto.randomUUID()` immediately before `INSERT`, and pass it as a bound parameter instead of a
column `DEFAULT`.

**Rationale**: SQLite has no built-in UUID-generation function equivalent to Postgres's
`gen_random_uuid()`. `crypto.randomUUID()` is already available in Node (no new dependency),
produces standard RFC 4122 v4 UUIDs identical in shape to what Postgres produced, and keeps id
generation testable/inspectable at the application layer rather than hidden in a DB default.

**Alternatives considered**:

- SQLite `hex(randomblob(16))` formatted via a `CHECK`/generated column trick — rejected: fragile
  string-manipulation SQL to hand-format the UUID variant/version bits correctly, harder to test
  than one `crypto.randomUUID()` call.
- The `uuid` npm package — rejected: `crypto.randomUUID()` already does this natively, no reason
  to add a dependency for it.

## 3. `NUMERIC`/decimal handling (exact-decimal guarantee, FR-005)

**Decision**: Store `quantity`, `purchase_price`, `weight_grams`, `current_value`, and the
placeholder `amount` column as **`TEXT`** columns holding the canonical decimal string produced by
`decimal.js` (the same string shape already returned by the `pg` `NUMERIC` columns today). Keep
the per-field positivity `CHECK` constraints, written as `CAST(column AS REAL) > 0` so SQLite
performs a numeric comparison for the _sign_ check without ever storing the value as a float.

**Rationale**: SQLite has no arbitrary-precision decimal type — only `INTEGER`, `REAL`, `TEXT`,
`BLOB`, and `NULL` storage classes, and REAL is IEEE-754 double-precision (unsafe for exact
decimals, violates FR-005). `holdings.mapper.ts` already treats every DB row value for these
columns as a `string | null` that it feeds straight into `new Decimal(value)`
([holdings.mapper.ts:22](../../apps/backend/src/holdings/holdings.mapper.ts#L22)); storing the
same canonical string in a `TEXT` column instead of a `pg` `NUMERIC` column requires **zero
mapper-layer changes** and preserves byte-for-byte round-tripping (SC-005). Casting to `REAL` only
inside the `CHECK` constraint is safe because that comparison only needs to detect a non-positive
value (`<= 0`) — double precision has far more than enough range/precision to distinguish "zero or
negative" from "any positive value with up to 8 decimal places" — the cast never touches the
stored value itself.

**Alternatives considered**:

- Fixed-point `INTEGER` (scaled by, e.g., 10^8) — rejected: would require a new
  scale-in/scale-out conversion at every read/write site (`holdings.mapper.ts`,
  `DatabaseService`), a bigger and riskier change than necessary for a 003-era codebase whose
  mapper layer already speaks decimal strings.
- SQLite `NUMERIC` column affinity — rejected: SQLite's `NUMERIC` affinity actively tries to
  convert text into `INTEGER`/`REAL` storage where possible, which reintroduces the float-storage
  risk this decision exists to avoid.

## 4. `TIMESTAMPTZ` handling

**Decision**: Store `created_at`/`updated_at` as `TEXT` columns holding ISO-8601 UTC timestamps
(`STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')` as the column default; the repository sets
`updated_at` the same way on update).

**Rationale**: SQLite has no native timestamp/timezone type. The application already converts
`created_at`/`updated_at` row values to `Date` via `new Date(row.created_at)`
([holdings.mapper.ts:26](../../apps/backend/src/holdings/holdings.mapper.ts#L26)), which parses
ISO-8601 strings natively — no mapper change needed. UTC-only ISO strings sidestep any need for a
timezone type since the app never stores or reasons about a non-UTC offset.

**Alternatives considered**: SQLite's native `unixepoch`/Julian-day numeric timestamp storage —
rejected: less human-readable when inspecting the `./data` file directly (SC-006 explicitly frames
the file as something an operator can inspect/back up), and would require a mapper change that
ISO-8601 `TEXT` avoids entirely.

## 5. `RETURNING` clause

**Decision**: Keep `INSERT ... RETURNING *` / `UPDATE ... RETURNING *` / `DELETE ... RETURNING id`
unchanged.

**Rationale**: SQLite has supported `RETURNING` natively since 3.35.0 (2021), and `better-sqlite3`
bundles a current SQLite version, so every existing `RETURNING` usage in
[holdings.repository.ts](../../apps/backend/src/holdings/holdings.repository.ts) translates
verbatim — no query rewrite required.

## 6. Concurrent access safety (edge case: overlapping containers during redeploy)

**Decision**: On startup, run `PRAGMA journal_mode = WAL` and `PRAGMA busy_timeout = 5000` (5s)
against the opened database handle.

**Rationale**: WAL mode allows concurrent readers alongside a single writer without corrupting the
file, and `busy_timeout` makes a brief writer/writer contention window (e.g., old and new
container overlapping for a few seconds during a rolling redeploy) block-and-retry instead of
immediately failing with `SQLITE_BUSY`, satisfying the edge case's "brief write-lock wait" allowance.

**Alternatives considered**: Default (`DELETE`) journal mode — rejected: locks the whole database
file for any writer and is more prone to surfacing `SQLITE_BUSY` under the described overlap case.

## 7. `./data` directory/file creation and permission-failure handling (FR-003, edge cases)

**Decision**: `DatabaseService` creates the configured data directory recursively
(`fs.mkdirSync(dir, { recursive: true })`) before opening the database file, wraps the
`better-sqlite3` open + `PRAGMA`/migration calls in a `try`/`catch`, and — on any failure — logs
loudly via `Logger.error` and leaves the service in a "not ready" state so `ping()` keeps
returning `false` rather than throwing an unhandled error that could crash the process. This
mirrors the existing pattern where a startup `migrate()` failure is caught and logged rather than
crashing the app, and lets the health check keep reporting "database unreachable"
(`GET /health`, per the edge case and FR-008).

**Rationale**: The edge case requires startup to "fail loudly ... not silently drop to an
in-memory/ephemeral state" — the app process must stay up (so the health check itself can respond
and report the failure) while making the underlying cause visible in logs, matching how a
container orchestrator/operator diagnoses a bad bind-mount permission.

**Alternatives considered**: Let the constructor throw and crash the Nest app at boot — rejected:
Nest would still start listening in some configurations, but a hard crash removes the health
endpoint's ability to report the specific "database unreachable" state, which is what the edge
case and FR-008 call for.

## 8. Test-time database location

**Decision**: Backend e2e tests (`apps/backend/src/tests/holdings.e2e-spec.ts`) point
`DATABASE_PATH` at a per-test-run temporary file (created under the OS temp dir, removed after the
suite), keeping tests isolated from both each other and from any developer's real `./data`
directory.

**Rationale**: FR-010 requires the existing test suite to keep passing unmodified in
behavior/intent; a temp file (rather than `:memory:`) is used so the tests exercise the same
file-open/WAL/migration code path production does, not a special-cased in-memory branch.
