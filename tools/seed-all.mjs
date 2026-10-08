import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './seed-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const FEATURES = [
  ['earnings', 'earnings/generate-career-testset.mjs'],
  ['wealth', 'wealth/seed-wealth-testset.mjs'],
  ['retirement', 'retirement/seed-retirement-testset.mjs'],
  ['insurances', 'insurances/seed-insurances-testset.mjs'],
  ['holdings', 'holdings/seed-holdings-testset.mjs'],
  ['account-overview', 'account-overview/seed-account-overview-testset.mjs'],
];

/** Reads VAULTFOLIO_*=value lines from the gitignored repo-root .env.local (nothing else). */
function localEnv() {
  const file = join(here, '..', '.env.local');
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, 'utf8')
      .split('\n')
      .map((l) => l.match(/^\s*(VAULTFOLIO_[A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2]]),
  );
}

/**
 * Runs every feature seeder with one profile against one account.
 * `passwordVar` names the variable (env or .env.local) that holds that account's password.
 */
export function runAll({ profile, defaultEmail, passwordVar }) {
  const args = parseArgs();
  const env = { ...localEnv(), ...process.env };
  const email = args.email ?? defaultEmail;
  const password = args.password ?? env[passwordVar];
  if (!password) {
    console.error(
      `No password: pass --password or set ${passwordVar} (env or repo-root .env.local)`,
    );
    process.exit(1);
  }
  const only = typeof args.only === 'string' ? args.only.split(',') : FEATURES.map(([n]) => n);
  console.log(`Seeding "${profile}" data for ${email} → ${args.base ?? 'http://localhost:3000'}`);
  for (const [name, script] of FEATURES) {
    if (!only.includes(name)) continue;
    console.log(`\n== ${name} ==`);
    const run = spawnSync(
      process.execPath,
      [
        join(here, script),
        '--email',
        email,
        '--password',
        password,
        '--profile',
        profile,
        '--replace',
        ...(typeof args.base === 'string' ? ['--base', args.base] : []),
      ],
      { stdio: 'inherit' },
    );
    if (run.status !== 0) process.exit(run.status ?? 1);
  }
}
