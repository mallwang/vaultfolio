import { normaliseRecognisedWord } from './ocr-normalise';

describe('normaliseRecognisedWord', () => {
  it.each([
    ['1.20O,00', '1.200,00'],
    ['4.6OO,OO', '4.600,00'],
    ['l.234,56', '1.234,56'],
    ['S.000,00', '5.000,00'],
    ['5o,5I', '50,51'],
    ['-I2,00', '-12,00'],
    ['591,7O-', '591,70-'],
  ])('maps look-alikes inside the number token %s', (input, expected) => {
    expect(normaliseRecognisedWord(input)).toBe(expected);
  });

  it.each(['SOLL', 'IS', 'Sl', 'Olaf', 'Lohnsteuer', 'DE0O3', 'O', 'I.', ',,'])(
    'leaves non-number token %s alone',
    (word) => {
      expect(normaliseRecognisedWord(word)).toBe(word);
    },
  );

  it('does not merge whitespace or restore a lost separator', () => {
    expect(normaliseRecognisedWord('4.600 7 00')).toBe('4.600 7 00');
    expect(normaliseRecognisedWord('4.51500')).toBe('4.51500');
    expect(normaliseRecognisedWord('1.20 00 O0')).toBe('1.20 00 O0');
  });
});
