import { de } from './de';
import { en, type TranslationDictionary } from './en';

const GROUPS = [
  'holdings',
  'holdingsDistribution',
  'holdingsTile',
  'holdingsArea',
  'holdingsExport',
  'holdingMetal',
  'holdingError',
];

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

/** Every holdings text exists in English and German, with the same placeholders. */
describe('holdings translations', () => {
  const pick = (dict: TranslationDictionary) =>
    GROUPS.flatMap((g) => keys(dict[g] as TranslationDictionary, `${g}.`));
  const enKeys = pick(en);
  const deKeys = pick(de);

  it('has the same keys in en and de', () => {
    expect([...deKeys].sort()).toEqual([...enKeys].sort());
    expect(enKeys.length).toBeGreaterThan(20);
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
});
