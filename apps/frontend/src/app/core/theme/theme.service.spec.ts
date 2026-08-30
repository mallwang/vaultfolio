import { ThemeService } from './theme.service';

const STORAGE_KEY = 'vaultfolio-theme';

function setMatchMedia(matches: boolean): void {
  window.matchMedia = vi.fn().mockReturnValue({ matches }) as unknown as typeof window.matchMedia;
}

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('app-dark');
    setMatchMedia(false);
  });

  afterEach(() => {
    document.documentElement.classList.remove('app-dark');
    vi.restoreAllMocks();
  });

  it('resolves "dark" from localStorage when present and valid', () => {
    localStorage.setItem(STORAGE_KEY, 'dark');
    const service = new ThemeService();
    expect(service.theme()).toBe('dark');
  });

  it('resolves "light" from localStorage when present and valid', () => {
    localStorage.setItem(STORAGE_KEY, 'light');
    setMatchMedia(true);
    const service = new ThemeService();
    expect(service.theme()).toBe('light');
  });

  it('falls back to prefers-color-scheme when no valid stored value exists', () => {
    setMatchMedia(true);
    const service = new ThemeService();
    expect(service.theme()).toBe('dark');
  });

  it('falls back to "light" when neither a valid stored value nor a matched media query exists', () => {
    setMatchMedia(false);
    const service = new ThemeService();
    expect(service.theme()).toBe('light');
  });

  it('treats an invalid/corrupted stored value as "no explicit choice"', () => {
    localStorage.setItem(STORAGE_KEY, 'not-a-theme');
    setMatchMedia(true);
    const service = new ThemeService();
    expect(service.theme()).toBe('dark');
  });

  it('treats a thrown localStorage read as "no explicit choice" without erroring', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    setMatchMedia(true);

    expect(() => new ThemeService()).not.toThrow();
    const service = new ThemeService();
    expect(service.theme()).toBe('dark');
  });

  it('applies the resolved theme class on document.documentElement synchronously at construction', () => {
    localStorage.setItem(STORAGE_KEY, 'dark');
    new ThemeService();
    expect(document.documentElement.classList.contains('app-dark')).toBe(true);
  });

  it('toggle() flips theme(), updates the DOM class, and persists the new value', () => {
    const service = new ThemeService();
    expect(service.theme()).toBe('light');
    expect(document.documentElement.classList.contains('app-dark')).toBe(false);

    service.toggle();

    expect(service.theme()).toBe('dark');
    expect(document.documentElement.classList.contains('app-dark')).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');

    service.toggle();

    expect(service.theme()).toBe('light');
    expect(document.documentElement.classList.contains('app-dark')).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
  });

  it('toggle() never throws even when localStorage.setItem throws, and still updates theme()/DOM', () => {
    const service = new ThemeService();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => service.toggle()).not.toThrow();
    expect(service.theme()).toBe('dark');
    expect(document.documentElement.classList.contains('app-dark')).toBe(true);
  });
});
