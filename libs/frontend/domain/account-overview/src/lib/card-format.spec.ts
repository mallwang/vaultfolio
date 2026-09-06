import { formatCardNumberInput, formatExpirationInput } from './card-format';

describe('formatCardNumberInput', () => {
  it('groups digits into blocks of 4', () => {
    expect(formatCardNumberInput('411111111111')).toBe('4111 1111 1111 ');
  });

  it('ignores non-digit characters already present', () => {
    expect(formatCardNumberInput('4111 1111-1111')).toBe('4111 1111 1111 ');
  });

  it('inserts the blank right after the 4th digit of a block, before the next block starts', () => {
    expect(formatCardNumberInput('4111')).toBe('4111 ');
    expect(formatCardNumberInput('41111')).toBe('4111 1');
  });

  it('caps at 19 digits, with no trailing blank once the cap is reached', () => {
    expect(formatCardNumberInput('12345678901234567890')).toBe('1234 5678 9012 3456 789');
  });

  it('returns an empty string for empty input', () => {
    expect(formatCardNumberInput('')).toBe('');
  });
});

describe('formatExpirationInput', () => {
  it('passes through a single digit unchanged', () => {
    expect(formatExpirationInput('0')).toBe('0');
  });

  it('inserts the slash right after the 2nd digit, even with no year digits yet', () => {
    expect(formatExpirationInput('09')).toBe('09/');
  });

  it('keeps the slash as year digits are typed', () => {
    expect(formatExpirationInput('092')).toBe('09/2');
    expect(formatExpirationInput('0928')).toBe('09/28');
  });

  it('ignores non-digit characters already present', () => {
    expect(formatExpirationInput('09/28')).toBe('09/28');
  });

  it('caps at 4 digits', () => {
    expect(formatExpirationInput('092812345')).toBe('09/28');
  });
});
