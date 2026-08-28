# Deployment Contract: `docker-compose.yml`

This feature's externally-visible interface is not a new HTTP API (the REST contract in
`specs/003-manual-holdings-entry/contracts/holdings-api.md` and the `GET /health` contract are
unchanged by this migration) — it's the **docker-compose stack shape** an operator runs. This
document is the contract for that.

## Services (after this feature)

| Service    | Before (003)                                                                                                                           | After (004)                                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `postgres` | Present — `postgres:16`, port `5432`, `postgres-data` named volume                                                                     | **Removed** (FR-004)                                                                                                            |
| `backend`  | `depends_on: postgres (service_healthy)`, `DATABASE_HOST`/`DATABASE_PORT`/`DATABASE_USER`/`DATABASE_PASSWORD`/`DATABASE_NAME` env vars | No `depends_on` database service; single `DATABASE_PATH` env var (default `/data/vaultfolio.db`); new bind mount `./data:/data` |
| `frontend` | Unchanged                                                                                                                              | Unchanged                                                                                                                       |

## Environment variables (`backend` service)

| Variable            | Before                  | After                                                                                 |
| ------------------- | ----------------------- | ------------------------------------------------------------------------------------- |
| `PORT`              | `3000`                  | `3000` (unchanged)                                                                    |
| `CORS_ORIGIN`       | `http://localhost:4200` | unchanged                                                                             |
| `DATABASE_HOST`     | e.g. `postgres`         | **removed**                                                                           |
| `DATABASE_PORT`     | `5432`                  | **removed**                                                                           |
| `DATABASE_USER`     | `vaultfolio`            | **removed**                                                                           |
| `DATABASE_PASSWORD` | `vaultfolio`            | **removed**                                                                           |
| `DATABASE_NAME`     | `vaultfolio`            | **removed**                                                                           |
| `DATABASE_PATH`     | n/a                     | **new** — path to the SQLite file inside the container, default `/data/vaultfolio.db` |

## Volumes

| Before                                                                             | After                                                                                                    |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Named volume `postgres-data` mounted into `postgres` at `/var/lib/postgresql/data` | **Removed.** Replaced by a host bind mount: repo-root `./data` → `/data` inside the `backend` container. |

`./data` is a plain directory under the repository root (not a Docker-managed named volume), so an
operator can inspect, copy, and back it up directly from the host filesystem (SC-006), and it
survives `docker compose down` (with or without `-v`, since it's not a named volume at all).

## Health check contract (unchanged)

`GET /health` continues to report the database connection state exactly as before (FR-008) — only
what "connected" checks against changes (a SQLite file open + `PRAGMA`/query success instead of a
`pg` pool ping).

## Startup ordering

`backend` no longer has a `depends_on` on any database service (there isn't one) — it owns its
database file directly and creates `./data`/the `.db` file itself on first boot if missing
(FR-003). `frontend` keeps its existing `depends_on: backend (service_healthy)`.
