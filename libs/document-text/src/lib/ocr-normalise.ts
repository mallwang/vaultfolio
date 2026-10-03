/** Letters text recognition commonly returns for a digit, and the digit they stand for. */
const LOOKALIKES: Readonly<Record<string, string>> = {
  O: '0',
  o: '0',
  l: '1',
  I: '1',
  S: '5',
};

/** A number/amount token whose digits may be misread: signs, digits, look-alike letters, `.` and `,`. */
const NUMBER_LIKE = /^[-+]?[\dOolIS.,]+-?$/;

/**
 * Replaces digit look-alike letters (`O`/`o`→`0`, `l`/`I`→`1`, `S`→`5`) inside a recognised word,
 * but only when the whole word otherwise looks like a number or amount and holds at least one real
 * digit (`1.20O,00` → `1.200,00`; `SOLL`, `IS` and `Sl` are left alone). Whitespace is never merged
 * and no missing separator is guessed: a lost decimal comma stays lost so the arithmetic check
 * fails visibly instead of the figure being silently "healed" (034 research R5).
 */
export function normaliseRecognisedWord(word: string): string {
  if (!NUMBER_LIKE.test(word) || !/\d/.test(word)) return word;
  return word.replace(/[OolIS]/g, (c) => LOOKALIKES[c]);
}
