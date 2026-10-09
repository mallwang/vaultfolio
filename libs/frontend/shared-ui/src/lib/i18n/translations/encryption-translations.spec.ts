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

/** 040: every encryption text exists in English and German, with the same placeholders. */
describe('encryption translations', () => {
  const enKeys = keys(en['encryption'] as TranslationDictionary, 'encryption.');
  const deKeys = keys(de['encryption'] as TranslationDictionary, 'encryption.');

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

  it('names every domain, state, run kind and run status', () => {
    const expected = [
      ...[
        'earnings',
        'retirement',
        'wealth',
        'holdings',
        'insurances',
        'account-overview',
        'feedback',
      ].map((d) => `encryption.domain.${d}`),
      ...['READY', 'KEY_MISSING', 'KEY_MISMATCH', 'MIGRATING', 'REENCRYPTING'].map(
        (s) => `encryption.state.${s}`,
      ),
      ...['MASTER_KEY', 'DATA_KEY', 'KEY_DESTROY', 'LEGACY_MIGRATION'].map(
        (k) => `encryption.history.kind.${k}`,
      ),
      ...['RUNNING', 'SUCCEEDED', 'FAILED', 'INTERRUPTED'].map(
        (s) => `encryption.history.status.${s}`,
      ),
    ];
    expect(expected.filter((key) => !enKeys.includes(key))).toEqual([]);
  });

  it('translates every error code of the encryption API', () => {
    const codes = [
      'ENCRYPTION_DOMAIN_NOT_READY',
      'ENCRYPTION_OPERATION_RUNNING',
      'ENCRYPTION_KEY_NOT_RETIRED',
      'ENCRYPTION_KEY_IN_USE',
      'ENCRYPTION_CONFIRMATION_MISMATCH',
    ];
    expect(codes.filter((c) => !enKeys.includes(`encryption.errors.${c}`))).toEqual([]);
  });
});
