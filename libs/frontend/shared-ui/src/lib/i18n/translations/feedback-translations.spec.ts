import { de } from './de';
import { en, type TranslationDictionary } from './en';

function keys(node: TranslationDictionary, prefix = ''): string[] {
  return Object.entries(node).flatMap(([k, v]) =>
    typeof v === 'string' ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`),
  );
}

function lookup(dict: TranslationDictionary, path: string): string {
  return path.split('.').reduce<unknown>((n, k) => (n as TranslationDictionary)[k], dict) as string;
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
}

/** 044: feedback and feedback-hint texts exist in en and de with the same placeholders. */
describe('feedback translations', () => {
  const enKeys = [
    ...keys(en['feedback'] as TranslationDictionary, 'feedback.'),
    ...keys(
      (en['hints'] as TranslationDictionary)['feedback'] as TranslationDictionary,
      'hints.feedback.',
    ),
    'hints.groups.feedback',
  ];
  const deKeys = [
    ...keys(de['feedback'] as TranslationDictionary, 'feedback.'),
    ...keys(
      (de['hints'] as TranslationDictionary)['feedback'] as TranslationDictionary,
      'hints.feedback.',
    ),
    'hints.groups.feedback',
  ];

  it('has the same keys in en and de', () => {
    expect([...deKeys].sort()).toEqual([...enKeys].sort());
    expect(enKeys.length).toBeGreaterThan(20);
  });

  it('has no empty text and the same placeholders', () => {
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
