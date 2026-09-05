import { I18nService } from './i18n.service';

const STORAGE_KEY = 'vaultfolio-language';

describe('I18nService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves the stored language when present and supported', () => {
    localStorage.setItem(STORAGE_KEY, 'de');
    const service = new I18nService();
    expect(service.language()).toBe('de');
  });

  it('falls back to the catalog default ("en") when nothing is stored', () => {
    const service = new I18nService();
    expect(service.language()).toBe('en');
  });

  it('treats a stored-but-unsupported code as "no explicit choice" and falls back to the default', () => {
    localStorage.setItem(STORAGE_KEY, 'fr');
    const service = new I18nService();
    expect(service.language()).toBe('en');
  });

  it('treats a thrown localStorage read as "no explicit choice" without erroring', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => new I18nService()).not.toThrow();
    const service = new I18nService();
    expect(service.language()).toBe('en');
  });

  it('setLanguage() updates language() and persists the choice', () => {
    const service = new I18nService();
    service.setLanguage('de');
    expect(service.language()).toBe('de');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('de');
  });

  it('setLanguage() ignores an unsupported code, leaving the current language unchanged', () => {
    const service = new I18nService();
    service.setLanguage('fr');
    expect(service.language()).toBe('en');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('setLanguage() never throws even when localStorage.setItem throws, and still updates language()', () => {
    const service = new I18nService();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => service.setLanguage('de')).not.toThrow();
    expect(service.language()).toBe('de');
  });
});
