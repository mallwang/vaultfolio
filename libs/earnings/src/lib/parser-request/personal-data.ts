import { isKnownLabel } from './label-vocabulary.js';

export type PersonalDataKind =
  'BANK_ACCOUNT' | 'TAX_ID' | 'SOCIAL_SECURITY' | 'EMAIL' | 'PHONE' | 'POSTCODE_CITY';

export interface PersonalDataHit {
  kind: PersonalDataKind;
  page: number;
  line: number;
  wordIndexes: number[];
}

interface LineHit {
  kind: PersonalDataKind;
  wordIndexes: number[];
}

interface Span {
  start: number;
  end: number;
}

interface JoinedLine {
  /** Words joined by single spaces. */
  text: string;
  /** Word index of every character of `text`; `-1` for the joining spaces. */
  wordOf: number[];
}

function joinWords(words: readonly { text: string }[]): JoinedLine {
  let text = '';
  const wordOf: number[] = [];
  words.forEach((word, index) => {
    if (index > 0) {
      text += ' ';
      wordOf.push(-1);
    }
    text += word.text;
    for (let i = 0; i < word.text.length; i += 1) wordOf.push(index);
  });
  return { text, wordOf };
}

function wordsInRange(line: JoinedLine, start: number, end: number): number[] {
  const indexes = new Set<number>();
  for (let i = start; i < end; i += 1) {
    if (line.wordOf[i] >= 0) indexes.add(line.wordOf[i]);
  }
  return [...indexes].sort((a, b) => a - b);
}

const isAlnum = (char: string | undefined): boolean =>
  char !== undefined && /[A-Za-z0-9]/.test(char);

// ------------------------------------------------------------------------------------- IBAN

/** ISO 13616 check: rearranged number mod 97 equals 1. */
function validIban(compact: string): boolean {
  const rearranged = compact.slice(4) + compact.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const value = char >= 'A' ? String((char.codePointAt(0) as number) - 55) : char;
    for (const digit of value) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

/** End offset of the longest valid IBAN starting at `start` (groups separated by single spaces), or -1. */
function ibanEnd(text: string, start: number): number {
  let compact = '';
  let best = -1;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (!isAlnum(char)) {
      if (char !== ' ' || !isAlnum(text[i + 1])) break;
      continue;
    }
    compact += char.toUpperCase();
    if (compact.length > 34) break;
    const endsAtWordEnd = !isAlnum(text[i + 1]);
    if (compact.length >= 15 && endsAtWordEnd && validIban(compact)) best = i + 1;
  }
  return best;
}

function findIbans(line: JoinedLine): Span[] {
  const found: Span[] = [];
  for (const match of line.text.matchAll(/(?<![A-Za-z0-9])[A-Za-z]{2}\d{2}/g)) {
    const end = ibanEnd(line.text, match.index);
    if (end > 0) found.push({ start: match.index, end });
  }
  return found;
}

// ------------------------------------------------------------------------------------- tax ID

/** ISO 7064 MOD 11,10 check digit of the first ten digits. */
function taxIdCheckDigit(first10: number[]): number {
  let product = 10;
  for (const digit of first10) {
    let sum = (digit + product) % 10;
    if (sum === 0) sum = 10;
    product = (sum * 2) % 11;
  }
  const check = 11 - product;
  return check === 10 ? 0 : check;
}

function validTaxId(digits: string): boolean {
  if (digits.length !== 11 || digits[0] === '0') return false;
  const first10 = [...digits.slice(0, 10)].map(Number);
  const counts = new Map<number, number>();
  for (const digit of first10) counts.set(digit, (counts.get(digit) ?? 0) + 1);
  const repeated = [...counts.values()].filter((count) => count > 1);
  // exactly one digit occurs two or three times, and at least one digit is missing
  if (repeated.length !== 1 || repeated[0] > 3 || counts.size === 10) return false;
  if (/(\d)\1\1/.test(digits.slice(0, 10))) return false;
  return taxIdCheckDigit(first10) === Number(digits[10]);
}

// ------------------------------------------------------------------------- social security

