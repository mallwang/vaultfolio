// Throw-away Playwright verification script.
// Copy this into your scratchpad, fill in the "EDIT ME" section, and run:
//   node <scratchpad>/verify.mjs
// Requires the app already running: `npm run dev` (frontend :4200, backend :3000).

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const REPO_ROOT = '/home/markus/projects/vaultfolio';
const FRONTEND_URL = 'http://localhost:4200';

function readEnv(key) {
  const line = readFileSync(`${REPO_ROOT}/.env`, 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${key}=`));
  if (!line) throw new Error(`${key} not set in ${REPO_ROOT}/.env`);
  return line.slice(key.length + 1).trim();
}

async function signIn(page) {
  const email = readEnv('BOOTSTRAP_ADMIN_EMAIL');
  const password = readEnv('BOOTSTRAP_ADMIN_PASSWORD');
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
