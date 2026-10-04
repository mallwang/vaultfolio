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

/** FR-020: every wealth text exists in English and German, with the same placeholders. */
describe('wealth translations', () => {
  const enKeys = keys(en['wealth'] as TranslationDictionary, 'wealth.');
  const deKeys = keys(de['wealth'] as TranslationDictionary, 'wealth.');

  it('has the same keys in en and de', () => {
    expect([...deKeys].sort()).toEqual([...enKeys].sort());
    expect(enKeys.length).toBeGreaterThan(100);
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

  it('translates every standard class, balance group and API error code', () => {
    const classes = [
      'cash',
      'bankBalances',
      'preciousMetals',
      'securities',
      'crypto',
      'realEstate',
      'vehicles',
      'collectibles',
      'otherAsset',
      'mortgage',
      'loan',
      'otherDebt',
    ];
    for (const id of classes) expect(enKeys).toContain(`wealth.classes.${id}`);
    const groups = [
      'LIQUID',
      'SECURITIES',
      'TANGIBLE',
      'OTHER_ASSET',
      'SHORT_TERM',
      'LONG_TERM',
      'OTHER_LIABILITY',
    ];
    for (const group of groups) expect(enKeys).toContain(`wealth.groups.${group}`);
    const codes = [
      'WEALTH_UNAVAILABLE',
      'WEALTH_VALIDATION',
      'WEALTH_UNKNOWN_FIELD',
      'WEALTH_LIMIT_EXCEEDED',
      'WEALTH_SNAPSHOT_NOT_FOUND',
      'WEALTH_SNAPSHOT_DATE_EXISTS',
    ];
    for (const code of codes) expect(enKeys).toContain(`wealth.errors.${code}`);
    const issues = [
      'REQUIRED',
      'INVALID_AMOUNT',
      'INVALID_DATE',
      'INVALID_VALUE',
      'OUT_OF_RANGE',
      'TOO_LONG',
      'UNKNOWN_FIELD',
      'LIMIT_EXCEEDED',
    ];
    for (const code of issues) expect(enKeys).toContain(`wealth.fieldErrors.${code}`);
  });
});
