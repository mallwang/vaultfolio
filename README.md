# Vaultfolio

A personal investment tracking web application — frontend, backend, and database, packaged and
hosted as Docker containers.

Vaultfolio tracks *what you've invested* (ETFs, shares, gold, and other holdings), not day-to-day
spending. It does not connect to any bank or brokerage APIs — all data is entered manually through
the UI, with CSV/JSON import as a convenience for bulk entry.

## Status

The tech stack scaffold is in place (Nx monorepo, NestJS backend, Angular frontend, PostgreSQL,
Docker Compose orchestration) per the project [constitution](.specify/memory/constitution.md). No
real business capability (holdings, imports, valuation) exists yet — only a minimal end-to-end
health-check slice proving the tiers are wired together.

## Tech stack

- **Monorepo**: [Nx](https://nx.dev), TypeScript throughout
- **Backend**: [NestJS](https://nestjs.com) (`apps/backend`) — exposes `GET /health`
- **Frontend**: [Angular](https://angular.dev) (`apps/frontend`) — renders the health-check page
- **Database**: PostgreSQL 16 (`postgres` service), accessed only through the backend
- **Shared libraries**: `libs/api-contract` (types shared between backend/frontend),
  `libs/domain/example` (a throwaway library demonstrating the Library-First pattern),
  `libs/market-data` (reserved, empty — see `TODO(MARKET_DATA_PROVIDER)`)

## Running the full stack locally

Prerequisites: Docker + Docker Compose (or an equivalent OCI-compatible container runtime). No
local Node.js or PostgreSQL installation is required — everything runs inside containers.

```bash
docker compose up --build
```

- Frontend: <http://localhost:4200>
- Backend health check: <http://localhost:3000/health>
- PostgreSQL: `localhost:5432` (user/password/db: `vaultfolio`)

Stop the stack with `docker compose down` (add `-v` to also drop the `postgres-data` volume, i.e.
delete all stored data).

## Running each project's tests independently

Each tier is independently buildable and testable — no other tier needs to be running:

```bash
npm run test:backend         # apps/backend — no frontend, no browser required
npm run test:frontend        # apps/frontend — no backend required (mocked HTTP)
npm run test:domain-example  # libs/domain/example — proves Library-First isolation
```

(Equivalent to `npx nx test backend` / `frontend` / `domain-example`.)

## Adding a new library

```bash
npx nx g @nx/js:library some-new-domain-lib --directory=libs/domain/some-new-domain-lib
npx nx test some-new-domain-lib
```

See [specs/001-tech-stack-setup/quickstart.md](specs/001-tech-stack-setup/quickstart.md) for the
full validation walkthrough (including verifying project-boundary enforcement and database
persistence across container restarts).

## Development process

This project uses [Spec Kit](.specify/) to drive development:

1. `/speckit-constitution` — project principles and constraints (done)
2. `/speckit-specify` — define a feature
3. `/speckit-plan` — plan its implementation
4. `/speckit-tasks` — break the plan into tasks
5. `/speckit-implement` — implement the tasks

## License

TBD
