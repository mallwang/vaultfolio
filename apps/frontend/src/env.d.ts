// Declares the shape of window.__env, written at container startup by
// docker/frontend-entrypoint.sh (see index.html) and read in app.config.ts.
// Undefined outside the built Docker image (e.g. `nx serve`).
export {};

declare global {
  interface Window {
    __env?: {
      primengLicenseKey?: string;
      turnstileSiteKey?: string;
    };
    turnstile?: {
      render(
        container: string | HTMLElement,
        params: {
          sitekey: string;
          action?: string;
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
        },
      ): string;
      reset(widgetId: string): void;
      remove(widgetId: string): void;
    };
  }
}
