#!/usr/bin/env node
/**
 * Realistic, edge-case-free data for ALL features in the Member test account (default
 * claudius@allwang.family). Replaces that account's earnings, wealth, retirement, insurances and account-overview data.
 *
 *   node tools/seed-realistic.mjs [--password <p>] [--email <e>] [--base http://localhost:3000]
 *        [--only earnings,wealth,retirement,insurances,account-overview]
 *
 * Password: --password, or VAULTFOLIO_MEMBER_PASSWORD (env or repo-root .env.local).
 */
import { runAll } from './seed-all.mjs';

runAll({
  profile: 'realistic',
  defaultEmail: 'claudius@allwang.family',
  passwordVar: 'VAULTFOLIO_MEMBER_PASSWORD',
});
