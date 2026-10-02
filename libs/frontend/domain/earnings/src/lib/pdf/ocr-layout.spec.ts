import { CONFIDENCE_FLOOR, recognisedWordsToPage, type RecognisedWord } from './ocr-layout';

function word(
  text: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  confidence = 90,
): RecognisedWord {
  return { text, confidence, bbox: { x0, y0, x1, y1 } };
}

describe('recognisedWordsToPage', () => {
  it('converts pixel boxes to PDF points with y growing upwards', () => {
    const page = recognisedWordsToPage([word('Brutto', 30, 60, 90, 90)], 3, 300);
    expect(page.lines).toEqual([
      { text: 'Brutto', y: 70, words: [{ text: 'Brutto', x: 10, width: 20 }] },
    ]);
  });

  it('regroups table cells the engine split into separate lines into one row', () => {
    const page = recognisedWordsToPage(
      [
        word('800,00', 600, 102, 700, 130),
        word('Lohnsteuer', 30, 100, 300, 128),
        word('1.200,00', 800, 99, 930, 127),
      ],
      3,
      600,
    );
    expect(page.lines).toHaveLength(1);
    expect(page.lines[0].text).toBe('Lohnsteuer 800,00 1.200,00');
    expect(page.lines[0].words.map((w) => w.x)).toEqual([10, 200, 800 / 3]);
  });

  it('sorts rows top to bottom and keeps separate rows apart', () => {
    const page = recognisedWordsToPage(
      [
        word('Netto', 30, 400, 120, 428),
        word('Brutto', 30, 100, 130, 128),
        word('5.000,00', 600, 100, 740, 128),
      ],
      3,
      600,
    );
    expect(page.lines.map((l) => l.text)).toEqual(['Brutto 5.000,00', 'Netto']);
    expect(page.lines[0].y).toBeGreaterThan(page.lines[1].y);
  });

  it('drops empty and low-confidence words', () => {
    const page = recognisedWordsToPage(
      [
        word('Brutto', 30, 100, 130, 128),
        word('  ', 140, 100, 150, 128),
        word('~#', 160, 100, 190, 128, CONFIDENCE_FLOOR - 1),
      ],
      3,
      600,
    );
    expect(page.lines.map((l) => l.text)).toEqual(['Brutto']);
  });

  it('normalises look-alike letters inside amounts only', () => {
    const page = recognisedWordsToPage(
      [word('SOLL', 30, 100, 100, 128), word('1.20O,00', 200, 100, 330, 128)],
      3,
      600,
    );
    expect(page.lines[0].text).toBe('SOLL 1.200,00');
  });

  it('returns no lines for a page without usable words', () => {
    expect(recognisedWordsToPage([], 3, 600).lines).toEqual([]);
  });
});
