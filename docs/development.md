# Local development setup

**[Deutsche Version](development.de.md)**

This document collects everything used locally to keep the codebase maintainable and secure:
linting, formatting, dependency hygiene, secret scanning, and the git hooks that enforce them
before code ever reaches CI. For running the app itself (Docker Compose, hot-reload dev mode,
environment variables), see the [README](../README.md#running-the-full-stack-locally).

## Prerequisites

- Node.js `>=22`, npm `>=10` (see [package.json](../package.json) `engines`)
- Run `npm ci` once after cloning — this also runs the `prepare` script, which installs the git
  hooks (via [Husky](https://typicode.github.io/husky/)) and generates the frontend's local
  environment file if it's missing (see [tools/ensure-frontend-env.mjs](../tools/ensure-frontend-env.mjs)
  and [Frontend environment configuration](../README.md#frontend-environment-configuration) in the
  README).

## Linting

[ESLint](https://eslint.org) is configured centrally in [eslint.config.mjs](../eslint.config.mjs)
(flat config), built on the Nx ESLint plugin plus
[eslint-plugin-sonarjs](https://github.com/SonarSource/eslint-plugin-sonarjs) for additional code-smell
and bug-pattern rules, and [@vitest/eslint-plugin](https://github.com/vitest-dev/eslint-plugin-vitest)
for the libs that run on Vitest.

Two things are enforced at lint time rather than just by convention or code review:

- **`@nx/enforce-module-boundaries`** — the domain-library architecture described in the
  [README](../README.md#frontend-domain-library-architecture) (e.g. a frontend domain library
  must not import another domain library) is enforced via project tags and `depConstraints`.
- **sonarjs rules** — duplicated logic, overly complex conditionals, and other bug-prone patterns.
  A few sonarjs rules (hardcoded-password/IP heuristics, `assertions-in-tests`) are switched off
  for `*.spec.ts`/`*.e2e-spec.ts` only, since they key off naming patterns and structures that are
  expected in test code but would be real problems in source — see the comments in
  `eslint.config.mjs` for why each one is scoped that way.

Run it via Nx, not `eslint` directly:

```bash
npm run lint          # nx run-many -t lint — every project
npm run lint:fix       # same, with --fix
npx nx affected -t lint --base=main   # only projects affected by your changes (what CI runs on PRs)
```

## Formatting

[Prettier](https://prettier.io) formats everything (`.prettierrc`: single quotes, 100-char print
width). `.prettierignore` excludes build output and Handlebars notification templates (its bundled
`.hbs` parser doesn't support the standalone partials used in `libs/notifications`).

```bash
npm run format        # prettier --write .
npm run format:check  # prettier --check . — what CI runs
```

## Type checking

```bash
npm run typecheck                              # nx run-many -t typecheck
npx nx affected -t typecheck --uncommitted     # only uncommitted changes — what the pre-push hook runs
```

## Unused files, exports, and dependencies (knip)

[Knip](https://knip.dev) scans the whole workspace for unused files, unused exports, and unused or
unlisted dependencies. Configuration is in [knip.json](../knip.json), with a per-workspace
`ignoreDependencies` list for cases knip can't resolve on its own (peer deps only referenced via
config, optional dependencies used conditionally, etc.) — each entry there should stay narrow and
justified rather than growing into a blanket suppression.

```bash
npm run knip
```

Knip has no "affected" mode — it always analyzes the entire workspace. It runs in CI (`.github/workflows/ci.yml`)
but is currently `continue-on-error: true` there until the existing findings are triaged; run it
locally before adding new files or dependencies so the baseline doesn't grow.

## Secret scanning

[secretlint](https://github.com/secretlint/secretlint) (with the
`@secretlint/secretlint-rule-preset-recommend` ruleset, see `.secretlintrc.json`) scans staged
files for accidentally committed credentials, keys, and tokens. It runs on every `git commit` (via
lint-staged, below) and again over the whole tree in CI (`npx secretlint "**/*"`).

## Git hooks (Husky)

Hooks live in [.husky/](../.husky/) and are installed automatically by `npm run prepare` (part of
`npm ci`/`npm install`).

- **pre-commit** — runs [lint-staged](https://github.com/okonet/lint-staged) (config in
  `package.json`), which runs against only the files staged for commit:
  - `secretlint` on every staged file
  - `eslint --fix` on staged `.ts`/`.tsx`/`.js`/`.jsx`/`.cjs`/`.mjs` files
  - `prettier --write` on staged `.ts`/`.tsx`/`.js`/`.jsx`/`.cjs`/`.mjs`/`.json`/`.html`/`.scss`/`.css`/`.md` files
- **pre-push** — runs the checks that are worth paying for once per push rather than once per commit:
  - `npx nx affected -t typecheck --uncommitted`
  - `npm run test:coverage:affected`

These hooks are the local-first line of defense: catching a lint error, an unformatted file, a
type error, or a leaked secret before it's pushed is cheaper than catching it in CI.

## Dependency and supply-chain checks (CI only)

Not run locally, but part of the same maintainability/security net:

- **[Dependency Review](../.github/workflows/dependency-review.yml)** — on every PR, fails the
  build if a newly introduced dependency (direct or transitive) has a known vulnerability, unless
  explicitly allow-listed (see the `allow-ghsas` comment in that workflow for the one current
  exception and why it's safe).
- **[step-security/harden-runner](https://github.com/step-security/harden-runner)** — wraps every
  CI job to audit outbound network egress from the runner.
- **[SonarQube Cloud](../.github/workflows/ci.yml)** — static analysis and coverage, gated on the
  project's quality gate (badges in the [README](../README.md)); see
  [sonar-project.properties](../sonar-project.properties) for scan configuration. Use the
  `speckit-sonar-validate` Claude Code skill to check the quality gate for the current branch/PR
  before considering a change done. To catch findings _before_ pushing, `npm run sonar:local`
  (`-- --cov` to refresh coverage first) runs the analysis against a local SonarQube Community Build
  in Docker (see [docker-compose.sonar.yml](../docker-compose.sonar.yml)); it needs a one-time
  `SONAR_LOCAL_TOKEN` and uploads nothing to the cloud. The Community Build lags the cloud on newly
  released rules, so treat it as an early filter, not a replacement. It is also an optional
  `after_implement` Speckit hook (`speckit-sonar-local`).

## On-device text recognition (scans)

PDFs without a text layer are read in the browser (specs/034). The engine sits behind the
`TextRecogniser` port (`libs/frontend/domain/earnings/src/lib/pdf/text-recogniser.ts`, injected via
`TEXT_RECOGNISER`; specs use `FakeTextRecogniser`). The only adapter, `tesseract-recogniser.ts`,
renders pages with PDF.js and reads them with `tesseract.js` (German, LSTM) in one worker per file;
`ocr-layout.ts` turns the word boxes into the parsers' line model (`origin: 'RECOGNISED'`).

- **Assets:** worker, WASM core (`tesseract-core-*-lstm.wasm.js`), `deu.traineddata.gz` and licence
  files are copied from `node_modules` to `assets/tesseract/` by the asset globs in
  `apps/frontend/project.json`; nothing is fetched from a CDN, nothing is cached
  (`cacheMethod: 'none'`), and everything is lazy-loaded after the user's consent. `tesseract.js`,
  `tesseract.js-core` and `@tesseract.js-data/deu` are declared in both `package.json` files.
- **Persisted marker:** `recognisedText` (API) ⇄ `ocr_read` (column of `earnings_imports`); it has
  no effect on checks or the fingerprint.
- **Personal data:** recognised text is scanned leniently (`scanDocument(doc, { lenient: true })`,
  shape-only IBAN/tax ID/social-security matching); the server scan stays strict and unchanged.
- **Real-engine spec (opt-in):** `ocr.integration.spec.ts` renders a synthetic payslip and reads it
  with the real engine; it is skipped when the engine, the language data or `@napi-rs/canvas` are
  not installed. Run it with
  `npx nx test @vaultfolio/frontend-domain-earnings --include='**/pdf/ocr.integration.spec.ts'`.

## Parser requests (privacy exception)

Earnings payslips never leave the device (specs/032, FR-008/FR-009) — with one opt-in exception
(constitution 3.7.0, specs/033): a user whose PDF is rejected as _format not supported yet_ may
send an **anonymized, rebuilt layout** so the parser can be written.

- **What is sent:** one `POST /requests` with Layout Submission v1 (structured words and
  positions only, never a file). Personal data is removed on the device, every number is replaced
  by a random one of the same shape, unknown words are masked unless the user keeps them. The
  server re-validates strictly (exact keys, limits, character rule), scans again for personal
  data (a hit rejects the request) and **writes the sample PDF itself** — text only, no scripts,
  links, files or forms.
- **Who sees it:** administrators, in the portal only (Admin → Requests, audited download); the
  notification mail contains a link and no attachment. Operators with database access can see the
  anonymized sample too.
- **Retention:** sample and stored rule draft are deleted 30 days after Done/Rejected (hourly
  sweep, reopening cancels); account deletion removes the user's requests.
- **Rule hints** (optional markings of figure types/columns) are shown to administrators as
  hints and are **never executed**: nothing in `libs/earnings/src/lib/parsers/` imports
  `rule-draft.ts` (asserted by a test).
- **Adding a request type:** one row in `libs/requests` (`REQUEST_TYPES`), a backend
  `RequestTypeHandler` registered in `RequestsModule`, and an optional admin payload view in
  `libs/frontend/admin/src/lib/requests/payload-views/`; the table, API and mail mechanism need no
  change.

## Synthetic test data (limit tests and demo accounts)

Throw-away generators fill a test account with invented data. They are for local and demo use only —
never point them at an account with real data. Two entry points seed all features at once:

- `node tools/seed-comprehensive.mjs` — load and limit set for the Admin test account.
- `node tools/seed-realistic.mjs` — plausible, edge-case-free set for the Member test account.

Both upload through the REST API of a running backend and replace the account's earnings, wealth,
retirement and insurances data. Passwords come from `--password` or `.env.local`
(`VAULTFOLIO_TEST_PASSWORD` / `VAULTFOLIO_MEMBER_PASSWORD`). Requirements, options and the
per-feature scripts (`--profile comprehensive|realistic`) are described in
[tools/README.md](../tools/README.md).

The output is deterministic, so a reset is reproducible.

## Encryption key rotation (developer notes)

The five encrypted domains (earnings, retirement, wealth, insurances, account overview) share
`libs/encryption` (envelope primitives, key fingerprint, in-memory keyring) and the backend
`EncryptionModule` (`apps/backend/src/encryption`: key store tables `encryption_data_keys` and
`encryption_rotation_runs`, per-domain `DomainKeyringService`, `RotationService`, admin routes under
`/admin/encryption`). The per-domain `*-crypto.service.ts` classes are thin adapters; a new encrypted
domain registers its tables in `domain-encryption.registry.ts`; all domains share the `ENCRYPTION_KEY` master key (`ENCRYPTION_KEY_PREVIOUS` while rotating). Ciphertext is
`v<N>:<iv>:<tag>:<ct>`: `v1` is the legacy format (master key directly, migrated once at startup),
`N >= 2` is a data key version. Repositories write `key_version = crypto.keyVersion` with every
insert and update. The operator workflow is in the README ("Key rotation, backup and recovery").

Tests: `apps/backend/src/tests/encryption.e2e-spec.ts` boots the real app on a pre-feature fixture.
The 10,000-row timing check is opt-in: `ENCRYPTION_PERF=1 npx jest src/tests/encryption-performance`
in `apps/backend`.

## CI pipeline overview

[.github/workflows/ci.yml](../.github/workflows/ci.yml) runs on every PR and on push to `main`:
`lint-and-format` (format check + affected lint + secretlint), `typecheck` (affected), `knip`
(whole workspace, non-blocking), `test` (affected), `build` (affected), and `sonar` (full coverage
run + quality gate). Preferring `nx affected` over running every project keeps PR feedback fast;
the `sonar` and `knip` jobs run against the whole workspace since coverage/unused-code analysis
needs the full picture.
