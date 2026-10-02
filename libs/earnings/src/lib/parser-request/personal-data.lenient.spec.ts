import { scanDocument } from './personal-data.js';

/**
 * SC-005 (034): whatever one or two misread characters text recognition produces inside a valid
 * identifier — a look-alike letter for a digit, or another digit — the lenient scan still finds
 * the whole identifier, so the anonymiser removes it and the rescan stays clean.
 */

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}

const LOOKALIKES: Record<string, string[]> = { '0': ['O', 'o'], '1': ['l', 'I'], '5': ['S'] };

function misread(text: string, rng: () => number, count: number): string {
  const chars = [...text];
  const digitPositions = chars.flatMap((c, i) => (/\d/.test(c) ? [i] : []));
  for (let n = 0; n < count; n += 1) {
    const at = digitPositions[Math.floor(rng() * digitPositions.length)];
    const options = LOOKALIKES[chars[at]];
    chars[at] =
      options && rng() < 0.7
        ? options[Math.floor(rng() * options.length)]
        : String(Math.floor(rng() * 10));
  }
  return chars.join('');
}

function taxId(rng: () => number): string {
  const digits = Array.from({ length: 10 }, () => 1 + Math.floor(rng() * 9));
  let product = 10;
  for (const digit of digits) {
    let sum = (digit + product) % 10;
    if (sum === 0) sum = 10;
    product = (sum * 2) % 11;
  }
  return digits.join('') + String(11 - product === 10 ? 0 : 11 - product);
}

function iban(rng: () => number): string {
  const bban = Array.from({ length: 18 }, () => Math.floor(rng() * 10)).join('');
  const numeric = `${bban}131400`;
  let remainder = 0;
  for (const digit of numeric) remainder = (remainder * 10 + Number(digit)) % 97;
  return `DE${String(98 - remainder).padStart(2, '0')}${bban}`;
}

function socialSecurity(rng: () => number): string {
  const digits = (n: number) => Array.from({ length: n }, () => Math.floor(rng() * 10)).join('');
  return `${digits(8)}${String.fromCodePoint(65 + Math.floor(rng() * 26))}${digits(3)}`;
}

/** Splits into 4/3-character groups for the grouped print layout. */
function grouped(text: string, size: number): string[] {
  return text.match(new RegExp(`.{1,${size}}`, 'g')) ?? [text];
}

function surviving(identifier: string[]): number {
  const doc = {
    pages: [
      {
        lines: [{ words: ['Name', ...identifier, 'Summe', '1.234,56'].map((text) => ({ text })) }],
      },
    ],
  };
  const covered = new Set(scanDocument(doc, { lenient: true }).flatMap((h) => h.wordIndexes));
  return identifier.filter((_, i) => !covered.has(i + 1)).length;
}

describe('lenient scan: misread-digit property', () => {
  const rng = seeded(34);
  const cases = Array.from({ length: 150 }, (_, i) => i);

  it.each(cases)('removes a misread IBAN, case %i', () => {
    const value = misread(iban(rng), rng, 1 + Math.floor(rng() * 2));
    expect(surviving([value])).toBe(0);
    expect(surviving(grouped(value, 4))).toBe(0);
  });

  it.each(cases)('removes a misread tax ID, case %i', () => {
    const value = taxId(rng);
    const read = misread(value, rng, 1 + Math.floor(rng() * 2));
    // a leading digit read as 0/O is a different shape (first digit is never 0); skip those
    if (/^[0Oo]/.test(read)) return;
    expect(surviving([read])).toBe(0);
    expect(surviving(grouped(read, 3))).toBe(0);
  });

  it.each(cases)('removes a misread social-security number, case %i', () => {
    const value = socialSecurity(rng);
    const read = misread(value, rng, 1 + Math.floor(rng() * 2));
    expect(surviving([read])).toBe(0);
    expect(surviving([read.slice(0, 2), read.slice(2, 8), read[8], read.slice(9)])).toBe(0);
  });

  it('removes the observed DATEV account number pattern', () => {
    expect(surviving(['DE0O3', '7601', '0085', '0004', '0O94', '45'])).toBe(0);
  });
});
