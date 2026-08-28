# Vaultfolio

A personal investment tracking web application — frontend, backend, and database, packaged and
hosted as Docker containers.

Vaultfolio tracks _what you've invested_ (ETFs, shares, gold, and other holdings), not day-to-day
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
header/toolbar, tables, forms, and chart components the app needs, under MIT license.
(PrimeNG itself is not scaffolded into `apps/frontend` yet; this section covers the AI-agent
tooling set up around it so implementation follows current PrimeNG APIs instead of stale
training data.)

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
