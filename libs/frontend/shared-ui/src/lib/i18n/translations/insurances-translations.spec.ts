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

/** FR-017: every insurances text exists in English and German, with the same placeholders. */
describe('insurances translations', () => {
  const enKeys = keys(en['insurances'] as TranslationDictionary, 'insurances.');
  const deKeys = keys(de['insurances'] as TranslationDictionary, 'insurances.');

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

  it('translates every catalog type, requirement, group, class and API error code', () => {
    const types = [
      'STATUTORY_HEALTH',
      'STATUTORY_CARE',
      'STATUTORY_PENSION',
      'STATUTORY_UNEMPLOYMENT',
      'PRIVATE_HEALTH',
      'SUPPLEMENTARY_HEALTH',
      'DENTAL_SUPPLEMENT',
      'TRAVEL_HEALTH',
      'LONG_TERM_CARE',
      'DISABILITY',
      'TERM_LIFE',
      'ACCIDENT',
      'PRIVATE_LIABILITY',
      'PET_LIABILITY',
      'PROPERTY_OWNER_LIABILITY',
      'HOUSEHOLD',
      'BUILDING',
      'NATURAL_HAZARD',
      'GLASS',
      'CAR',
      'BICYCLE',
      'LEGAL_PROTECTION',
      'OTHER',
    ];
    for (const id of types) expect(enKeys).toContain(`insurances.types.${id}`);
    const requirements = [
      'HEALTH',
      'LIABILITY',
      'HOUSEHOLD',
      'DISABILITY',
      'BUILDING',
      'NATURAL_HAZARD',
      'CAR',
      'PET_LIABILITY',
      'TRAVEL_HEALTH',
      'RISK_LIFE',
      'LEGAL',
      'PROPERTY_OWNER_LIABILITY',
    ];
    for (const id of requirements) {
      expect(enKeys).toContain(`insurances.requirements.${id}.name`);
      expect(enKeys).toContain(`insurances.requirements.${id}.why`);
    }
    for (const group of ['PERSONS', 'LIABILITY', 'PROPERTY', 'MOBILITY', 'LEGAL', 'OTHER'])
      expect(enKeys).toContain(`insurances.groups.${group}`);
    for (const c of ['ESSENTIAL', 'RECOMMENDED', 'SITUATIONAL', 'OPTIONAL'])
      expect(enKeys).toContain(`insurances.classes.${c}`);
    for (const code of [
      'INSURANCES_UNAVAILABLE',
      'INSURANCES_VALIDATION',
      'INSURANCES_UNKNOWN_FIELD',
      'INSURANCES_LIMIT_EXCEEDED',
      'INSURANCES_CONTRACT_NOT_FOUND',
    ])
      expect(enKeys).toContain(`insurances.errors.${code}`);
    for (const code of [
      'REQUIRED',
      'INVALID',
      'UNKNOWN_FIELD',
      'OUT_OF_RANGE',
      'DATE_ORDER',
      'LIMIT',
    ])
      expect(enKeys).toContain(`insurances.fieldErrors.${code}`);
  });
});
