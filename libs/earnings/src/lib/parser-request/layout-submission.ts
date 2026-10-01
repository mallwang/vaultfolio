import {
  FIGURE_TYPES,
  RULE_FORMATS,
  type SubmittedRuleDraft,
  type SubmittedRuleLine,
} from './rule-draft.js';

/**
 * Layout Submission v1 (contracts/layout-submission-v1.md): the only thing the browser sends for a
 * parser request — structured, anonymized layout data, never a file and never original values. The
 * same strict validator runs in the browser (before sending) and on the server.
 */

export interface SubmissionWord {
  text: string;
  /** Left edge in PDF points; numbers are already right-aligned by the browser. */
  x: number;
}

export interface SubmissionLine {
  /** Baseline from the top of the page. */
  y: number;
  /** Font size in points. */
  size: number;
  words: SubmissionWord[];
}

export interface SubmissionPage {
  width: number;
  height: number;
  lines: SubmissionLine[];
}

export interface LayoutSubmissionV1 {
  schemaVersion: 1;
  pages: SubmissionPage[];
  ruleDraft?: SubmittedRuleDraft;
}

export const SUBMISSION_LIMITS = {
  pages: 3,
  linesPerPage: 120,
  wordsPerLine: 40,
  wordsTotal: 3000,
  wordLength: 60,
  ruleLines: 60,
} as const;

export type LayoutErrorCode =
  'INVALID_LAYOUT' | 'LAYOUT_UNKNOWN_FIELD' | 'LIMIT_EXCEEDED' | 'INVALID_RULE_DRAFT';

export type ValidationResult =
  { ok: true; value: LayoutSubmissionV1 } | { ok: false; code: LayoutErrorCode; path: string };

/** Letters, digits, combining marks and the printable punctuation of the contract — no whitespace, control or bidi characters. */
const ALLOWED_WORD = /^[\p{L}\p{N}\p{M}.,;:\-_/()%&+*='"€§#@!?°]+$/u;
const DISALLOWED_CHAR = /[^\p{L}\p{N}\p{M}.,;:\-_/()%&+*='"€§#@!?°]/gu;

/** Replaces characters the schema does not allow with `?` and clamps the length; never returns an empty word. */
export function sanitizeWordText(text: string): string {
  const normalized = text
    .replaceAll(/[‘’‚]/g, "'")
    .replaceAll(/[“”„]/g, '"')
    .replaceAll(/[–—]/g, '-');
  const sanitized = normalized
    .replaceAll(DISALLOWED_CHAR, '?')
    .slice(0, SUBMISSION_LIMITS.wordLength);
  return sanitized === '' ? '?' : sanitized;
}

class Rejection {
  constructor(
    readonly code: LayoutErrorCode,
    readonly path: string,
  ) {}
}

function reject(code: LayoutErrorCode, path: string): never {
  throw new Rejection(code, path);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Exact key set: no unknown key (the key name is never echoed), no missing required key. */
function exactKeys(
  value: unknown,
  path: string,
  required: readonly string[],
  optional: readonly string[],
  invalidCode: LayoutErrorCode,
): Record<string, unknown> {
  if (!isRecord(value)) return reject(invalidCode, path);
  const keys = Object.keys(value);
  if (keys.some((key) => !required.includes(key) && !optional.includes(key))) {
    return reject('LAYOUT_UNKNOWN_FIELD', path);
  }
  for (const key of required) {
    if (!(key in value)) return reject(invalidCode, `${path}.${key}`);
  }
  return value;
}

function finiteNumber(
  value: unknown,
  path: string,
  min: number,
  max: number,
  code: LayoutErrorCode,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    return reject(code, path);
  }
  return value;
}

function nonNegativeInteger(
  value: unknown,
  path: string,
  max: number,
  code: LayoutErrorCode,
): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value >= max) {
    return reject(code, path);
  }
  return value;
}

function validateWord(input: unknown, path: string, width: number): SubmissionWord {
  const word = exactKeys(input, path, ['text', 'x'], [], 'INVALID_LAYOUT');
  const text = word['text'];
  if (typeof text !== 'string' || text.length === 0)
    return reject('INVALID_LAYOUT', `${path}.text`);
  if (text.length > SUBMISSION_LIMITS.wordLength) return reject('LIMIT_EXCEEDED', `${path}.text`);
  if (!ALLOWED_WORD.test(text)) return reject('INVALID_LAYOUT', `${path}.text`);
  return { text, x: finiteNumber(word['x'], `${path}.x`, 0, width, 'INVALID_LAYOUT') };
}

function validateLine(
  input: unknown,
  path: string,
  page: { width: number; height: number },
  counter: { words: number },
): SubmissionLine {
  const line = exactKeys(input, path, ['y', 'size', 'words'], [], 'INVALID_LAYOUT');
  const y = finiteNumber(line['y'], `${path}.y`, 0, page.height, 'INVALID_LAYOUT');
  const size = finiteNumber(line['size'], `${path}.size`, 5, 20, 'INVALID_LAYOUT');
  const words = line['words'];
  if (!Array.isArray(words) || words.length === 0) return reject('INVALID_LAYOUT', `${path}.words`);
  if (words.length > SUBMISSION_LIMITS.wordsPerLine)
    return reject('LIMIT_EXCEEDED', `${path}.words`);
  counter.words += words.length;
  if (counter.words > SUBMISSION_LIMITS.wordsTotal) return reject('LIMIT_EXCEEDED', 'pages');
  return {
    y,
    size,
    words: words.map((w, i) => validateWord(w, `${path}.words[${i}]`, page.width)),
  };
}

