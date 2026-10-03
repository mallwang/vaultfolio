# Handoff: next session (branch 037-altersvorsorge-retirement-planning)

Nothing is committed yet (all work is in the working tree). Story 1 (US1: manual entry, statement import, pillar views, info tab) is complete and verified. Next batch: Story 2 onward.

## Done (ticked in tasks.md)

T030–T053, T066–T070. Includes parsers, records API, form, card, pillar views, import flow, translations, routes, and the `verify-ui` runs.

State at the end of the last session:

- `npx nx run-many -t lint test build -p @vaultfolio/retirement @vaultfolio/frontend-domain-retirement frontend` is green (frontend lib 57 tests, frontend app 232).
- The backend suite (578 tests) and `backend:openapi:check` were green in the previous session; not re-run since.
- `npm run format:check` is clean.

## Next: Story 2 (T054–T061), then US3 (T062–T065), US5 (T071–T074), polish (T075–T080)

Read `tasks.md`, `plan.md`, `design.md`, `research.md` (R8 has the summary arithmetic) first.

- T054–T058: `libs/retirement/src/lib/summary.ts` (`summarize(records, now)`). Reuse `freshness.ts` (`isOutdated`, `expectedMonthlyOf`, `isIncomplete`). Then `GET /retirement/summary` in the backend controller/service, the `RetirementSummary` DTO in `apps/backend/src/openapi/dto/retirement.ts`, and `npx nx run backend:openapi` (commit `api/openapi.yml`) plus `backend:openapi:check`. `RetirementService.summary()` on the frontend already exists.
- T059–T061: `lib/overview/` component and translation keys. Then add an Overview tab to `retirement-area.component.ts` (its tab list is `statutory|occupational|private|info`) and switch the `''` child route in `apps/frontend/src/app/app.routes.ts` from `redirectTo: 'statutory'` to the overview. The area spec's route table also needs the overview route.
- Add `data-testid`s for new interactive elements, per `docs/frontend/testid-conventions.md`.

## Conventions and gotchas

- Use npm/npx for Nx commands. Pass `--skip-nx-cache` when you need a real re-run.
- Never read `.env` or `apps/frontend/src/environments/environment.local.ts`. Test login for the UI: `claude@allwang.family` / `hiIamClaudeForlocalDevelopment` (sign in via `#email`, `#password`, `form button[type="submit"]`). The account holds a synthetic Earnings career, so don't delete it.
- `RETIREMENT_ENCRYPTION_KEY` is not set in `.env`, so the backend reports Retirement as unavailable (503). For `verify-ui` start the servers with a throwaway key in the shell only:
  `export RETIREMENT_ENCRYPTION_KEY=$(openssl rand -base64 32) && npm run dev`
  (run it with `run_in_background`). Delete any test records you create via the UI afterwards, because they are encrypted with the throwaway key. The previous session's records were already deleted.
- Don't use `pkill -f` with a pattern that matches your own command line, it kills the shell. Stop background servers with TaskStop.
- A new workspace lib that the frontend imports at runtime must be added to `prebundle.exclude` in `apps/frontend/project.json`, otherwise `npm run dev` fails with "Could not resolve './lib/...'". Run `npx nx sync` after adding cross-lib imports (it updated `libs/frontend/domain/retirement/tsconfig.lib.json` last time).
- Lint enforces sonarjs rules (cognitive complexity ≤ 15, no nested ternaries, max 4 nested function levels). Run prettier on changed files.
- Verification scripts are throw-away and live in the scratchpad only. Don't commit them.
- Synthetic test PDFs for upload checks can be generated with Python `reportlab` from the fixture lines in `libs/retirement/src/lib/testing/statements.fixtures.ts`.

## Caveats

- The parsers (DRV Renteninformation, §155 VVG private/Riester, capital account) were written from general knowledge and tested only on invented synthetic documents. They have not been checked against real PDFs (the user's are in `tmp/`, deliberately not read). Labels may need adjusting after the user tries them.
- The DRV link on the info tab is the generic `/DRV/DE/Rente/rente_node.html`; no verified deep link for "three pillars" was found.
- The production build exceeds the initial bundle budget (1.00 MB) by about 26 kB. Not investigated.
- The statutory form requires a payout start (`payoutStart`) besides `projectedMonthly`; this is validation behaviour, not a bug.
- Finish with `speckit-format` and the commit hooks per the implement skill, once the batch is done.
