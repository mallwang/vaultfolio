import { requireAbsoluteUrl } from './absolute-url';

describe('requireAbsoluteUrl', () => {
  const original = process.env.APP_BASE_URL;

  afterEach(() => {
    if (original === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = original;
  });

  it.each(['https://vaultfolio.example.com', 'http://localhost:4200'])(
    'joins base and path for %s',
    (base) => {
      process.env.APP_BASE_URL = base;
      expect(requireAbsoluteUrl('/app/admin/requests?id=1')).toBe(
        `${base}/app/admin/requests?id=1`,
      );
    },
  );

  it('rejects a relative base', () => {
    process.env.APP_BASE_URL = '/relative';
    expect(() => requireAbsoluteUrl('/x')).toThrow('APP_BASE_URL is not a valid absolute URL');
  });

  it('rejects an unset base', () => {
    delete process.env.APP_BASE_URL;
    expect(() => requireAbsoluteUrl('/x')).toThrow('got ""');
  });

  it('rejects a schemeless host', () => {
    process.env.APP_BASE_URL = 'www.example.com';
    expect(() => requireAbsoluteUrl('/x')).toThrow('APP_BASE_URL is not a valid absolute URL');
  });

  it('rejects a non-http scheme', () => {
    process.env.APP_BASE_URL = 'ftp://example.com';
    expect(() => requireAbsoluteUrl('/x')).toThrow('must use http:// or https://');
  });
});
