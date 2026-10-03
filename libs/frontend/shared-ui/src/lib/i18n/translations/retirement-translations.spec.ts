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

/** FR-018: every retirement text exists in English and German, with the same placeholders. */
describe('retirement translations', () => {
  const enKeys = keys(en['retirement'] as TranslationDictionary, 'retirement.');
  const deKeys = keys(de['retirement'] as TranslationDictionary, 'retirement.');

  it('has the same keys in en and de', () => {
    expect([...deKeys].sort()).toEqual([...enKeys].sort());
    expect(enKeys.length).toBeGreaterThan(60);
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

  it('translates every contract type and every API error code', () => {
    const types = [
      'STATUTORY_PENSION',
      'DIRECT_INSURANCE',
      'PENSIONSKASSE',
      'DIREKTZUSAGE',
      'UNTERSTUETZUNGSKASSE',
      'PENSIONSFONDS',
      'CAPITAL_ACCOUNT',
      'RIESTER',
      'PRIVATE_PENSION_INSURANCE',
      'ALTERSVORSORGEDEPOT',
    ];
    for (const type of types) expect(enKeys).toContain(`retirement.types.${type}`);
    const codes = [
      'RETIREMENT_UNAVAILABLE',
      'RETIREMENT_VALIDATION',
      'RETIREMENT_UNKNOWN_FIELD',
      'RETIREMENT_CHECK_FAILED',
      'RETIREMENT_RECORD_NOT_FOUND',
      'RETIREMENT_IMPORTED_READONLY',
      'RETIREMENT_NOT_IMPORTED',
      'RETIREMENT_STATUTORY_EXISTS',
    ];
    for (const code of codes) expect(enKeys).toContain(`retirement.errors.${code}`);
  });
});
