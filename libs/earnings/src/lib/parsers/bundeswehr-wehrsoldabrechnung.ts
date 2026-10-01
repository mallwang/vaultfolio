import {
  centsToMoney,
  emptyPayRecordAmounts,
  monthsBetween,
  type ParseError,
  type ParseOutcome,
  type PayRecordInput,
  toPeriod,
} from '../model';
import {
  allLines,
  amountsIn,
  type PdfDocumentText,
  type PdfPageText,
  type PdfWord,
} from './pdf-text';
import type { EarningsParser } from './registry';

/**
 * Bundeswehr "Wehrsoldabrechnungsbeleg" — TypeScript port of earnings-evolution's
 * `extractor/parsers/bundeswehr.py`. Military service pay is free of tax and social-security
 * contributions, so `gross = net` and every tax/social field stays 0.00.
 *
 * Every table line carries its own entitlement month (`Anspruchszeitraum`, `MM.YYYY`). Lines of the
 * statement's own month form the `REGULAR` record, lines of earlier months become `CORRECTION`
 * records of those months. A file may hold several statements (one per page, e.g. after a change of
 * unit); statements of one issue month are merged into one payslip, a statement whose lines are all
 * repeated in a later statement of the same month is superseded and ignored. Pages without the
 * statement header (e.g. an attached travel-expense certificate) are ignored.
 *
 * The printed `Auszahlungsbetrag` must equal the sum of the table lines (`CHECK_FAILED`, check
 * `PAYOUT`); if it is unreadable it is derived from the two printed sums.
 *
 * Only the header month, the issue date and the table lines are read; name, address, personnel
 * number and account of the letterhead are never read into the output (FR-009). The employer is
 * always "Bundeswehr". Unknown line types count as pay (as in the companion tool); a bonus-like
 * line (`Zuwendung`, `Entlassungsgeld`, `Prämie`) is also reported as one-off gross.
 */

const EMPLOYER = 'Bundeswehr';

const KEYWORD = /Wehrsoldabrechnungsbeleg/i;
const HEADER = /Wehrsoldabrechnungsbeleg\s+(\S+)\s+(\d{4})/i;
const DATE = /(\d{2})\.(\d{2})\.(\d{4})/;
/** `12.2010 Verpflegungsgeld 43,20 E 43,20`; tolerates OCR noise before and between period and label. */
const TABLE_LINE = /^\W{0,2}(\d{2})\.?(\d{4})\b/;
const TOTAL_PAY = /^\W*Summe\s+Bez/i;
const TOTAL_ADJUSTMENTS = /^\W*Summe\s+der\s+Ausgleich/i;
const PAYOUT = /Auszahlungsbetrag/i;
const ONE_OFF_LABEL = /zuwendung|entlassungsgeld|pr[aä]mie/i;

/** First three letters, umlaut-free — robust against OCR damage of `März`. */
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dez'];

class Failure {
  constructor(readonly error: ParseError) {}
}

function fail(field: string, period?: string): never {
  throw new Failure({ code: 'MISSING_FIELD', params: period ? { field, period } : { field } });
}

interface Line {
  period: string;
  label: string;
  cents: number;
}

interface Statement {
  /** `null` when the header month is unreadable — taken from a neighbouring statement of the file. */
  issued: string | null;
  /** `YYYY-MM-DD` of the letter date, `''` when unreadable. */
  date: string;
  lines: Line[];
  payout: number | null;
  /** `Summe Bezüge` (running month) and `Summe der Ausgleichsbeträge`. */
  sums: number[];
}

type IssuedStatement = Statement & { issued: string };

const toCents = (amount: string): number => Math.round(Number(amount) * 100);

function lineKey(l: Line): string {
  return `${l.period}|${l.label}|${l.cents}`;
}

function monthOf(name: string): number | null {
  const idx = MONTHS.indexOf(
    name
      .toLowerCase()
      .replaceAll('ä', 'a')
      .replace(/[^a-z]/g, '')
      .slice(0, 3),
  );
  return idx < 0 ? null : idx + 1;
}

