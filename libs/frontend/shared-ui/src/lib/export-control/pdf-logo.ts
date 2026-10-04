import { InjectionToken } from '@angular/core';

/** The app icon, served from the frontend's public folder. */
const LOGO_URL = '/vaultfolio-logo.png';

/** Fetches the logo as a PNG data URL; `undefined` when it cannot be loaded (the PDF then has none). */
export async function loadPdfLogo(): Promise<string | undefined> {
  try {
    const response = await fetch(LOGO_URL);
    if (!response.ok) return undefined;
    const blob = await response.blob();
    return await new Promise<string | undefined>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : undefined);
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

/** Seam so specs need no network; defaults to `loadPdfLogo`. */
export const PDF_LOGO = new InjectionToken<() => Promise<string | undefined>>('PDF_LOGO', {
  providedIn: 'root',
  factory: () => loadPdfLogo,
});
