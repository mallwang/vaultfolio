import {
  centsToMoney,
  emptyPayRecordAmounts,
  type OneOffKey,
  type ParseError,
  type ParseOutcome,
  type PayRecordInput,
  toPeriod,
  type YtdAmounts,
} from '../model';
import { allLines, type PdfDocumentText, type PdfLine } from './pdf-text';
import type { EarningsParser } from './registry';

/**
 * Deutsche Bundesbank "Verdienstabrechnung" — TypeScript port of earnings-evolution's
 * `extractor/parsers/bundesbank.py`. One statement per file (the companion tool already split the
 * scanned collection per month): `period` is the month of the header `MM.YY/N`, `issued` the month
 * a correction (`N` > 1) was calculated in, otherwise `period`.
 *
 * The text layer prints every character as its own run (`L o h n s t e u e r`), so words are
 * regrouped first. Each line is `<label> <Lohnart> [rate] [amount] [Arbg. <share>] [EBV/EBR amount]
 * [year-to-date]`; the meaning of a number depends on its column, so numbers are classified by
 * their right edge relative to the Lohnart column and the year-to-date column. Amounts in the
 * Betrag and year-to-date columns are cents without decimal separator (`1375-` = 13,75); the
 * EBV/EBR column and the SV-Brutto table are formatted.
 *
 * Only labelled figure lines are read; name, address, personnel number, tax ID, social-security
 * number and IBAN of the letterhead are never read into the output (FR-009). The employer is
 * always "Deutsche Bundesbank". Unknown Lohnarten are informational — the arithmetic checks (NET,
 * PAYOUT) reject a statement whose unknown line changes the figures.
 */

const EMPLOYER = 'Deutsche Bundesbank';

