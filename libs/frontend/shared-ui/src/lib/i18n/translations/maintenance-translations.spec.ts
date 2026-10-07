import { de } from './de';
import { en, type TranslationDictionary } from './en';

function keys(node: TranslationDictionary, prefix = ''): string[] {
  return Object.entries(node).flatMap(([k, v]) =>
    typeof v === 'string' ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`),
  );
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
}

function lookup(dict: TranslationDictionary, path: string): string {
  return path.split('.').reduce<unknown>((n, k) => (n as TranslationDictionary)[k], dict) as string;
}

/** 041: every maintenance text exists in English and German, with the same placeholders. */
describe('maintenance translations', () => {
  const enKeys = keys(en['maintenance'] as TranslationDictionary, 'maintenance.');
  const deKeys = keys(de['maintenance'] as TranslationDictionary, 'maintenance.');

  it('has the same keys in en and de', () => {
    expect([...deKeys].sort()).toEqual([...enKeys].sort());
    expect(enKeys.length).toBeGreaterThan(10);
  });

  it('has no empty text and the same placeholders in both languages', () => {
    const problems = enKeys.filter((key) => {
      const e = lookup(en, key);
      const d = lookup(de, key);
      return (
        e.trim() === '' || d.trim() === '' || placeholders(d).join() !== placeholders(e).join()
      );
    });
    expect(problems).toEqual([]);
  });

  it('names the admin tab and page title in both languages', () => {
    for (const dict of [en, de]) {
      expect(lookup(dict, 'nav.domains')).toBeTruthy();
      expect(lookup(dict, 'pageTitle.adminDomains')).toBeTruthy();
    }
  });
});
