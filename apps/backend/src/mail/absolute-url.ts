/**
 * Builds `${APP_BASE_URL}${path}` and fails loudly unless the result is an absolute http(s) URL.
 * A missing/relative/schemeless `APP_BASE_URL` (e.g. unset, or "www.example.com" without the
 * protocol) renders as a dead "about:blank#blocked" link in most email clients, so mailing it out
 * silently would be worse than throwing.
 */
export function requireAbsoluteUrl(path: string): string {
  const url = `${process.env.APP_BASE_URL ?? ''}${path}`;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(
      `APP_BASE_URL is not a valid absolute URL (got "${process.env.APP_BASE_URL ?? ''}"). ` +
        'Set it to e.g. "https://vaultfolio.example.com" (must include the protocol).',
    );
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error(
      `APP_BASE_URL must use http:// or https:// (got "${process.env.APP_BASE_URL ?? ''}").`,
    );
  }
  return url;
}
