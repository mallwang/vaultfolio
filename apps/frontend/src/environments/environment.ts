// Default/production environment. Committed to git — never put real secrets
// here. Local dev overrides this file with environment.local.ts (gitignored,
// see environment.local.example.ts) via the `development` build config's
// fileReplacements in project.json.
export const environment = {
  production: true,
  // PrimeUI license key (community or commercial), see
  // https://primeng.dev/configuration#license. Left empty here; a real
  // deployment must supply this via its own build/deploy pipeline.
  primengLicenseKey: '',
};
