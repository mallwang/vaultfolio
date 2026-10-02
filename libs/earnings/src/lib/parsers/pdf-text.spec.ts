import {
  allLines,
  amountAtColumn,
  amountsIn,
  documentText,
  findLine,
  labelOf,
  parseGermanAmount,
  textDocument,
  textLine,
} from './pdf-text';

describe('parseGermanAmount', () => {
  it.each([
    ['1.234,56', '1234.56'],
    ['3.750,00', '3750.00'],
    ['591,70-', '-591.70'],
    ['-5,63', '-5.63'],
    ['0,00', '0.00'],
    ['1.000.000,01', '1000000.01'],
    ['12,5', null],
    ['abc', null],
  ])('%s → %s', (input, expected) => {
    expect(parseGermanAmount(input)).toBe(expected);
  });
});

describe('amountsIn / labelOf', () => {
  it('finds all amounts and ignores hours/days quantities', () => {
    expect(amountsIn('1000 Tarifgehalt 160,00 H 3.750,00 G')).toEqual(['3750.00']);
    expect(amountsIn('/55E Gesetzl. Netto 3.158,30')).toEqual(['3158.30']);
    expect(amountsIn('Y551 Nettodifferenz 65,27-')).toEqual(['-65.27']);
    expect(amountsIn('Summe 1.234,56 12,00-E')).toEqual(['1234.56', '12.00']);
    expect(amountsIn('no money')).toEqual([]);
  });

  it('returns the label before the first amount', () => {
    expect(labelOf('Tarifgehalt 21,00 T 3.750,00')).toBe('Tarifgehalt');
    expect(labelOf('Gesamtbrutto')).toBe('Gesamtbrutto');
  });
});

describe('line helpers', () => {
  const doc = textDocument([
    ['Kopf', 'Entgeltnachweis für September 2026'],
    ['Gesamtbrutto 5.000,00'],
  ]);

  it('finds lines by substring or regex', () => {
    expect(findLine(doc, 'Gesamtbrutto')?.text).toBe('Gesamtbrutto 5.000,00');
    expect(findLine(doc, /Entgeltnachweis für (\w+)/)?.text).toContain('September');
    expect(findLine(doc, 'missing')).toBeUndefined();
  });

  it('joins the document text by lines', () => {
    expect(documentText(doc)).toBe(
      'Kopf\nEntgeltnachweis für September 2026\nGesamtbrutto 5.000,00',
    );
  });

  it('reads the amount at a column position', () => {
    const line = {
      text: 'Lohnsteuer 800,00 1.200,00',
      y: 0,
      words: [
        { text: 'Lohnsteuer', x: 10, width: 50 },
        { text: '800,00', x: 300, width: 30 },
        { text: '1.200,00', x: 400, width: 40 },
      ],
    };
    expect(amountAtColumn(line, 310)).toBe('800.00');
    expect(amountAtColumn(line, 441)).toBe('1200.00');
    expect(amountAtColumn(line, 200)).toBeNull();
  });

  it('builds evenly spaced lines', () => {
    expect(textLine('a  bb', 3)).toEqual({
      text: 'a bb',
      y: 3,
      words: [
        { text: 'a', x: 0, width: 5 },
        { text: 'bb', x: 10, width: 10 },
      ],
    });
  });

  it('ignores the text origin in helpers', () => {
    const extracted = textDocument([['Gesamtbrutto 5.000,00']]);
    const recognised = { ...extracted, origin: 'RECOGNISED' as const };
    expect(allLines(recognised)).toEqual(allLines(extracted));
    expect(documentText(recognised)).toBe(documentText(extracted));
    expect(findLine(recognised, 'Gesamtbrutto')?.text).toBe('Gesamtbrutto 5.000,00');
  });
});
