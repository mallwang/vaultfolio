# Vaultfolio

A personal investment tracking web application — frontend, backend, and database, packaged and
hosted as Docker containers.

Vaultfolio tracks _what you've invested_ (ETFs, shares, gold, and other holdings), not day-to-day
spending. It does not connect to any bank or brokerage APIs — all data is entered manually through
the UI, with CSV/JSON import as a convenience for bulk entry.

## Status

The tech stack scaffold is in place (Nx monorepo, NestJS backend, Angular frontend, SQLite,
Docker Compose orchestration) per the project [constitution](.specify/memory/constitution.md).
Holdings tracking (manual entry, CRUD) exists; broader capabilities (imports, valuation) are still
to come.

## Tech stack

- **Monorepo**: [Nx](https://nx.dev), TypeScript throughout
- **Backend**: [NestJS](https://nestjs.com) (`apps/backend`) — exposes `GET /health` and the
  `/holdings` API
- **Frontend**: [Angular](https://angular.dev) (`apps/frontend`) — renders the health-check page
  and the holdings UI
- **Database**: SQLite, embedded directly in the backend process as a single file (no separate
  database container/service), bind-mounted from the host's `./data` directory
- **Shared libraries**: `libs/api-contract` (types shared between backend/frontend),
  `libs/domain/holdings` (holdings validation/merge logic, Library-First),
  `libs/market-data` (reserved, empty — see `TODO(MARKET_DATA_PROVIDER)`)

## Running the full stack locally

Prerequisites: Docker + Docker Compose (or an equivalent OCI-compatible container runtime). No
local Node.js or database installation is required — everything runs inside containers.

```bash
docker compose up --build
```

- Frontend: <http://localhost:4200>
- Backend health check: <http://localhost:3000/health>
- Database: a single SQLite file under `./data` on the host (`./data/vaultfolio.db`, plus its
  `-wal`/`-shm` WAL-mode siblings while the stack is running) — inspect or back it up directly,
  e.g. `cp -r ./data /backup/`.

Stop the stack with `docker compose down` — `./data` is a host bind mount, not a Docker-managed
volume, so it survives `down` (with or without `-v`) automatically; delete the directory yourself
if you want to wipe all stored data.

### Hot-reload dev mode

The command above builds production images (no live-reload). For day-to-day development, run the
app natively — Nx's `serve` targets already rebuild and reload on save, and SQLite needs no
separate service to pre-start:

```bash
npm run dev
```

This runs `backend`/`frontend` via `nx run-many -t serve -p backend frontend`:

- Frontend: <http://localhost:4200>, rebuilds + reloads on save
- Backend: <http://localhost:3000>, rebuilds + restarts on save

Equivalent to running each piece by hand:

```bash
npm exec nx serve frontend
npm exec nx serve backend
```

## Deploying with Portainer (or any Docker Hub-based host)

`docker-compose.yml` builds images locally from source, which isn't a great fit for Portainer on
a NAS (slow, and Portainer stacks are meant to pull, not build). Use
[`docker-compose.portainer.yml`](docker-compose.portainer.yml) instead — it pulls prebuilt images
from Docker Hub.

1. Get the two images onto Docker Hub, either:

   - **Automatically**: pushing a `v*.*.*` tag runs
     [`.github/workflows/release.yml`](.github/workflows/release.yml), which builds both
     `docker/backend.Dockerfile` and `docker/frontend.Dockerfile` and pushes
     `walefish/vaultfolio-backend`/`walefish/vaultfolio-frontend` as `:latest` and `:<tag>`
     (needs the `DOCKERHUB_USERNAME`/`DOCKERHUB_TOKEN` repo secrets set).
   - **Manually**, from a dev machine (add `--platform linux/amd64,linux/arm64` to
     `docker buildx build` if your NAS's CPU architecture differs from your dev machine's):

     ```bash
     docker login
     docker build -f docker/backend.Dockerfile -t <dockerhub-user>/vaultfolio-backend:latest .
     docker build -f docker/frontend.Dockerfile -t <dockerhub-user>/vaultfolio-frontend:latest .
     docker push <dockerhub-user>/vaultfolio-backend:latest
     docker push <dockerhub-user>/vaultfolio-frontend:latest
     ```

2. In Portainer: **Stacks → Add stack**, paste the contents of `docker-compose.portainer.yml`
   (or point it at this repo's git URL with that file as the compose path). It defaults to
   `walefish`'s Docker Hub images; under **Environment variables** set `DOCKERHUB_USER` only if
   you're pushing to a different account, and `TAG` if you're not deploying `latest`. Set
   `PRIMENG_LICENSE_KEY` there too if you have a [PrimeUI](https://primeng.dev/configuration#license)
   license — it's written into the running container at startup (see
   `docker/frontend-entrypoint.sh`), not baked into the image, so it can differ per deployment
   without a rebuild. Leave it unset to use the free community components (shows a console/UI
   notice, not a functional limitation).
3. Deploy the stack. The frontend is published on port 4200 (`http://<nas-ip>:4200`); the backend
   isn't published by default since the frontend's nginx reaches it over the internal compose
   network and proxies `/api/*` to it — this is also what keeps the frontend from needing to know
   the NAS's hostname/IP at build time. The database persists in `/opt/vaultfolio/data` on the
   host (bind mount) — create the directory before deploying, e.g. `mkdir -p /opt/vaultfolio/data`,
   and back it up the same way as `./data` in local dev (`cp -r /opt/vaultfolio/data /backup/`).

Re-deploying after a new push: re-run the two `docker push` commands, then in Portainer use
**Stacks → your stack → Pull and redeploy** (or `docker compose pull && docker compose up -d`
if managing it from the NAS's shell).

## Frontend environment configuration

`apps/frontend` follows Angular's standard environment-file pattern, under
`apps/frontend/src/environments/`:

- `environment.ts` — committed. Safe defaults only, no secrets (currently just
  `primengLicenseKey: ''`).
- `environment.local.example.ts` — committed template documenting what a local override needs.
- `environment.local.ts` — **gitignored**, never committed. Each developer creates their own
  locally and fills in real values.

During `nx serve frontend` (and `nx build frontend --configuration=development`), the
`development` build configuration in [apps/frontend/project.json](apps/frontend/project.json)
uses Angular's `fileReplacements` to swap `environment.ts` out for `environment.local.ts` at
build time. [app.config.ts](apps/frontend/src/app/app.config.ts) always imports from
`./environments/environment` and gets whichever file was active for that build — no
environment-detection code needed.

Why this exists: `providePrimeNG` requires a PrimeUI license key as of PrimeNG v22, even for the
free community tier (see the PrimeNG section below). That key must stay out of git, but — being a
client-side app — it still ends up embedded in the shipped JS bundle regardless; the
environment-file split protects it from source control and `git log`, not from anyone inspecting
the deployed bundle.

Setup for a new developer:

```bash
cp apps/frontend/src/environments/environment.local.example.ts \
   apps/frontend/src/environments/environment.local.ts
# then edit environment.local.ts and paste your PrimeUI license key
```

Production builds (the default `production` configuration) currently fall back to the empty-key
`environment.ts` unchanged — there's no `fileReplacements` wired up for it yet since the repo has
no deploy pipeline yet. A real deployment will need to generate its own environment file (or
inject the key some other way) as part of its build/CI step.

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

## Releasing

Frontend and backend are released together under a single shared version number, since the
apps only work paired with each other — there is no independent frontend or backend version.
This is handled by [Nx Release](https://nx.dev/docs/features/manage-releases) with
`release.projectsRelationship: "fixed"` (see [nx.json](nx.json)): every release bumps
`apps/frontend/package.json` and `apps/backend/package.json` to the same version, derived from
[Conventional Commits](https://www.conventionalcommits.org) since the last release, tagged as
`v<version>`.

Releases are guided interactively via the `release` Claude Code skill
([.claude/skills/release/SKILL.md](.claude/skills/release/SKILL.md)), which runs a dry-run
preview (including the exact `CHANGELOG.md` entry that would be written) and asks for explicit
confirmation before doing anything. Once confirmed, a single command handles the rest:

```bash
npm run release   # equivalent to: npx nx release --skip-publish
```

This commits the version bump, prepends the new entry to `CHANGELOG.md`, tags the commit
(`v<version>`), pushes to `origin`, and creates the matching GitHub Release — automatically, in
one step. Neither app is published to a package registry (`--skip-publish`); they're deployed as
Docker containers instead. See the skill file for the full step-by-step workflow and the gates
that guard it (must be on `main`, working tree must be clean, dry-run must be reviewed before
anything is pushed).

## Development process

This project uses [Spec Kit](.specify/) to drive development:

1. `/speckit-constitution` — project principles and constraints (done)
2. `/speckit-specify` — define a feature
3. `/speckit-plan` — plan its implementation
4. `/speckit-tasks` — break the plan into tasks
5. `/speckit-implement` — implement the tasks

## Agentic development: PrimeNG

The frontend's UI library is [PrimeNG](https://primeng.dev) — it provides the navigation,
header/toolbar, tables, forms, and chart components the app needs. The component library itself
is MIT-licensed, but as of PrimeNG v22 `providePrimeNG` also requires a PrimeUI license key (free
for the community tier) — see [Frontend environment configuration](#frontend-environment-configuration)
above for how that key is kept out of git. This section covers the AI-agent tooling set up around
PrimeNG so implementation follows current PrimeNG APIs instead of stale training data.

To keep Claude Code accurate on PrimeNG usage (APIs move fast across versions), each developer
installs the official PrimeNG Claude Code plugin locally — it bundles seven skills plus a
read-only MCP server that reads live PrimeNG documentation. This is a **per-developer, user-scope
setup**, not checked into the repo — everyone working on the frontend with Claude Code should run
it once on their machine:

```bash
npx @primeui/cli plugin install --tool claude --library primeng
```

This registers the `primefaces/primeui-plugins` marketplace and installs the `primeng@primeui`
plugin for your Claude Code user profile. Restart Claude Code afterwards, then run `/mcp` to
confirm the `primeng` MCP server is connected.

What it gives Claude Code:

- **Skills** (auto-invoked based on the task): `primeng-setup-installation`,
  `primeng-component-implementation`, `primeng-theming-customization`,
  `primeng-accessibility-icons`, `primeng-migration`, `primeng-audit-troubleshooting`, and
  `primeng-router` (routes to the right one of the above)
- **MCP server** (`@primeng/mcp`, launched on demand via `npx`) exposing read-only tools:
  `list`, `search`, `get_component`, `get_guide`, `get_example`, `get_setup`,
  `validate_usage`, `version`

Installing the plugin does not touch the repo or add dependencies — it only equips your local
Claude Code with up-to-date PrimeNG knowledge. Once you ask Claude Code to add or work with a
PrimeNG component, it uses these skills/MCP tools instead of relying on memorized APIs.

Docs:

- [primeng.dev](https://primeng.dev) — component docs, demos, theming
- [primeng.dev/plugin](https://primeng.dev/plugin) — the Claude Code / Copilot / Cursor plugin
- [primeng.dev/mcp](https://primeng.dev/mcp) — MCP server reference (tools, manual setup for
  other IDEs)
- [primeng.dev/llms](https://primeng.dev/llms) — `llms.txt` / `llms-full.txt` machine-readable
  doc index (consumed automatically by the MCP server/skills; no manual setup needed)

## License

[MIT](LICENSE.md)
