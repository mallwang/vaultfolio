#!/usr/bin/env node
/**
 * Comprehensive load/limit data for ALL features in the Admin test account (default
 * claude@allwang.family). Replaces that account's earnings, wealth, retirement, insurances, holdings and account-overview data.
 *
 *   node tools/seed-comprehensive.mjs [--password <p>] [--email <e>] [--base http://localhost:3000]
 *        [--only earnings,wealth,retirement,insurances,holdings,account-overview]
 *
 * Password: --password, or VAULTFOLIO_TEST_PASSWORD (env or repo-root .env.local).
 */
import { runAll } from './seed-all.mjs';

runAll({
  profile: 'comprehensive',
  defaultEmail: 'claude@allwang.family',
  passwordVar: 'VAULTFOLIO_TEST_PASSWORD',
});