/**
 * The scans' OCR text layer sets label, amounts and year of one printed row a few points apart, so
 * they land in separate lines. Rows are about 12 points apart, the skew of a scan stays below 5.5: adjacent lines within this distance are
 * one row.
 */
const ROW_TOLERANCE = 5.5;

/** Rows of a page top to bottom, words of a row left to right. */
function rowsOf(page: PdfPageText): string[] {
  const rows: { y: number; words: PdfWord[] }[] = [];
  for (const line of page.lines) {
    const row = rows.at(-1);
    if (row && Math.abs(row.y - line.y) <= ROW_TOLERANCE) row.words.push(...line.words);
    else rows.push({ y: line.y, words: [...line.words] });
  }
  return rows.map((r) =>
    [...r.words]
      .sort((a, b) => a.x - b.x)
      .map((w) => w.text)
      .join(' '),
  );
}

/** Removes `|` and whitespace from both ends of `text`. */
function trimNoise(text: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && /[\s|]/.test(text[start])) start++;
  while (end > start && /[\s|]/.test(text[end - 1])) end--;
  return text.slice(start, end);
}

/** `12.2010 Verpflegungsgeld 43,20 E 43,20` → period, label and the last amount (the Ausgleiche/Bezüge column). */
function tableLine(text: string, amounts: readonly string[]): Line | null {
  const m = TABLE_LINE.exec(text);
  if (!m || amounts.length === 0) return null;
  const month = Number(m[1]);
  if (month < 1 || month > 12) return null;
  const label = trimNoise(trimNoise(text.slice(m[0].length)).split(/\s-?\d/)[0]);
  return {
    period: toPeriod(Number(m[2]), month),
    label,
    cents: toCents(amounts.at(-1) ?? '0'),
  };
}

