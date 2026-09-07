// Template for environment.local.ts (gitignored). Copy this file to
// environment.local.ts in this same folder and fill in your real PrimeUI
// license key — get a free community key or a commercial one from your
// PrimeTek/primeng.dev account. environment.local.ts is swapped in for
// environment.ts automatically by `nx serve frontend` (development config).
export const environment = {
  production: false,
  primengLicenseKey: 'PRIMEUI-LICENSE-KEY',
  // Cloudflare Turnstile always-pass test site key — safe to commit; works in
  // local dev only (Cloudflare never validates local tokens against this key).
  // Get a real key from https://dash.cloudflare.com/ → Turnstile.
  turnstileSiteKey: '1x00000000000000000000AA',
};
