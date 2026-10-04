// Throw-away Playwright verification script.
// Copy this into your scratchpad, fill in the "EDIT ME" section, and run:
//   node <scratchpad>/verify.mjs
// Requires the app already running: `npm run dev` (frontend :4200, backend :3000).

import { chromium } from 'playwright';

const REPO_ROOT = '/home/markus/projects/vaultfolio';
const FRONTEND_URL = 'http://localhost:4200';

// Test-account credentials live in the gitignored repo-root .env.local (never in .env).
// Already-exported variables win over the file.
try {
  process.loadEnvFile(`${REPO_ROOT}/.env.local`);
} catch {
  /* no .env.local — fall back to variables from the shell */
}

function requireEnv(key) {
  const value = process.env[key];
  if (!value)
    throw new Error(
      `${key} not set (test-account credentials; put them in .env.local, see verify-ui skill)`,
    );
  return value;
}

async function signIn(page) {
  const email = requireEnv('VAULTFOLIO_TEST_EMAIL');
  const password = requireEnv('VAULTFOLIO_TEST_PASSWORD');
  await page.goto(`${FRONTEND_URL}/sign-in`);
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL('**/app/dashboard');
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await signIn(page);

  // ---- EDIT ME: navigate to and assert on the thing you're verifying ----
  await page.goto(`${FRONTEND_URL}/app/dashboard`);
  await page.screenshot({ path: '/tmp/verify.png', fullPage: true });
  console.log('OK — screenshot at /tmp/verify.png');
  // -------------------------------------------------------------------------
} finally {
  await browser.close();
}
