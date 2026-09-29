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

/** SC-008: every earnings text exists in English and German, with the same placeholders. */
describe('earnings translations', () => {
  const enKeys = keys(en['earnings'] as TranslationDictionary, 'earnings.');
  const deKeys = keys(de['earnings'] as TranslationDictionary, 'earnings.');

  it('has the same keys in en and de', () => {
    expect(deKeys.sort()).toEqual(enKeys.sort());
    expect(enKeys.length).toBeGreaterThan(150);
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

  it('defines the nav, page-title and dashboard entries', () => {
    const keys = [
      'nav.earnings',
      'pageTitle.earnings',
      'pageTitle.earningsImport',
      'dashboard.earnings',
    ];
    const missing = [en, de].flatMap((dict) =>
      keys.filter((key) => typeof lookup(dict, key) !== 'string'),
    );
    expect(missing).toEqual([]);
  });

  it('translates every parser, check and API error code', () => {
    const codes = [
      'UNSUPPORTED_FORMAT',
      'IMAGE_ONLY',
      'PASSWORD_PROTECTED',
      'UNREADABLE',
      'MISSING_FIELD',
      'UNKNOWN_LINE',
      'CHECK_FAILED',
      'EARNINGS_UNKNOWN_FIELD',
      'INVALID_VALUE',
      'LIMIT_EXCEEDED',
      'EXPORT_UNSUPPORTED_VERSION',
      'EXPORT_UNKNOWN_FIELD',
      'BATCH_CONFLICT',
      'EARNINGS_UNAVAILABLE',
    ];
    for (const code of codes) expect(enKeys).toContain(`earnings.errors.${code}`);
  });
});
