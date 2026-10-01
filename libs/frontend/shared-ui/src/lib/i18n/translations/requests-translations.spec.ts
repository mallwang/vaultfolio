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

/** 033 SC-011: every request text exists in English and German, with the same placeholders. */
describe('requests translations', () => {
  const enKeys = keys(en['requests'] as TranslationDictionary, 'requests.');
  const deKeys = keys(de['requests'] as TranslationDictionary, 'requests.');

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

  it('names every status', () => {
    for (const status of ['OPEN', 'IN_PROGRESS', 'DONE', 'REJECTED'])
      expect(enKeys).toContain(`requests.status.${status}`);
  });

  it('translates every error code of the requests API', () => {
    const codes = [
      'UNKNOWN_REQUEST_TYPE',
      'INVALID_LAYOUT',
      'LAYOUT_UNKNOWN_FIELD',
      'LIMIT_EXCEEDED',
      'PERSONAL_DATA_DETECTED',
      'INVALID_RULE_DRAFT',
      'REQUEST_LIMIT_OPEN',
      'REQUEST_LIMIT_DAILY',
      'REQUEST_NOT_FOUND',
      'SAMPLE_DELETED',
      'INVALID_REQUEST_UPDATE',
    ];
    for (const code of codes) expect(enKeys).toContain(`requests.errors.${code}`);
  });
});