function validatePage(input: unknown, path: string, counter: { words: number }): SubmissionPage {
  const page = exactKeys(input, path, ['width', 'height', 'lines'], [], 'INVALID_LAYOUT');
  const width = finiteNumber(page['width'], `${path}.width`, 100, 2000, 'INVALID_LAYOUT');
  const height = finiteNumber(page['height'], `${path}.height`, 100, 2000, 'INVALID_LAYOUT');
  const lines = page['lines'];
  if (!Array.isArray(lines) || lines.length === 0) return reject('INVALID_LAYOUT', `${path}.lines`);
  if (lines.length > SUBMISSION_LIMITS.linesPerPage)
    return reject('LIMIT_EXCEEDED', `${path}.lines`);
  return {
    width,
    height,
    lines: lines.map((l, i) => validateLine(l, `${path}.lines[${i}]`, { width, height }, counter)),
  };
}

function validateRuleLine(
  input: unknown,
  path: string,
  pages: readonly SubmissionPage[],
): SubmittedRuleLine {
  const code = 'INVALID_RULE_DRAFT';
  const rule = exactKeys(
    input,
    path,
    ['page', 'line', 'figure', 'deduction'],
    ['column', 'format'],
    code,
  );
  const page = nonNegativeInteger(rule['page'], `${path}.page`, pages.length, code);
  const line = nonNegativeInteger(rule['line'], `${path}.line`, pages[page].lines.length, code);
  const figure = rule['figure'];
  if (!FIGURE_TYPES.some((f) => f === figure)) return reject(code, `${path}.figure`);
  if (typeof rule['deduction'] !== 'boolean') return reject(code, `${path}.deduction`);
  const result: SubmittedRuleLine = {
    page,
    line,
    figure: figure as SubmittedRuleLine['figure'],
    deduction: rule['deduction'],
  };
  if ('column' in rule) {
    result.column = validateColumn(rule['column'], `${path}.column`, pages[page].width);
  }
  if ('format' in rule) {
    if (!RULE_FORMATS.some((f) => f === rule['format'])) return reject(code, `${path}.format`);
    result.format = rule['format'] as SubmittedRuleLine['format'];
  }
  return result;
}

function validateColumn(
  input: unknown,
  path: string,
  pageWidth: number,
): { x0: number; x1: number } {
  const code = 'INVALID_RULE_DRAFT';
  const column = exactKeys(input, path, ['x0', 'x1'], [], code);
  const x0 = finiteNumber(column['x0'], `${path}.x0`, 0, pageWidth, code);
  const x1 = finiteNumber(column['x1'], `${path}.x1`, 0, pageWidth, code);
  if (x0 >= x1) return reject(code, path);
  return { x0, x1 };
}

function validateRuleDraft(input: unknown, pages: readonly SubmissionPage[]): SubmittedRuleDraft {
  const code = 'INVALID_RULE_DRAFT';
  const draft = exactKeys(input, 'ruleDraft', ['lines'], ['period'], code);
  const lines = draft['lines'];
  if (!Array.isArray(lines)) return reject(code, 'ruleDraft.lines');
  if (lines.length > SUBMISSION_LIMITS.ruleLines)
    return reject('LIMIT_EXCEEDED', 'ruleDraft.lines');
  const result: SubmittedRuleDraft = {
    lines: lines.map((l, i) => validateRuleLine(l, `ruleDraft.lines[${i}]`, pages)),
  };
  if ('period' in draft) {
    const path = 'ruleDraft.period';
    const period = exactKeys(draft['period'], path, ['page', 'line', 'x0', 'x1'], [], code);
    const page = nonNegativeInteger(period['page'], `${path}.page`, pages.length, code);
    const line = nonNegativeInteger(period['line'], `${path}.line`, pages[page].lines.length, code);
    const { x0, x1 } = validateColumn(
      { x0: period['x0'], x1: period['x1'] },
      path,
      pages[page].width,
    );
    result.period = { page, line, x0, x1 };
  }
  return result;
}

/**
 * Strict, hand-written validation of an untrusted submission: exact keys at every level, the
 * limits of {@link SUBMISSION_LIMITS}, finite numbers inside the page box, the character rule for
 * words, and a rule draft that references existing lines. The error carries a JSON path only —
 * never a value — so a rejection cannot echo submitted content.
 */
export function validateLayoutSubmission(input: unknown): ValidationResult {
  try {
    const root = exactKeys(input, '$', ['schemaVersion', 'pages'], ['ruleDraft'], 'INVALID_LAYOUT');
    if (root['schemaVersion'] !== 1) return reject('INVALID_LAYOUT', 'schemaVersion');
    const pages = root['pages'];
    if (!Array.isArray(pages) || pages.length === 0) return reject('INVALID_LAYOUT', 'pages');
    if (pages.length > SUBMISSION_LIMITS.pages) return reject('LIMIT_EXCEEDED', 'pages');
    const counter = { words: 0 };
    const value: LayoutSubmissionV1 = {
      schemaVersion: 1,
      pages: pages.map((p, i) => validatePage(p, `pages[${i}]`, counter)),
    };
    if ('ruleDraft' in root) value.ruleDraft = validateRuleDraft(root['ruleDraft'], value.pages);
    return { ok: true, value };
  } catch (error) {
    if (error instanceof Rejection) return { ok: false, code: error.code, path: error.path };
    throw error;
  }
}