/** `09.11/1`, optionally followed by the calculation month of a correction (`10.11`); tolerates OCR slash variants. */
const HEADER = /(?<!\d)(\d{2})[.,](\d{2})\s?[/7lI|1]\s?(\d)(?:\s+(\d{2})[.,](\d{2}))?\s+\d{2},\d/;
const CODE_TOKEN = /^(.*?)[|[(]?(\d{3})$/;
const FORMATTED = /\d{1,3}(?:\.\d{3})*,\d{2}/g;

/** Characters of one word sit about one glyph apart, separate words at least three glyphs apart. */
const WORD_GAP_FACTOR = 1.8;
/** A Lohnart token's right edge may deviate this much (points) from the column's median. */
const CODE_TOLERANCE = 9;
/** Column borders as fraction of the way from the Lohnart column to the year-to-date column. */
const RATE_END = 0.4;
const AMOUNT_END = 0.68;
const EBR_END = 0.93;

type MoneyKey =
  | 'gross'
  | 'taxGross'
  | 'svGrossKv'
  | 'svGrossRv'
  | 'wageTax'
  | 'soli'
  | 'churchTax'
  | 'health'
  | 'care'
  | 'pension'
  | 'unemployment'
  | 'net';
type TaxKey = 'wageTax' | 'soli' | 'churchTax';

const SOCIAL: Record<string, 'care' | 'health' | 'pension' | 'unemployment'> = {
  '646': 'care',
  '660': 'health',
  '670': 'pension',
  '680': 'unemployment',
};
/** Withheld tax (Lohnart → key) and the employer's annual-adjustment refund of it. */
const TAX_WITHHELD: Record<string, TaxKey> = {
  '610': 'wageTax',
  '630': 'churchTax',
  '650': 'soli',
};
const TAX_REFUND: Record<string, TaxKey> = { '619': 'wageTax', '639': 'churchTax', '652': 'soli' };
/** Tax of one-off payments: reported as the one-off part only, the amount is part of the regular line. */
const TAX_ONE_OFF: Record<string, TaxKey> = { '643': 'wageTax', '644': 'churchTax', '651': 'soli' };
const TAX_BY_LABEL: [string, TaxKey][] = [
  ['solid', 'soli'],
  ['kirch', 'churchTax'],
  ['kist', 'churchTax'],
  ['lohnst', 'wageTax'],
  ['lst', 'wageTax'],
];
/** One-off pay (bonuses). */
const ONE_OFF_PAY = new Set(['441', '472']);
/** Deductions / payments between legal net and payout (VL, VBL, studies refund, …). */
const PAYOUT_ADJUSTMENT = new Set(['559', '723', '796', '818']);

interface Token {
  text: string;
  x0: number;
  x1: number;
}

interface CodedLine {
  code: string;
  label: string;
  amount?: number;
  ebr?: number;
  ytd?: number;
}

interface SvGrossRow {
  kv: number;
  rv: number;
  av: number;
  pv: number;
  st: number;
}

type TableRow = 'regular' | 'oneOff' | 'total' | 'ytd';
const TABLE_ROWS: [string, TableRow][] = [
  ['laufend', 'regular'],
  ['EGA', 'oneOff'],
  ['Abrech', 'total'],
  ['Jahressumme', 'ytd'],
];

class Failure {
  constructor(readonly error: ParseError) {}
}

function fail(field: string, period?: string): never {
  throw new Failure({ code: 'MISSING_FIELD', params: period ? { field, period } : { field } });
}

/**
 * Words of a line. A line printed one character per run (most words are a single character) is
 * regrouped into words by the gap between characters; any other line keeps its words.
 */
function tokens(line: PdfLine): Token[] {
  const words = line.words;
  const spaced = words.filter((w) => w.text.length === 1).length > 0.6 * words.length;
  const out: Token[] = [];
  let previousWidth = 0;
  for (const w of words) {
    const previous = out.at(-1);
    if (spaced && previous && w.x - previous.x1 <= WORD_GAP_FACTOR * previousWidth) {
      previous.text += w.text;
      previous.x1 = w.x + w.width;
    } else {
      out.push({ text: w.text, x0: w.x, x1: w.x + w.width });
    }
    previousWidth = w.width;
  }
  return out;
}

function textOf(row: Token[]): string {
  return row.map((t) => t.text).join(' ');
}

const OCR_NOISE = '*xX|[]“"\'';

/** Removes the given characters from both ends of `text`. */
function strip(text: string, chars: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && chars.includes(text[start])) start++;
  while (end > start && chars.includes(text[end - 1])) end--;
  return text.slice(start, end);
}

/** `'86048'` → 86048, `'3.11828'` → 311828, `'264,50'` → 26450, a trailing `-` negates. */
function cents(token: string): number | null {
  let t = strip(token, OCR_NOISE);
  const negative = t.endsWith('-');
  t = strip(strip(t, '-'), OCR_NOISE);
  if (t.includes(',')) {
    const m = /^(-?)(\d[\d.]*),(\d{2})$/.exec(t);
    if (!m) return null;
    const value = Number(m[2].replaceAll(/\./g, '')) * 100 + Number(m[3]);
    return negative || m[1] ? -value : value;
  }
  const digits = t.replaceAll(/\./g, '');
  if (!/^\d+$/.test(digits)) return null;
  return negative ? -Number(digits) : Number(digits);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** The Lohnart-coded lines of a page, columns resolved by position. */
function codedLines(rows: Token[][]): CodedLine[] {
  const edges = rows.flatMap((row) =>
    row.filter((t) => /^[|[]?1?\d{3}$/.test(t.text) && t.x0 > 150 && t.x0 < 200).map((t) => t.x1),
  );
  if (edges.length === 0) return [];
  const codeX1 = median(edges);

  const found: [Token[], number][] = [];
  for (const row of rows) {
    const idx = row.findIndex(
      (t) => Math.abs(t.x1 - codeX1) < CODE_TOLERANCE && CODE_TOKEN.test(t.text),
    );
    if (idx >= 0) found.push([row, idx]);
  }
  const rightEdges = found.flatMap(([row, idx]) =>
    row
      .slice(idx + 1)
      .filter((t) => /\d/.test(t.text))
      .map((t) => t.x1),
  );
  if (rightEdges.length === 0) return [];
  const span = Math.max(...rightEdges) - codeX1;

  return found.map(([row, idx]) => {
    const m = CODE_TOKEN.exec(row[idx].text) as RegExpExecArray;
    const label = strip([...row.slice(0, idx).map((t) => t.text), m[1]].join(' '), ' |[“"\'');
    const line: CodedLine = { code: m[2], label };
    const rest = row.slice(idx + 1);
    for (let i = 0; i < rest.length;) {
      const w = rest[i++];
      let text = w.text;
      // a detached minus sign belongs to the preceding number
      if (i < rest.length && /^-[*x%]*$/.test(rest[i].text) && !text.endsWith('-')) {
        text += '-';
        i++;
      }
      if (text.startsWith('Arbg')) {
        i++; // the employer's share is not part of the model
        continue;
      }
      const value = cents(text);
      if (value === null) continue;
      const rel = (w.x1 - codeX1) / span;
      if (rel < RATE_END && ['592', '646', '660', '670', '680', '818'].includes(line.code))
        continue;
      if (rel < AMOUNT_END) line.amount = value;
      else if (rel < EBR_END) line.ebr = value;
      else line.ytd = value;
    }
    return line;
  });
}

/** OCR variants of the decimal comma in the formatted table: `60 ‚00`, `0;00`, `1.019,/76`. */
function repairOcrAmounts(text: string): string {
  return text.replaceAll(/,\//g, ',').replaceAll(/(\d) ?[‚;] ?(\d{2})(?!\d)/g, '$1,$2');
}

/** The KV/RV/AV/PV/ST-Brutto table at the bottom of the statement. */
function svGrossTable(rows: Token[][]): Partial<Record<TableRow, SvGrossRow>> {
  const table: Partial<Record<TableRow, SvGrossRow>> = {};
  for (const row of rows) {
    const text = repairOcrAmounts(textOf(row));
    for (const [prefix, key] of TABLE_ROWS) {
      if (!new RegExp(`^\\W{0,2}${prefix}`).test(text)) continue;
      const values = (text.match(FORMATTED) ?? []).map((v) => cents(v) as number);
      if (values.length === 5 && !table[key]) {
        table[key] = { kv: values[0], rv: values[1], av: values[2], pv: values[3], st: values[4] };
      }
    }
  }
  return table;
}

/** (kv, rv, st). OCR may drop a digit in one column: a column differing from all others is replaced by the majority. */
function svGross(row: SvGrossRow): { kv: number; rv: number; st: number } {
  const sv = [row.kv, row.rv, row.av, row.pv];
  const count = (v: number) => sv.filter((x) => x === v).length;
  const majority = sv.reduce((best, v) => (count(v) > count(best) ? v : best), sv[0]);
  return {
    kv: count(row.kv) > 1 ? row.kv : majority,
    rv: count(row.rv) > 1 ? row.rv : majority,
    st: row.st,
  };
}

interface Header {
  period: string;
  issued: string;
  seq: number;
}

function header(first: Token[][]): Header {
  for (const row of first.slice(0, 15)) {
    const text = textOf(row);
    if (!/zentrale/i.test(text)) continue;
    const m = HEADER.exec(text);
    if (!m) continue;
    const month = Number(m[1]);
    if (month < 1 || month > 12) continue;
    const period = toPeriod(2000 + Number(m[2]), month);
    const issued = m[4] ? toPeriod(2000 + Number(m[5]), Number(m[4])) : period;
    return { period, issued, seq: Number(m[3]) };
  }
  return fail('statementMonth');
}

function add<K>(map: Map<K, number>, key: K, value: number): void {
  map.set(key, (map.get(key) ?? 0) + value);
}

/** Figures collected from the coded lines of all pages. */
interface Totals {
  amounts: Map<MoneyKey, number>;
  oneOff: Map<OneOffKey, number>;
  ytd: Map<OneOffKey, number>;
  seen: Set<string>;
  cashNet: number;
  payout: number;
  transfers: number;
  /** Deductions between net and payout (positive = reduces the payout). */
  adjustments: number;
}

function taxLine(line: CodedLine, t: Totals): void {
  const refund = line.code in TAX_REFUND;
  const byLabel = TAX_BY_LABEL.find(([part]) => line.label.toLowerCase().includes(part));
  const key = byLabel?.[1] ?? (refund ? TAX_REFUND[line.code] : TAX_WITHHELD[line.code]);
  add(t.amounts, key, -(line.amount ?? 0));
  // year-to-date = withheld − refunded (the refund is printed negative)
  if (line.ytd !== undefined) add(t.ytd, key, refund ? -Math.abs(line.ytd) : Math.abs(line.ytd));
}

function applyLine(line: CodedLine, t: Totals): void {
  const { code } = line;
  const current = line.amount ?? line.ebr ?? 0;
  t.seen.add(code);
  if (code === '700') add(t.amounts, 'gross', line.ebr ?? current);
  else if (code === '800') add(t.amounts, 'net', line.ebr ?? current);
  else if (code === '799') t.cashNet += current;
  else if (code === '895') t.payout += current;
  else if (code === '891') t.transfers += current;
  else if (code in SOCIAL) {
    add(t.amounts, SOCIAL[code], -(line.amount ?? 0));
    if (line.ytd !== undefined) add(t.ytd, SOCIAL[code], Math.abs(line.ytd));
  } else if (code in TAX_ONE_OFF) add(t.oneOff, TAX_ONE_OFF[code], -current);
  else if (code in TAX_WITHHELD || code in TAX_REFUND) taxLine(line, t);
  else if (PAYOUT_ADJUSTMENT.has(code)) t.adjustments += -current;
  else if (ONE_OFF_PAY.has(code)) add(t.oneOff, 'gross', current);
}

/** SV-Brutto table: Steuer-Brutto, SV-Brutto (KV/RV), the one-off part and the year-to-date Steuer-Brutto. */
function applyTable(pages: Token[][][], t: Totals): void {
  const tables = pages.map(svGrossTable);
  const row = (key: TableRow) => tables.map((tab) => tab[key]).find((r) => r);
  const total = row('total');
  if (total) {
    const { kv, rv, st } = svGross(total);
    t.amounts.set('svGrossKv', kv);
    t.amounts.set('svGrossRv', rv);
    t.amounts.set('taxGross', st);
  }
  const oneOffRow = row('oneOff');
  if (oneOffRow && Object.values(oneOffRow).some((v) => v !== 0)) {
    t.oneOff.set('taxGross', svGross(oneOffRow).st);
  }
  const ytdRow = row('ytd');
  if (ytdRow) t.ytd.set('taxGross', svGross(ytdRow).st);
}

/** A regular statement must print gross, net, Zahlnetto and the payout. */
function requireRegularLines(seen: Set<string>, period: string): void {
  for (const [code, field] of [
    ['700', 'gross'],
    ['800', 'net'],
    ['799', 'cashNet'],
    ['895', 'payout'],
  ] as const) {
    if (!seen.has(code)) fail(field, period);
  }
}

const MONEY_KEYS: readonly MoneyKey[] = [
  'gross',
  'taxGross',
  'svGrossKv',
  'svGrossRv',
  'wageTax',
  'soli',
  'churchTax',
  'health',
  'care',
  'pension',
  'unemployment',
  'net',
];

function parsePages(pages: Token[][][]): ParseOutcome {
  const { period, issued, seq } = header(pages[0] ?? []);
  const regular = seq === 1;

  const t: Totals = {
    amounts: new Map(),
    oneOff: new Map(),
    ytd: new Map(),
    seen: new Set(),
    cashNet: 0,
    payout: 0,
    transfers: 0,
    adjustments: 0,
  };
  for (const page of pages) for (const line of codedLines(page)) applyLine(line, t);
  applyTable(pages, t);
  if (regular) requireRegularLines(t.seen, period);

  const get = (key: MoneyKey) => t.amounts.get(key) ?? 0;
  const amounts = emptyPayRecordAmounts();
  for (const key of MONEY_KEYS) amounts[key] = centsToMoney(get(key));
  // Everything between legal net and the money paid out (VBL, VL, carry-over). For a regular
  // statement it is derived from the lines (not from the payout) so the PAYOUT check is meaningful;
  // a correction's net is paid with the statement of its calculation month.
  amounts.other = centsToMoney(
    regular ? t.cashNet - get('net') + t.transfers - t.adjustments : -get('net'),
  );
  amounts.payout = regular ? centsToMoney(t.payout) : null;
  amounts.oneOff = Object.fromEntries(
    [...t.oneOff].filter(([, v]) => v !== 0).map(([k, v]) => [k, centsToMoney(v)]),
  );
  amounts.ytd = regular && t.ytd.size > 0 ? ytdAmounts(t.ytd) : null;

  const record: PayRecordInput = {
    employer: EMPLOYER,
    period,
    issued,
    kind: regular ? 'REGULAR' : 'CORRECTION',
    seq,
    amounts,
  };
  return { ok: true, employer: EMPLOYER, records: [record], certificates: [] };
}

function ytdAmounts(ytd: Map<OneOffKey, number>): YtdAmounts {
  return Object.fromEntries([...ytd].map(([k, v]) => [k, centsToMoney(v)]));
}

const squeeze = (text: string) => text.replace(/[^\p{L}\p{N}_]/gu, '').toLowerCase();

export const bundesbankVerdienstabrechnungParser: EarningsParser = {
  id: 'bundesbank-verdienstabrechnung',
  version: '1.0.0',
  documentType: 'PAYSLIP',
  // the letterhead is character-spaced and OCR may drop the Z of "Zahlbrutto": compare without separators
  detect: (doc: PdfDocumentText) => {
    const text = squeeze(
      allLines(doc)
        .map((l) => l.text)
        .join(' '),
    );
    return text.includes('bundesbank') && text.includes('ahlbrutto');
  },
  parse: (doc: PdfDocumentText): ParseOutcome => {
    try {
      return parsePages(doc.pages.map((p) => p.lines.map(tokens)));
    } catch (e) {
      if (e instanceof Failure) return { ok: false, error: e.error };
      throw e;
    }
  },
};
