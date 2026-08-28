// Declares the shape of window.__env, written at container startup by
// docker/frontend-entrypoint.sh (see index.html) and read in app.config.ts.
// Undefined outside the built Docker image (e.g. `nx serve`).
export {};

declare global {
  interface Window {
    __env?: {
      primengLicenseKey?: string;
    };
  }
}
