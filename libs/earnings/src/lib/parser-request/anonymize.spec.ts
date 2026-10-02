import {
  type AnalyzedLayout,
  type AnalyzedWord,
  anonymizeLayout,
  COURIER_ADVANCE,
  layoutLimitProblem,
  isNoiseWord,
  replaceDigitsSameShape,
  toSubmission,
  type WordDecision,
  wordKey,
} from './anonymize.js';
import { validateLayoutSubmission } from './layout-submission.js';
import { scanDocument } from './personal-data.js';

/** Deterministic RNG (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const word = (text: string, x: number, width = text.length * 5, covered = false): AnalyzedWord => ({
  text,
  x,
  width,
  height: 9,
  covered,
});

const NAME = 'Mustermann';
const IBAN = 'DE89370400440532013000';

function payslip(): AnalyzedLayout {
  return {
    pages: [
      {
        width: 595,
        height: 842,
        lines: [
          { y: 60, words: [word('Erika', 56), word(NAME, 90)] },
          { y: 72, words: [word('IBAN:', 56), word(IBAN, 90, 110)] },
          { y: 84, words: [word('80331', 56), word('München', 90)] },
          { y: 96, words: [word('Brutto', 56), word('3.842,17', 391.4, 40)] },
          { y: 108, words: [word('Lohnsteuer', 56), word('512,03', 399.2, 30)] },
          { y: 120, words: [word('Datum', 56), word('31.12.2025', 200, 50)] },
          { y: 132, words: [word('Abteilung', 56), word('Kantine', 100, 35, true)] },
        ],
      },
    ],
  };
}

const none = new Map<string, WordDecision>();
const wordsOf = (anon: ReturnType<typeof anonymizeLayout>, page = 0) =>
  anon.pages[page].lines.map((line) => line.words);

describe('replaceDigitsSameShape', () => {
  it('keeps separators and letters and the length, changes every digit run', () => {
    const rng = seeded(1);
    for (const text of [
      '3.842,17',
      '31.12.2025',
      '591,70-',
      '-5,63',
      'Y$10',
      '12:30',
      '1/2',
      '7',
    ]) {
      const out = replaceDigitsSameShape(text, rng);
      expect(out).toHaveLength(text.length);
      expect(out.replaceAll(/\d/g, '#')).toBe(text.replaceAll(/\d/g, '#'));
    }
  });

  it('never starts a number with zero unless the original did', () => {
    const rng = seeded(7);
    const firsts = new Set<string>();
    for (let i = 0; i < 300; i += 1) {
      firsts.add(replaceDigitsSameShape('1.234,56', rng)[0]);
      expect(replaceDigitsSameShape('50', rng)[0]).not.toBe('0');
    }
    expect(firsts.has('0')).toBe(false);
    const zeros = new Set(
      Array.from({ length: 300 }, () => replaceDigitsSameShape('0,50', rng)[0]),
    );
    expect(zeros.has('0')).toBe(true);
  });

  it('uses the injected random source', () => {
    expect(replaceDigitsSameShape('12', () => 0)).toBe('10');
    expect(replaceDigitsSameShape('12', () => 0.99)).toBe('99');
    expect(replaceDigitsSameShape('0', () => 0.5)).toBe('5');
  });
});

describe('anonymizeLayout', () => {
  const anon = anonymizeLayout(payslip(), none, seeded(42));
  const [name, iban, city, gross, tax, date, covered] = wordsOf(anon);

  it('removes and locks personal data with a placeholder of the same length (min 3)', () => {
    expect(iban[0]).toMatchObject({ text: 'IBAN:', mark: 'LABEL', locked: false });
    expect(iban[1]).toEqual({ text: 'X'.repeat(22), x: 90, mark: 'REMOVED', locked: true });
    expect(city.map((w) => [w.text, w.mark, w.locked])).toEqual([
      ['XXXXX', 'REMOVED', true],
      ['XXXXXXX', 'REMOVED', true],
    ]);
    expect(anon.removedKinds).toEqual(['BANK_ACCOUNT', 'POSTCODE_CITY']);
  });

  it('keeps known labels', () => {
    expect(gross[0]).toMatchObject({ text: 'Brutto', mark: 'LABEL' });
    expect(tax[0]).toMatchObject({ text: 'Lohnsteuer', mark: 'LABEL' });
    expect(date[0]).toMatchObject({ text: 'xxxxx', mark: 'MASKED' });
  });

  it('masks unknown words by default', () => {
    expect(name[0]).toEqual({ text: 'xxxxx', x: 56, mark: 'MASKED', locked: false });
    expect(name[1]).toEqual({ text: 'x'.repeat(10), x: 90, mark: 'MASKED', locked: false });
  });

  it('replaces values with same-shape random digits', () => {
    expect(gross[1].mark).toBe('VALUE');
    expect(gross[1].text).toMatch(/^[1-9]\.\d{3},\d{2}$/);
    expect(gross[1].text).not.toBe('3.842,17');
    expect(tax[1].text).toMatch(/^\d{3},\d{2}$/);
    expect(date[1].text).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
  });

  it('right-aligns amounts to the original right edge and leaves dates in place', () => {
    const size = 9;
    expect(gross[1].x).toBeCloseTo(391.4 + 40 - gross[1].text.length * COURIER_ADVANCE * size, 6);
    expect(tax[1].x).toBeCloseTo(399.2 + 30 - tax[1].text.length * COURIER_ADVANCE * size, 6);
    expect(date[1].x).toBe(200);
  });

  it('preselects covered words as masked', () => {
    expect(covered[1]).toEqual({ text: 'xxxxxxx', x: 100, mark: 'MASKED', locked: false });
  });

  it('applies keep and mask decisions to undecided words only', () => {
    const decisions = new Map<string, WordDecision>([
      [wordKey(0, 0, 0), 'KEEP'],
      [wordKey(0, 0, 1), 'MASK'],
      [wordKey(0, 6, 1), 'KEEP'], // covered word the user explicitly keeps
      [wordKey(0, 1, 1), 'KEEP'], // removed word: decision ignored
      [wordKey(0, 3, 0), 'MASK'], // label: decision ignored
    ]);
    const decided = anonymizeLayout(payslip(), decisions, seeded(42));
    const lines = wordsOf(decided);
    expect(lines[0][0]).toMatchObject({ text: 'Erika', mark: 'KEPT' });
    expect(lines[0][1]).toMatchObject({ text: 'x'.repeat(10), mark: 'MASKED' });
    expect(lines[6][1]).toMatchObject({ text: 'Kantine', mark: 'KEPT' });
    expect(lines[1][1]).toMatchObject({ mark: 'REMOVED', locked: true });
    expect(lines[3][0]).toMatchObject({ text: 'Brutto', mark: 'LABEL' });
    expect(lines[5][0]).toMatchObject({ mark: 'MASKED' }); // undecided
  });

  it('clamps masked words to 3..20 characters', () => {
    const layout: AnalyzedLayout = {
      pages: [
        {
          width: 595,
          height: 842,
          lines: [
            { y: 10, words: [word('Ab', 1), word('Donaudampfschifffahrtsgesellschaft', 20)] },
          ],
        },
      ],
    };
    const [[short, long]] = wordsOf(anonymizeLayout(layout, new Map(), seeded(1)));
    expect(short.text).toBe('xxx');
    expect(long.text).toBe('x'.repeat(20));
  });

  it('keeps punctuation-only words', () => {
    const layout: AnalyzedLayout = {
      pages: [
        { width: 595, height: 842, lines: [{ y: 10, words: [word('-', 1), word('****', 20)] }] },
      ],
    };
    const [[dash, stars]] = wordsOf(anonymizeLayout(layout, new Map(), seeded(1)));
    expect(dash).toMatchObject({ text: '-', mark: 'LABEL' });
    expect(stars).toMatchObject({ text: '****', mark: 'LABEL' });
  });

  it('is deterministic for a seed', () => {
    expect(anonymizeLayout(payslip(), none, seeded(5))).toEqual(
      anonymizeLayout(payslip(), none, seeded(5)),
    );
    expect(anonymizeLayout(payslip(), none, seeded(5))).not.toEqual(
      anonymizeLayout(payslip(), none, seeded(6)),
    );
  });

  it('leaves no original digit sequence and no personal data in the output (SC-003)', () => {
    const originals = ['3.842,17', '512,03', '31.12.2025', '80331', IBAN];
    for (let seed = 1; seed <= 200; seed += 1) {
      const result = anonymizeLayout(payslip(), none, seeded(seed));
      const text = wordsOf(result)
        .flat()
        .map((w) => w.text);
      for (const original of originals) expect(text).not.toContain(original);
      expect(text).not.toContain(NAME);
      expect(scanDocument(result)).toEqual([]);
    }
  });

  it('re-rolls values until the personal-data scan finds nothing', () => {
    // a constant random source yields a valid-IBAN-shaped replacement candidate for some seeds;
    // the scan over the result must be clean for every source, even degenerate ones
    for (const constant of [0, 0.05, 0.5, 0.95, 0.9999]) {
      const layout: AnalyzedLayout = {
        pages: [
          {
            width: 595,
            height: 842,
            lines: [
              {
                y: 10,
                words: [
                  word('Wert', 1),
                  word('4711', 20),
                  word('0815', 40),
                  word('1234567890123', 60),
                ],
              },
            ],
          },
        ],
      };
      const result = anonymizeLayout(layout, new Map(), () => constant);
      expect(scanDocument(result)).toEqual([]);
      const texts = wordsOf(result)[0].map((w) => w.text);
      expect(texts).not.toContain('4711');
      expect(texts).not.toContain('1234567890123');
    }
  });

  it('never leaves an original digit sequence even when the random source repeats it', () => {
    const layout: AnalyzedLayout = {
      pages: [{ width: 595, height: 842, lines: [{ y: 10, words: [word('1,00', 1)] }] }],
    };
    // 0.0 → digits "1"/"0": the replacement of "1,00" is "1,00" itself, so it must be changed
    const result = anonymizeLayout(layout, new Map(), () => 0);
    expect(wordsOf(result)[0][0].text).not.toBe('1,00');
  });
});

describe('isNoiseWord', () => {
  it('flags fragments and low-confidence words but not real words', () => {
    expect(isNoiseWord({ text: 'Gehalt' })).toBe(false);
    expect(isNoiseWord({ text: 'a' })).toBe(true);
    expect(isNoiseWord({ text: '|,-' })).toBe(true);
    expect(isNoiseWord({ text: 'x1l2' })).toBe(true);
    expect(isNoiseWord({ text: 'Gehalt', lowConfidence: true })).toBe(true);
  });
});

describe('toSubmission', () => {
  it('produces a valid submission the scan finds nothing in', () => {
    const decisions = new Map<string, WordDecision>([[wordKey(0, 0, 0), 'KEEP']]);
    const anon = anonymizeLayout(payslip(), decisions, seeded(3));
    const submission = toSubmission(anon);
    expect(validateLayoutSubmission(submission)).toEqual({ ok: true, value: submission });
    expect(scanDocument(submission)).toEqual([]);
    expect(submission.schemaVersion).toBe(1);
    expect(submission.pages[0].lines[0]).toEqual({
      y: 60,
      size: 9,
      words: [
        { text: 'Erika', x: 56 },
        { text: 'x'.repeat(10), x: 90 },
      ],
    });
    expect(submission.ruleDraft).toBeUndefined();
  });

  it('sends undecided words masked', () => {
    const submission = toSubmission(anonymizeLayout(payslip(), none, seeded(3)));
    const serialized = JSON.stringify(submission);
    expect(serialized).not.toContain('Erika');
    expect(serialized).not.toContain(NAME);
    expect(serialized).not.toContain('Kantine');
  });

  it('sanitises kept words that the schema would reject', () => {
    const layout: AnalyzedLayout = {
      pages: [
        { width: 595, height: 842, lines: [{ y: 10, words: [word('·', 1), word('Ab​c', 10)] }] },
      ],
    };
    const decisions = new Map<string, WordDecision>([[wordKey(0, 0, 1), 'KEEP']]);
    const submission = toSubmission(anonymizeLayout(layout, decisions, seeded(1)));
    expect(validateLayoutSubmission(submission).ok).toBe(true);
    expect(submission.pages[0].lines[0].words.map((w) => w.text)).toEqual(['?', 'Ab?c']);
  });

  it('rounds to one decimal and clamps into the page box', () => {
    const layout: AnalyzedLayout = {
      pages: [
        {
          width: 595.27,
          height: 841.89,
          lines: [
            {
              y: 900,
              words: [{ text: 'Brutto', x: 600.55, width: 30, height: 9, covered: false }],
            },
          ],
        },
      ],
    };
    const submission = toSubmission(anonymizeLayout(layout, new Map(), seeded(1)));
    expect(submission.pages[0]).toMatchObject({ width: 595.3, height: 841.9 });
    expect(submission.pages[0].lines[0].y).toBeCloseTo(841.9, 5);
    expect(submission.pages[0].lines[0].words[0].x).toBeCloseTo(595.3, 5);
    expect(validateLayoutSubmission(submission).ok).toBe(true);
  });

  it('includes a non-empty rule draft and omits an empty one', () => {
    const anon = anonymizeLayout(payslip(), none, seeded(3));
    const draft = { lines: [{ page: 0, line: 3, figure: 'GROSS' as const, deduction: false }] };
    expect(toSubmission(anon, draft).ruleDraft).toEqual(draft);
    expect(validateLayoutSubmission(toSubmission(anon, draft)).ok).toBe(true);
    expect(toSubmission(anon, { lines: [] }).ruleDraft).toBeUndefined();
  });

  it('keeps a leading wage-type code but still replaces other numbers', () => {
    const layout: AnalyzedLayout = {
      pages: [
        {
          width: 595,
          height: 842,
          lines: [
            { y: 10, words: [word('2000', 10), word('Gehalt', 50), word('4.600,00', 400, 40)] },
            { y: 20, words: [word('2000', 10), word('4.600,00', 400, 40)] },
            { y: 30, words: [word('Brutto', 10), word('2000', 100)] },
          ],
        },
      ],
    };
    const [coded, plain, late] = wordsOf(anonymizeLayout(layout, none, seeded(3)));
    expect(coded[0]).toMatchObject({ text: '2000', mark: 'LABEL' });
    expect(coded[2].text).not.toBe('4.600,00');
    expect(plain[0].mark).toBe('VALUE');
    expect(late[1].mark).toBe('VALUE');
  });

  it('keeps the line size below the distance to the line underneath', () => {
    const layout: AnalyzedLayout = {
      pages: [
        {
          width: 595,
          height: 842,
          lines: [
            { y: 10, words: [{ ...word('Brutto', 10), height: 12 }] },
            { y: 17.7, words: [word('Netto', 12)] },
          ],
        },
      ],
    };
    const { lines } = toSubmission(anonymizeLayout(layout, none, seeded(1))).pages[0];
    expect(lines[0].size).toBe(7); // 7.7 pt / 1.1
  });

  it('shrinks the line size so neighbouring words do not overlap', () => {
    const crowded: AnalyzedLayout = {
      pages: [
        {
          width: 595,
          height: 842,
          lines: [
            {
              y: 10,
              words: [
                { ...word('Geburtsdatum', 10), height: 14 },
                { ...word('Konfession', 60), height: 14 },
              ],
            },
          ],
        },
      ],
    };
    const { size } = toSubmission(anonymizeLayout(crowded, none, seeded(1))).pages[0].lines[0];
    expect(size).toBeCloseTo(6.9, 1); // 50 pt for 12 Courier characters
    expect(size).toBeGreaterThanOrEqual(5);
  });

  it('derives the line size from the tallest word, within 5..20', () => {
    const tall = (height: number): AnalyzedLayout => ({
      pages: [
        {
          width: 595,
          height: 842,
          lines: [
            {
              y: 10,
              words: [
                { ...word('Brutto', 1), height },
                { ...word('Netto', 300), height: 3 },
              ],
            },
          ],
        },
      ],
    });
    expect(
      toSubmission(anonymizeLayout(tall(10.04), new Map(), seeded(1))).pages[0].lines[0].size,
    ).toBe(10);
    expect(
      toSubmission(anonymizeLayout(tall(40), new Map(), seeded(1))).pages[0].lines[0].size,
    ).toBe(20);
    expect(
      toSubmission(anonymizeLayout(tall(2), new Map(), seeded(1))).pages[0].lines[0].size,
    ).toBe(5);
    const unknown: AnalyzedLayout = {
      pages: [
        {
          width: 595,
          height: 842,
          lines: [{ y: 10, words: [{ ...word('Brutto', 1), height: NaN }] }],
        },
      ],
    };
    expect(
      toSubmission(anonymizeLayout(unknown, new Map(), seeded(1))).pages[0].lines[0].size,
    ).toBe(9);
  });
});

describe('layoutLimitProblem', () => {
  const page = (lines: number, wordsPerLine = 1): AnalyzedLayout['pages'][number] => ({
    width: 595,
    height: 842,
    lines: Array.from({ length: lines }, () => ({
      y: 1,
      words: Array.from({ length: wordsPerLine }, () => word('a', 1)),
    })),
  });

  it('accepts documents within the limits', () => {
    expect(layoutLimitProblem({ pages: [page(120, 24), page(1), page(1)] })).toBeNull();
  });

  it('flags documents the server would refuse', () => {
    expect(layoutLimitProblem({ pages: [] })).toBe('NO_TEXT');
    expect(layoutLimitProblem({ pages: [page(0)] })).toBe('NO_TEXT');
    expect(layoutLimitProblem({ pages: [page(1), page(1), page(1), page(1)] })).toBe(
      'TOO_MANY_PAGES',
    );
    expect(layoutLimitProblem({ pages: [page(121)] })).toBe('TOO_LARGE');
    expect(layoutLimitProblem({ pages: [page(1, 41)] })).toBe('TOO_LARGE');
    expect(layoutLimitProblem({ pages: [page(100, 31)] })).toBe('TOO_LARGE'); // 3 100 words
  });

  it('does not count empty pages', () => {
    expect(layoutLimitProblem({ pages: [page(1), page(0), page(1), page(1)] })).toBeNull();
  });
});
