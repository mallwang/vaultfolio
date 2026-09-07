<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

## Verifying UI changes

- Whenever a change touches the frontend (a component, route, style, i18n string, PrimeNG usage),
  invoke the `verify-ui` skill and confirm the change by driving the running app with Playwright —
  don't rely on unit tests or reading the code alone to confirm what renders.
- The skill has the app's URLs/ports, how to read the seeded admin login from `.env`, selector
  conventions (prefer `data-testid`/stable ids over translated label text), and a script template
  to copy into the scratchpad. Verification scripts are throw-away — don't commit them or add a
  real `playwright.config.ts`/e2e project unless the user explicitly asks for permanent e2e
  coverage.
- When implementing or changing a new/changed interactive element that meets
  [docs/frontend/testid-conventions.md](docs/frontend/testid-conventions.md)'s criteria (a
  translated-only label, a repeated row/item, or a PrimeNG-wrapped node with no other stable
  selector), add its `data-testid` as part of that same change — not as a follow-up chore.

<!-- SPECKIT START -->

## Current Feature Plan

Active implementation plan: [specs/026-turnstile-bot-protection/plan.md](specs/026-turnstile-bot-protection/plan.md)
<!-- SPECKIT END -->
