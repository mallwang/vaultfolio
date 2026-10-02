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
    wordOf.push(...Array.from({ length: word.text.length }, () => index));
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
  if (digits.length !== 11 || digits.startsWith('0')) return false;
  const first10 = Array.from(digits.slice(0, 10), Number);
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

// ----------------------------------------------------------------------- lenient (OCR) mode

/**
 * Characters text recognition may return in place of a digit: the digits themselves and their
 * look-alike letters (`O`/`o`→0, `l`/`I`→1, `S`→5). Lenient matching accepts any of them anywhere
 * in an identifier and never checks a check digit, because a misread digit — letter or other
 * digit — must not let an identifier through (034 FR-011, research R6).
 */
const DIGIT_LIKE = /[0-9OolIS]/;
/** An identifier needs at least this many genuine digits, so words made of look-alike letters alone never match. */
const MIN_REAL_DIGITS = 6;

const realDigits = (text: string): number => text.replaceAll(/\D/g, '').length;

/** Whether the word starting at `start` consists of digit-like characters only (so `Summe` never continues a group). */
function isDigitLikeToken(text: string, start: number): boolean {
  let end = start;
  while (end < text.length && text[end] !== ' ') end += 1;
  if (end === start) return false;
  for (const char of text.slice(start, end)) if (!DIGIT_LIKE.test(char)) return false;
  return true;
}

/**
 * Between `min` and `max` digit-like characters from `start`, groups separated by single spaces,
 * with the end offset. Recognition also drops or inserts characters (`DE03` read as `DE0O3`), so an
 * IBAN is accepted within a small tolerance of its length.
 */
function takeDigitLike(
  text: string,
  start: number,
  min: number,
  max = min,
): { compact: string; end: number } | null {
  let compact = '';
  let end = start;
  let i = start;
  while (i < text.length && compact.length < max) {
    const char = text[i];
    if (DIGIT_LIKE.test(char)) {
      compact += char;
      end = i + 1;
    } else if (char !== ' ' || compact === '' || !isDigitLikeToken(text, i + 1)) break;
    i += 1;
  }
  return compact.length >= min ? { compact, end } : null;
}

/** An IBAN group: letters and digits only — up to 6 characters, or the rest of the first word. */
const IBAN_GROUP = /^[A-Za-z0-9]{1,6}$/;
const IBAN_FIRST_GROUP = /^[A-Za-z0-9]{2,26}$/;
/** Characters after `DE` (check digits plus account number): 20 in a German IBAN; recognition may drop or add some. */
const IBAN_MIN = 18;
const IBAN_MAX = 28;
const IBAN_FULL = 22;
const IBAN_MIN_DIGITS = 10;

const isIbanGroup = (group: string, first: boolean): boolean =>
  first
    ? IBAN_FIRST_GROUP.test(group)
    : IBAN_GROUP.test(group) && (/\d/.test(group) || /^[A-Z]{1,4}$/.test(group));

/**
 * The groups of a possible IBAN after `DE` at `afterPrefix`: the rest of the first word, then
 * following words (single spaces) until about 20 characters are reached.
 */
function ibanGroups(
  text: string,
  afterPrefix: number,
): { end: number; count: number; digits: number } {
  let end = afterPrefix;
  let count = 0;
  let digits = 0;
  let spanEnd = afterPrefix;
  let first = true;
  while (end <= text.length && count < IBAN_FULL) {
    const wordEnd = text.indexOf(' ', end);
    const group = text.slice(end, wordEnd < 0 ? undefined : wordEnd);
    if (!isIbanGroup(group, first)) break;
    count += group.length;
    digits += realDigits(group);
    spanEnd = end + group.length;
    first = false;
    if (wordEnd < 0) break;
    end = wordEnd + 1;
  }
  return { end: spanEnd, count, digits };
}

/**
 * German IBAN shape: `DE`, two digit-like characters, then groups of letters/digits until about 20
 * characters are reached. Unlike for the other identifiers a digit may be misread as any letter
 * (`DE03 7601 0085 0004 0123 45` read as `DE0O3 7601 0085 0004 0XXX XX`), so later groups accept
 * any letter if enough genuine digits remain; a group after the first needs a digit or at most four
 * capitals, so a following label is not swallowed.
 */
