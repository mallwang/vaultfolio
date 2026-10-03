import { RETIREMENT_RESOURCES } from './resources';

describe('RETIREMENT_RESOURCES', () => {
  it('lists exactly the three external resources of FR-012', () => {
    expect(RETIREMENT_RESOURCES.map((r) => r.id)).toEqual(['drv', 'finanzfluss', 'finanztip']);
  });

  it('uses https links on the exact expected hosts', () => {
    const hosts = RETIREMENT_RESOURCES.map((r) => {
      const url = new URL(r.url);
      expect(url.protocol).toBe('https:');
      return url.hostname;
    });
    expect(hosts).toEqual([
      'www.deutsche-rentenversicherung.de',
      'www.finanzfluss.de',
      'www.finanztip.de',
    ]);
  });

  it('derives every i18n key from the resource id', () => {
    for (const r of RETIREMENT_RESOURCES) {
      expect(r.titleKey).toBe(`retirement.info.resources.${r.id}.title`);
      expect(r.descriptionKey).toBe(`retirement.info.resources.${r.id}.description`);
      expect(r.sourceKey).toBe(`retirement.info.resources.${r.id}.source`);
      expect(r.categoryKey).toMatch(/^retirement\.info\.categories\.[a-z]+$/);
    }
  });
});
