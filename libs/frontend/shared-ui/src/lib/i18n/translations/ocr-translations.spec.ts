import { de } from './de';
import { en } from './en';

const placeholders = (text: string): string[] =>
  [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

/** The shared on-device text-recognition texts exist in both languages with the same placeholders. */
describe('ocr translations', () => {
  const enOcr = en['ocr'] as Record<string, string>;
  const deOcr = de['ocr'] as Record<string, string>;

  it('has the same keys in en and de', () => {
    expect(Object.keys(deOcr).sort()).toEqual(Object.keys(enOcr).sort());
    expect(Object.keys(enOcr).length).toBeGreaterThan(15);
  });

  it('has no empty text and the same placeholders in both languages', () => {
    const problems = Object.keys(enOcr).filter(
      (k) =>
        enOcr[k].trim() === '' ||
        deOcr[k].trim() === '' ||
        placeholders(enOcr[k]).join() !== placeholders(deOcr[k]).join(),
    );
    expect(problems).toEqual([]);
  });
});
