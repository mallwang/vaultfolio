import { isKnownLabel } from './label-vocabulary.js';
import {
  type LayoutSubmissionV1,
  SUBMISSION_LIMITS,
  type SubmissionPage,
  sanitizeWordText,
} from './layout-submission.js';
import {
  type PersonalDataKind,
  type ScanOptions,
  scanDocument,
  scanLine,
} from './personal-data.js';
import type { SubmittedRuleDraft } from './rule-draft.js';

/** The document as read on the device (R4): positions per word and whether a shape covers it. */
export interface AnalyzedWord {
  text: string;
  /** Left edge in PDF points. */
  x: number;
  width: number;
  /** Glyph height ≈ font size. */
  height: number;
  /** Drawn over by a dark filled shape — probably hidden on purpose (FR-007). */
  covered: boolean;
  /** Recognised with low confidence by text recognition (034); never sent. */
  lowConfidence?: boolean;
}

export interface AnalyzedLine {
  /** Baseline from the top of the page. */
  y: number;
  words: AnalyzedWord[];
}

export interface AnalyzedPage {
  width: number;
  height: number;
  lines: AnalyzedLine[];
}

export interface AnalyzedLayout {
  pages: AnalyzedPage[];
}

export type WordDecision = 'KEEP' | 'MASK';

/** How a word appears in the sample: label (kept), value (digits replaced), removed (personal data), masked (default for unknown words), … */
export type WordMark = 'LABEL' | 'VALUE' | 'REMOVED' | 'MASKED' | 'KEPT';

export interface AnonWord {
  /** What would be sent for this word right now. */
  text: string;
  x: number;
  mark: WordMark;
  /** Removed words cannot be switched back. */
  locked: boolean;
  /** The word was recognised with low confidence (034): shown underlined; never sent. */
  lowConfidence?: boolean;
}

export interface AnonLine {
  y: number;
  size: number;
  words: AnonWord[];
}

export interface AnonPage {
  width: number;
  height: number;
  lines: AnonLine[];
}

export interface AnonymizedLayout {
  pages: AnonPage[];
  /** Kinds of personal data found in the original and removed (kinds only, never text). */
  removedKinds: PersonalDataKind[];
}

/** Courier advance in em: the sample is monospace, so right-aligning needs no font metrics (R2). */
export const COURIER_ADVANCE = 0.6;

const MAX_REROLLS = 20;
const FILL_DIGITS = ['0', '9', '5', '7', '3'];
const DEFAULT_SIZE = 9;

/**
 * A fragment that is no label worth deciding on: low-confidence recognition, or hardly any letters
 * (stray characters, punctuation, `l`/`1` mix-ups). Such words stay masked and are not listed.
 */
export function isNoiseWord(word: Pick<AnalyzedWord, 'text' | 'lowConfidence'>): boolean {
  const letters = [...word.text].filter((char) => /\p{L}/u.test(char)).length;
  return word.lowConfidence === true || letters < 2 || letters / word.text.length < 0.6;
}

/** Key of a word in the decision map: `<page>-<line>-<index>`. */
export function wordKey(page: number, line: number, index: number): string {
  return `${page}-${line}-${index}`;
}

function randomDigit(rng: () => number, min = 0): number {
  return min + Math.floor(rng() * (10 - min));
}

/**
 * Replaces every digit by a random one, keeping separators, letters and the position of every
 * character (same shape). The first digit of a number (`1.234,56`) is never zero unless the
 * original was zero (`0,50`), so a replacement does not look like a stripped number.
 */
export function replaceDigitsSameShape(text: string, rng: () => number): string {
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (!/\d/.test(char)) {
      out += char;
      continue;
    }
    const startsNumber = i === 0 || !/[\d.,]/.test(text[i - 1]);
    out += String(randomDigit(rng, startsNumber && char !== '0' ? 1 : 0));
  }
  return out;
}

