# Tools

Developer scripts that are not part of the build. The seed scripts fill the test accounts with
**invented** data — never point them at an account with real data.

## Seed scripts

Two entry points seed every data feature (earnings, wealth, retirement, insurances, account overview) through the
REST API of a running backend. Each one **replaces** the account's existing data of those features.

| Script                                           | Account (default)                  | Data                                                                                                      |
| ------------------------------------------------ | ---------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [seed-comprehensive.mjs](seed-comprehensive.mjs) | `claude@allwang.family` (Admin)    | Load and limit set: 50-year career, 597 wealth snapshots, 81 retirement records, 30 contracts, edge cases |
| [seed-realistic.mjs](seed-realistic.mjs)         | `claudius@allwang.family` (Member) | Plausible, edge-case-free set: 12-year career, 10 years of wealth, 7 retirement entries, 7 contracts      |

```bash
# backend running on http://localhost:3000
node tools/seed-comprehensive.mjs
node tools/seed-realistic.mjs
```

Requirements:

- A running backend (default `http://localhost:3000`; behind a proxy use its API prefix, e.g.
  `--base https://<host>/api`).
- The accounts exist and are entitled to all five domains (Admins have every scope).
- The password comes from `--password` or from the variable `VAULTFOLIO_TEST_PASSWORD` (Admin) /
  `VAULTFOLIO_MEMBER_PASSWORD` (Member), set in the environment or in the gitignored repo-root
  `.env.local`. Prefer `.env.local` — a password on the command line ends up in the shell history.

Options: `--email <e>`, `--base <url>`, `--only earnings,wealth,retirement,insurances,account-overview`.

The output is deterministic (insurance dates are relative to today so deadline warnings show), so
a reset is reproducible.

## Per-feature scripts

The entry points call these; each can also be run on its own, with
`--email <e> --password <p> [--base <url>] [--profile comprehensive|realistic] [--replace]`
and `--out file.json` to write the data without uploading.

| Feature          | Script                                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| Earnings         | [earnings/generate-career-testset.mjs](earnings/generate-career-testset.mjs)                             |
| Wealth           | [wealth/seed-wealth-testset.mjs](wealth/seed-wealth-testset.mjs)                                         |
| Retirement       | [retirement/seed-retirement-testset.mjs](retirement/seed-retirement-testset.mjs)                         |
| Insurances       | [insurances/seed-insurances-testset.mjs](insurances/seed-insurances-testset.mjs)                         |
| Account overview | [account-overview/seed-account-overview-testset.mjs](account-overview/seed-account-overview-testset.mjs) |

`--profile` defaults to `comprehensive`; `--replace` is required to overwrite a non-empty account.
Shared helpers live in [seed-lib.mjs](seed-lib.mjs).

See also [Synthetic test data](../docs/development.md#synthetic-test-data-limit-tests-and-demo-accounts)
in the developer documentation.

## Other

- [earnings/parity-check.mjs](earnings/parity-check.mjs) — parser parity check (see the root README).
- [ensure-frontend-env.mjs](ensure-frontend-env.mjs), [vitest-global-setup.ts](vitest-global-setup.ts),
  [release/](release/) — build, test and release plumbing.