function validSocialSecurity(compact: string): boolean {
  const area = compact.slice(0, 2);
  const day = Number(compact.slice(2, 4));
  const month = Number(compact.slice(4, 6));
  const letter = compact[8].toUpperCase();
  const serial = compact.slice(9, 11);
  const check = Number(compact[11]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return false;
  const letterValue = String((letter.codePointAt(0) as number) - 64).padStart(2, '0');
  const digits = [...area, ...compact.slice(2, 8), ...letterValue, ...serial].map(Number);
  const weights = [2, 1, 2, 5, 7, 1, 2, 1, 2, 1, 2, 1];
  const sum = digits.reduce((total, digit, i) => {
    const product = digit * weights[i];
    return total + Math.floor(product / 10) + (product % 10);
  }, 0);
  return sum % 10 === check;
}

/** The next `count` alphanumeric characters from `start`, groups separated by single spaces, with the end offset. */
function takeAlnum(
  text: string,
  start: number,
  count: number,
): { compact: string; end: number } | null {
  let compact = '';
  let i = start;
  while (i < text.length && compact.length < count) {
    if (isAlnum(text[i])) compact += text[i];
    else if (text[i] !== ' ' || !isAlnum(text[i + 1]) || compact === '') return null;
    i += 1;
  }
  return compact.length === count ? { compact, end: i } : null;
}

function findSocialSecurity(line: JoinedLine): Span[] {
  const found: Span[] = [];
  for (let start = 0; start < line.text.length; start += 1) {
    if (!isDigit(line.text[start]) || isAlnum(line.text[start - 1])) continue;
    const taken = takeAlnum(line.text, start, 12);
    if (!taken || isAlnum(line.text[taken.end])) continue;
    if (/^\d{8}[A-Za-z]\d{3}$/.test(taken.compact) && validSocialSecurity(taken.compact)) {
      found.push({ start, end: taken.end });
    }
  }
  return found;
}

// ------------------------------------------------------------------------------------- e-mail

const LOCAL_CHARS = new Set('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._%+-');
const DOMAIN_CHARS = new Set('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.-');

/** `local@domain.tld` somewhere in the text (surrounding punctuation allowed). */
function isEmailLike(candidate: string): boolean {
  const at = candidate.indexOf('@');
  if (at < 1 || !LOCAL_CHARS.has(candidate[at - 1])) return false;
  let end = at + 1;
  while (end < candidate.length && DOMAIN_CHARS.has(candidate[end])) end += 1;
  const labels = candidate
    .slice(at + 1, end)
    .replace(/\.$/, '')
    .split('.');
  const tld = labels.at(-1) as string;
  return labels.length >= 2 && labels.every((label) => label !== '') && /^[A-Za-z]{2,}$/.test(tld);
}

function findEmails(words: readonly { text: string }[]): number[][] {
  const hits: number[][] = [];
  words.forEach((word, index) => {
    if (!word.text.includes('@')) return;
    const indexes = [index];
    let candidate = word.text;
    if (word.text.startsWith('@') && index > 0) {
      indexes.unshift(index - 1);
      candidate = words[index - 1].text + candidate;
    }
    if (word.text.endsWith('@') && index + 1 < words.length) {
      indexes.push(index + 1);
      candidate += words[index + 1].text;
    }
    if (isEmailLike(candidate)) hits.push(indexes);
  });
  return hits;
}

// ------------------------------------------------------------------------- digit groups

const isDigit = (char: string | undefined): boolean =>
  char !== undefined && char >= '0' && char <= '9';

/** Maximal runs of digits whose groups are separated by single spaces (`12 345 678 901`). */
function digitRuns(text: string): Span[] {
  const runs: Span[] = [];
  let start = -1;
  for (let i = 0; i <= text.length; i += 1) {
    const inRun = isDigit(text[i]) || (start >= 0 && text[i] === ' ' && isDigit(text[i + 1]));
    if (inRun && start < 0) start = i;
    if (!inRun && start >= 0) {
      runs.push({ start, end: i });
      start = -1;
    }
  }
  return runs;
}

/** Eleven digits starting at `start` (group boundary inside `run`) and the end offset, or null. */
function elevenDigits(
  text: string,
  start: number,
  run: Span,
): { digits: string; end: number } | null {
  let digits = '';
  let end = start;
  while (end < run.end && digits.length < 11) {
    if (isDigit(text[end])) digits += text[end];
    end += 1;
  }
  return digits.length === 11 && !isDigit(text[end]) ? { digits, end } : null;
}

/** Windows of exactly 11 digits in a digit run, starting at a group boundary. */
function findTaxIds(line: JoinedLine): Span[] {
  const found: Span[] = [];
  for (const run of digitRuns(line.text)) {
    if (/[.,]/.test(line.text[run.start - 1] ?? '')) continue;
    for (let start = run.start; start < run.end; start += 1) {
      if (start > run.start && line.text[start - 1] !== ' ') continue;
      const window = elevenDigits(line.text, start, run);
      if (window && validTaxId(window.digits)) found.push({ start, end: window.end });
    }
  }
  return found;
}

const PHONE_CHARS = new Set('0123456789 ()/-');

/** End offset of a phone number starting at `start` (`+` or `0`, 8–15 digits, space `/` `-` `()` separators), or -1. */
function phoneEnd(text: string, start: number): number {
  const prefixed = text[start] === '+' || text[start] === '0';
  if (!prefixed || !isDigit(text[start + 1]) || /[\w.,]/.test(text[start - 1] ?? '')) return -1;
  let end = start + 1;
  while (end < text.length && PHONE_CHARS.has(text[end])) end += 1;
  while (end > start && !isDigit(text[end - 1])) end -= 1;
  const digitCount = text.slice(start, end).replaceAll(/\D/g, '').length;
  const continuesAsAmount = /^[.,]?\d/.test(text.slice(end, end + 2));
  return digitCount >= 8 && digitCount <= 15 && !continuesAsAmount ? end : -1;
}

function findPhones(line: JoinedLine): Span[] {
  const found: Span[] = [];
  let skipUntil = 0;
  for (let start = 0; start < line.text.length; start += 1) {
    if (start < skipUntil) continue;
    const end = phoneEnd(line.text, start);
    if (end > 0) {
      found.push({ start, end });
      skipUntil = end;
    }
  }
  return found;
}

function findPostcodeCities(words: readonly { text: string }[]): number[][] {
  const hits: number[][] = [];
  for (let i = 0; i + 1 < words.length; i += 1) {
    const city = words[i + 1].text;
    if (
      /^\d{5}$/.test(words[i].text) &&
      /^[A-ZÄÖÜ][\p{L}-]{2,}$/u.test(city) &&
      !isKnownLabel(city)
    ) {
      hits.push([i, i + 1]);
    }
  }
  return hits;
}

// ------------------------------------------------------------------------------------- scan

/**
 * Personal-data detectors for one line (R3). A match may span several words (an IBAN or tax ID
 * printed in groups); it is mapped back to the word indexes it touches.
 */
export function scanLine(words: readonly { text: string }[]): LineHit[] {
  const line = joinWords(words);
  const spans = (kind: PersonalDataKind, found: Span[]): LineHit[] =>
    found.map(({ start, end }) => ({ kind, wordIndexes: wordsInRange(line, start, end) }));
  const wordHits = (kind: PersonalDataKind, found: number[][]): LineHit[] =>
    found.map((wordIndexes) => ({ kind, wordIndexes }));

  const hits = [
    ...spans('BANK_ACCOUNT', findIbans(line)),
    ...spans('TAX_ID', findTaxIds(line)),
    ...spans('SOCIAL_SECURITY', findSocialSecurity(line)),
    ...wordHits('EMAIL', findEmails(words)),
    ...spans('PHONE', findPhones(line)),
    ...wordHits('POSTCODE_CITY', findPostcodeCities(words)),
  ];

  // a phone-shaped tail of an IBAN/tax ID/... is the same finding, not a second one
  return hits.filter(
    (hit) =>
      hit.kind !== 'PHONE' ||
      !hits.some(
        (other) =>
          other.kind !== 'PHONE' && hit.wordIndexes.every((w) => other.wordIndexes.includes(w)),
      ),
  );
}

/** Runs {@link scanLine} over every line of every page. */
export function scanDocument(doc: {
  pages: { lines: { words: { text: string }[] }[] }[];
}): PersonalDataHit[] {
  return doc.pages.flatMap((page, pageIndex) =>
    page.lines.flatMap((line, lineIndex) =>
      scanLine(line.words).map((hit) => ({ ...hit, page: pageIndex, line: lineIndex })),
    ),
  );
}