function findLenientIbans(line: JoinedLine): Span[] {
  const found: Span[] = [];
  for (const match of line.text.matchAll(/(?<![A-Za-z0-9])[Dd][Ee](?=[0-9OolIS]{2})/g)) {
    const { end, count, digits } = ibanGroups(line.text, match.index + 2);
    if (count >= IBAN_MIN && count <= IBAN_MAX && digits >= IBAN_MIN_DIGITS) {
      found.push({ start: match.index, end });
    }
  }
  return found;
}

/** 11 digit-like characters at a group boundary, first not 0, not part of an amount (`,`/`.` next to it). */
function findLenientTaxIds(line: JoinedLine): Span[] {
  const found: Span[] = [];
  for (let start = 0; start < line.text.length; start += 1) {
    if (start > 0 && line.text[start - 1] !== ' ') continue;
    if (!DIGIT_LIKE.test(line.text[start]) || /[0Oo]/.test(line.text[start])) continue;
    const taken = takeDigitLike(line.text, start, 11);
    if (!taken || isAlnum(line.text[taken.end]) || /[.,]/.test(line.text[taken.end] ?? ''))
      continue;
    if (realDigits(taken.compact) >= MIN_REAL_DIGITS) found.push({ start, end: taken.end });
  }
  return found;
}

/** Social-security number shape `12 345678 A 901` (check digit not required, digits may be look-alikes). */
function findLenientSocialSecurity(line: JoinedLine): Span[] {
  const found: Span[] = [];
  for (let start = 0; start < line.text.length; start += 1) {
    if (!DIGIT_LIKE.test(line.text[start]) || isAlnum(line.text[start - 1])) continue;
    const taken = takeAlnum(line.text, start, 12);
    if (!taken || isAlnum(line.text[taken.end])) continue;
    if (/^[0-9OolIS]{8}[A-Z][0-9OolIS]{3}$/.test(taken.compact) && realDigits(taken.compact) >= 5) {
      found.push({ start, end: taken.end });
    }
  }
  return found;
}

// ------------------------------------------------------------------------------------- scan

export interface ScanOptions {
  /**
   * Shape-only matching for IBAN, tax ID and social-security number, for text read by text
   * recognition (034). It over-matches on purpose (an 11-digit amount-like run counts as a tax ID):
   * for recognised text, removing too much is acceptable, letting a misread identifier through is
   * not. Strict matching, with check digits, stays the default and the only mode on the server.
   */
  lenient?: boolean;
}

/**
 * Personal-data detectors for one line (R3). A match may span several words (an IBAN or tax ID
 * printed in groups); it is mapped back to the word indexes it touches.
 */
export function scanLine(words: readonly { text: string }[], options: ScanOptions = {}): LineHit[] {
  const line = joinWords(words);
  const spans = (kind: PersonalDataKind, found: Span[]): LineHit[] =>
    found.map(({ start, end }) => ({ kind, wordIndexes: wordsInRange(line, start, end) }));
  const wordHits = (kind: PersonalDataKind, found: number[][]): LineHit[] =>
    found.map((wordIndexes) => ({ kind, wordIndexes }));

  const lenient = options.lenient === true;
  const found = [
    ...spans('BANK_ACCOUNT', [...findIbans(line), ...(lenient ? findLenientIbans(line) : [])]),
    ...spans('TAX_ID', [...findTaxIds(line), ...(lenient ? findLenientTaxIds(line) : [])]),
    ...spans('SOCIAL_SECURITY', [
      ...findSocialSecurity(line),
      ...(lenient ? findLenientSocialSecurity(line) : []),
    ]),
    ...wordHits('EMAIL', findEmails(words)),
    ...spans('PHONE', findPhones(line)),
    ...wordHits('POSTCODE_CITY', findPostcodeCities(words)),
  ];
  // strict and lenient rules may find the same identifier: one finding
  const seen = new Set<string>();
  const hits = found.filter((hit) => {
    const key = `${hit.kind}:${hit.wordIndexes.join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

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
export function scanDocument(
  doc: { pages: { lines: { words: { text: string }[] }[] }[] },
  options: ScanOptions = {},
): PersonalDataHit[] {
  return doc.pages.flatMap((page, pageIndex) =>
    page.lines.flatMap((line, lineIndex) =>
      scanLine(line.words, options).map((hit) => ({ ...hit, page: pageIndex, line: lineIndex })),
    ),
  );
}