function fillDigits(text: string, fill: string): string {
  return text.replaceAll(/\d/g, fill);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function maskText(length: number): string {
  return 'x'.repeat(clamp(length, 3, 20));
}

function removedText(length: number): string {
  return 'X'.repeat(clamp(length, 3, SUBMISSION_LIMITS.wordLength));
}

const DATE = /^\d{1,2}\.\d{1,2}\.\d{2,4}$/;

/** An amount or count such as `1.234,56`, `591,70-`, `-5,63`, `(12,00)` or `10%`. */
export function isNumericWord(text: string): boolean {
  let core = text;
  if (core !== '' && '-+('.includes(core[0])) core = core.slice(1);
  if (core !== '' && '-)%'.includes(core.at(-1) as string)) core = core.slice(0, -1);
  return core !== '' && /\d/.test(core) && [...core].every((char) => '0123456789.,'.includes(char));
}

/** Amounts and counts are right-aligned; dates and codes keep their left edge. */
function isRightAligned(text: string): boolean {
  return isNumericWord(text) && !DATE.test(text);
}

/**
 * The line's font size: the tallest word (5..20), shrunk so no word of the monospace sample runs
 * into the next one. Recognised text reports inflated heights on small print and the original's
 * proportional font is narrower than Courier, so the height alone makes neighbours overlap. It
 * also stays below the distance to the next line underneath, so tightly set blocks do not overprint.
 */
function lineSize(line: AnalyzedLine, page: AnalyzedLine[]): number {
  const heights = line.words.map((word) => word.height).filter((h) => Number.isFinite(h) && h > 0);
  const tallest = heights.length === 0 ? DEFAULT_SIZE : Math.max(...heights);
  let size = clamp(tallest, 5, 20);
  line.words.forEach((word, index) => {
    const next = line.words[index + 1];
    if (!next || isRightAligned(word.text) || word.text.length === 0) return;
    const room = next.x - word.x;
    if (room > 0) size = Math.min(size, room / (word.text.length * COURIER_ADVANCE));
  });
  size = Math.min(size, verticalRoom(line, page) / LINE_HEIGHT);
  return Math.round(clamp(size, 5, 20) * 10) / 10;
}

/** Line box height in em, as the preview draws it. */
const LINE_HEIGHT = 1.1;

/** Distance to the nearest line below that shares horizontal space with this one. */
function verticalRoom(line: AnalyzedLine, page: AnalyzedLine[]): number {
  const spans = line.words.map((word) => [word.x, word.x + word.width]);
  let room = Number.POSITIVE_INFINITY;
  for (const other of page) {
    const distance = other.y - line.y;
    if (distance <= 0.5 || distance >= room) continue;
    const overlaps = other.words.some((word) =>
      spans.some(([from, to]) => word.x < to && word.x + word.width > from),
    );
    if (overlaps) room = distance;
  }
  return room;
}

/**
 * A wage-type code (Lohnart) opening a line, such as `2000 Gehalt`: a 3–4 digit integer followed by a
 * word. It names the line and is no figure or personal data, so it is kept for the parser author.
 */
function isWageTypeCode(line: AnalyzedLine, index: number): boolean {
  return (
    index === 0 && /^\d{3,4}$/.test(line.words[0].text) && /^\p{L}/u.test(line.words[1]?.text ?? '')
  );
}

interface ValueRef {
  page: number;
  line: number;
  word: number;
  original: string;
}

/**
 * Builds the anonymized layout (R8, FR-005–FR-007): personal data is removed and locked, every
 * digit sequence is replaced by a random one of the same shape (re-rolled until the personal-data
 * scan finds nothing in the result, so browser and server verdicts agree), known labels are kept,
 * every other word is masked unless the user decides to keep it (covered words too). For text read by text
 * recognition pass `{ lenient: true }` so identifiers with misread digits are removed too (034).
 */
export function anonymizeLayout(
  layout: AnalyzedLayout,
  decisions: ReadonlyMap<string, WordDecision>,
  rng: () => number,
  scanOptions: ScanOptions = {},
): AnonymizedLayout {
  const removedKinds = new Set<PersonalDataKind>();
  const valueRefs: ValueRef[] = [];

  const pages: AnonPage[] = layout.pages.map((page, pageIndex) => ({
    width: page.width,
    height: page.height,
    lines: page.lines.map((line, lineIndex) => {
      const size = lineSize(line, page.lines);
      const hits = scanLine(line.words, scanOptions);
      const removed = new Set<number>();
      for (const hit of hits) {
        removedKinds.add(hit.kind);
        hit.wordIndexes.forEach((index) => removed.add(index));
      }
      const words = line.words.map((word, wordIndex): AnonWord => {
        const length = word.text.length;
        if (removed.has(wordIndex)) {
          return { text: removedText(length), x: word.x, mark: 'REMOVED', locked: true };
        }
        if (isWageTypeCode(line, wordIndex)) {
          return { text: word.text, x: word.x, mark: 'LABEL', locked: false };
        }
        if (/\d/.test(word.text)) {
          valueRefs.push({
            page: pageIndex,
            line: lineIndex,
            word: wordIndex,
            original: word.text,
          });
          const text = replaceDigitsSameShape(word.text, rng);
          return {
            text,
            x: valueX(word, text, size),
            mark: 'VALUE',
            locked: false,
            ...(word.lowConfidence ? { lowConfidence: true } : {}),
          };
        }
        const decision = decisions.get(wordKey(pageIndex, lineIndex, wordIndex));
        if (word.covered) {
          return decision === 'KEEP'
            ? { text: word.text, x: word.x, mark: 'KEPT', locked: false }
            : { text: maskText(length), x: word.x, mark: 'MASKED', locked: false };
        }
        if (!/\p{L}/u.test(word.text) || isKnownLabel(word.text)) {
          return { text: word.text, x: word.x, mark: 'LABEL', locked: false };
        }
        if (decision === 'KEEP') return { text: word.text, x: word.x, mark: 'KEPT', locked: false };
        return { text: maskText(length), x: word.x, mark: 'MASKED', locked: false };
      });
      return { y: line.y, size, words };
    }),
  }));

  const anon: AnonymizedLayout = {
    pages,
    removedKinds: [...removedKinds].sort((x, y) => x.localeCompare(y)),
  };
  const ctx: RerollContext = { anon, original: layout, rng, scanOptions };
  rerollUnchanged(ctx, valueRefs);
  rerollUntilClean(ctx, valueRefs);
  return anon;
}

/** x of a replaced value: right-aligned amounts keep the original right edge (Courier advance). */
function valueX(word: AnalyzedWord, text: string, size: number): number {
  if (!isRightAligned(word.text)) return word.x;
  return Math.max(0, word.x + word.width - text.length * COURIER_ADVANCE * size);
}

interface RerollContext {
  anon: AnonymizedLayout;
  original: AnalyzedLayout;
  rng: () => number;
  scanOptions: ScanOptions;
}

function wordAt(ctx: RerollContext, ref: ValueRef): AnonWord {
  return ctx.anon.pages[ref.page].lines[ref.line].words[ref.word];
}

function reroll(ctx: RerollContext, ref: ValueRef, make: (text: string) => string): void {
  const word = wordAt(ctx, ref);
  const source = ctx.original.pages[ref.page].lines[ref.line].words[ref.word];
  const size = ctx.anon.pages[ref.page].lines[ref.line].size;
  word.text = make(ref.original);
  word.x = valueX(source, word.text, size);
}

/** No digit sequence of the original survives, not even by chance. */
function rerollUnchanged(ctx: RerollContext, refs: ValueRef[]): void {
  for (const ref of refs) {
    for (let i = 0; i < MAX_REROLLS && wordAt(ctx, ref).text === ref.original; i += 1) {
      reroll(ctx, ref, (text) => replaceDigitsSameShape(text, ctx.rng));
    }
    if (wordAt(ctx, ref).text === ref.original) reroll(ctx, ref, (text) => fillDigits(text, '0'));
  }
}

function valueRefsByLine(refs: ValueRef[]): Map<string, ValueRef[]> {
  const byLine = new Map<string, ValueRef[]>();
  for (const ref of refs) {
    const key = `${ref.page}-${ref.line}`;
    byLine.set(key, [...(byLine.get(key) ?? []), ref]);
  }
  return byLine;
}

/**
 * A replaced value may form personal-data-looking text (a valid IBAN by chance): re-roll the values
 * involved until the scan is clean; after the bounded retries fall back to a constant fill digit.
 */
function rerollUntilClean(ctx: RerollContext, refs: ValueRef[]): void {
  const byLine = valueRefsByLine(refs);
  for (let attempt = 0; attempt <= MAX_REROLLS; attempt += 1) {
    const hits = scanDocument(ctx.anon, ctx.scanOptions);
    if (hits.length === 0) return;
    const make =
      attempt < MAX_REROLLS
        ? (text: string) => replaceDigitsSameShape(text, ctx.rng)
        : (text: string) =>
            fillDigits(text, FILL_DIGITS[Math.floor(ctx.rng() * FILL_DIGITS.length)]);
    for (const hit of hits) {
      (byLine.get(`${hit.page}-${hit.line}`) ?? [])
        .filter((ref) => hit.wordIndexes.includes(ref.word))
        .forEach((ref) => reroll(ctx, ref, make));
    }
  }
}

export type LayoutLimitProblem = 'NO_TEXT' | 'TOO_MANY_PAGES' | 'TOO_LARGE';

/** Whether the document fits what the server accepts (SUBMISSION_LIMITS); `null` when it does. */
export function layoutLimitProblem(layout: AnalyzedLayout): LayoutLimitProblem | null {
  const populated = layout.pages.filter((page) => page.lines.some((line) => line.words.length > 0));
  if (populated.length === 0) return 'NO_TEXT';
  if (populated.length > SUBMISSION_LIMITS.pages) return 'TOO_MANY_PAGES';
  let words = 0;
  for (const page of populated) {
    if (page.lines.length > SUBMISSION_LIMITS.linesPerPage) return 'TOO_LARGE';
    for (const line of page.lines) {
      if (line.words.length > SUBMISSION_LIMITS.wordsPerLine) return 'TOO_LARGE';
      words += line.words.length;
    }
  }
  return words > SUBMISSION_LIMITS.wordsTotal ? 'TOO_LARGE' : null;
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

/** Builds the Layout Submission v1 from the current preview; undecided words are sent masked. */
export function toSubmission(
  anon: AnonymizedLayout,
  draft?: SubmittedRuleDraft,
): LayoutSubmissionV1 {
  const pages: SubmissionPage[] = anon.pages.map((page) => ({
    width: round1(page.width),
    height: round1(page.height),
    lines: page.lines.map((line) => ({
      y: clamp(round1(line.y), 0, round1(page.height)),
      size: line.size,
      words: line.words.map((word) => ({
        text: sanitizeWordText(word.text),
        x: clamp(round1(word.x), 0, round1(page.width)),
      })),
    })),
  }));
  const submission: LayoutSubmissionV1 = { schemaVersion: 1, pages };
  if (draft && (draft.lines.length > 0 || draft.period)) submission.ruleDraft = draft;
  return submission;
}
