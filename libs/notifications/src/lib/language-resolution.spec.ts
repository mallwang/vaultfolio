import { resolveLanguage } from './language-resolution.js';

describe('resolveLanguage', () => {
  it('falls back to English for null', () => {
    expect(resolveLanguage(null)).toBe('en');
  });

  it('falls back to English for an unsupported code', () => {
    expect(resolveLanguage('fr')).toBe('en');
  });

  it('returns the preference when it is a supported code', () => {
    expect(resolveLanguage('de')).toBe('de');
  });
});