/** Letter date (`YYYY-MM-DD`) printed above the header, `''` when unreadable. */
function letterDate(lines: readonly string[]): string {
  const m = lines.map((l) => DATE.exec(l)).find(Boolean);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

/** `Summe Bezüge` (running month), `Summe der Ausgleichsbeträge` and the payout below the table. */
function readTotals(lines: readonly string[], st: Statement): void {
  for (const text of lines) {
    const amounts = amountsIn(text);
    if (amounts.length === 0) continue;
    const last = toCents(amounts.at(-1) ?? '0');
    if (TOTAL_PAY.test(text)) st.sums.push(toCents(amounts[0]));
    else if (TOTAL_ADJUSTMENTS.test(text)) st.sums.push(last);
    else if (PAYOUT.test(text)) st.payout = last;
  }
}

/** Table lines up to the first `Summe …` line, then the totals. */
function readBody(lines: readonly string[], st: Statement): void {
  const trimmed = lines.map((l) => l.trim());
  const totalsAt = trimmed.findIndex((l) => TOTAL_PAY.test(l) || TOTAL_ADJUSTMENTS.test(l));
  const table = totalsAt < 0 ? trimmed : trimmed.slice(0, totalsAt);
  for (const text of table) {
    const line = tableLine(text, amountsIn(text));
    if (line) st.lines.push(line);
  }
  if (totalsAt >= 0) readTotals(trimmed.slice(totalsAt), st);
}

function parsePage(lines: string[]): Statement | null {
  const headerIdx = lines.findIndex((l) => KEYWORD.test(l));
  if (headerIdx < 0) return null;
  const header = HEADER.exec(lines[headerIdx]);
  const month = header ? monthOf(header[1]) : null;

  const st: Statement = {
    issued: header && month !== null ? toPeriod(Number(header[2]), month) : null,
    date: letterDate(lines.slice(0, headerIdx + 1)),
    lines: [],
    payout: null,
    sums: [],
  };
  readBody(lines.slice(headerIdx + 1), st);
  return st;
}

/** Statements with an unreadable header month belong to the issue month of the file's other statements. */
function withIssued(parsed: readonly Statement[]): IssuedStatement[] {
  const known = parsed.find((st) => st.issued !== null)?.issued ?? fail('statementMonth');
  return parsed.map((st) => ({ ...st, issued: st.issued ?? known }));
}

/** Statements whose lines are all repeated in a later statement of the same issue month. */
function isSuperseded(a: IssuedStatement, all: readonly IssuedStatement[]): boolean {
  const keys = new Set(a.lines.map(lineKey));
  return all.some((b) => {
    if (b === a || b.issued !== a.issued || a.date >= b.date) return false;
    const other = new Set(b.lines.map(lineKey));
    return [...keys].every((k) => other.has(k));
  });
}

function payoutOf(st: IssuedStatement): number {
  if (st.payout !== null) return st.payout;
  // Auszahlungsbetrag unreadable: Summe Bezüge (lfd. Monat) + Summe der Ausgleichsbeträge
  if (st.sums.length === 2) return st.sums[0] + st.sums[1];
  return fail('payout', st.issued);
}

function recordKind(isMain: boolean, hasLines: boolean): PayRecordInput['kind'] {
  if (!isMain) return 'CORRECTION';
  return hasLines ? 'REGULAR' : 'PAYOUT_ONLY';
}

function recordsOf(issued: string, statements: readonly IssuedStatement[]): PayRecordInput[] {
  const payout = statements.reduce((acc, st) => acc + payoutOf(st), 0);
  const lines = statements.flatMap((st) => st.lines);
  const total = lines.reduce((acc, l) => acc + l.cents, 0);
  if (payout !== total) {
    throw new Failure({
      code: 'CHECK_FAILED',
      params: { check: 'PAYOUT', period: issued, difference: centsToMoney(payout - total) },
    });
  }

  const periods = new Map<string, Line[]>([[issued, []]]);
  for (const l of lines) periods.set(l.period, [...(periods.get(l.period) ?? []), l]);

  return [...periods].map(([period, own]) => {
    const net = own.reduce((acc, l) => acc + l.cents, 0);
    const oneOff = own.filter((l) => ONE_OFF_LABEL.test(l.label)).reduce((a, l) => a + l.cents, 0);
    const isMain = period === issued;
    const amounts = emptyPayRecordAmounts();
    amounts.gross = centsToMoney(net);
    amounts.net = centsToMoney(net);
    amounts.payout = isMain ? centsToMoney(payout) : null;
    amounts.other = centsToMoney((isMain ? payout : 0) - net);
    if (oneOff !== 0) amounts.oneOff = { gross: centsToMoney(oneOff) };
    return {
      employer: EMPLOYER,
      period,
      issued,
      kind: recordKind(isMain, own.length > 0),
      seq: isMain ? 1 : 1 + monthsBetween(period, issued),
      amounts,
    };
  });
}

function parsePages(pages: string[][]): ParseOutcome {
  const found = pages.map(parsePage).filter((st): st is Statement => st !== null);
  const parsed = withIssued(found);
  const statements = parsed.filter((st) => !isSuperseded(st, parsed));

  const byIssued = new Map<string, IssuedStatement[]>();
  for (const st of statements) byIssued.set(st.issued, [...(byIssued.get(st.issued) ?? []), st]);

  const records = [...byIssued].flatMap(([issued, group]) => recordsOf(issued, group));
  // a later period than the issue month cannot be a correction (negative seq) — reject instead of guessing
  const future = records.find((r) => r.seq < 1);
  if (future) fail('period', future.period);
  return { ok: true, employer: EMPLOYER, records, certificates: [] };
}

export const bundeswehrWehrsoldabrechnungParser: EarningsParser = {
  id: 'bundeswehr-wehrsoldabrechnung',
  version: '1.0.0',
  documentType: 'PAYSLIP',
  detect: (doc: PdfDocumentText) => allLines(doc).some((l) => KEYWORD.test(l.text)),
  parse: (doc: PdfDocumentText): ParseOutcome => {
    try {
      return parsePages(doc.pages.map(rowsOf));
    } catch (e) {
      if (e instanceof Failure) return { ok: false, error: e.error };
      throw e;
    }
  },
};
