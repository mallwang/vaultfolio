import {
  centsToMoney,
  emptyPayRecordAmounts,
  monthsBetween,
  type OneOffKey,
  type ParseError,
  type ParseOutcome,
  type PayRecordInput,
  toPeriod,
  type YtdAmounts,
} from '../model';
import { allLines, employerFromLines, type PdfDocumentText } from './pdf-text';
import type { EarningsParser } from './registry';

/**
 * SAP HR payslip "Entgeltnachweis für <Monat> <Jahr>" — TypeScript port of earnings-evolution's
 * `extractor/parsers/evosoft.py`. A statement holds one or more sections "Abrechnungsdaten für
 * <Monat> <Jahr>": the statement's own month plus corrections of earlier months. Each section
 * becomes its own record (`period` = section month, `issued` = statement month; FR-018).
 *
 * Only the labelled figure lines are read; personal identifiers printed on the payslip (name,
 * address, personnel number, tax ID, social-security number, IBAN) are never read into the output
 * (FR-009). Money is handled as integer cents internally and emitted as canonical decimals.
 *
 * Differences to the Python original: the employer is read from the document header (first line
 * with a legal-form suffix) instead of a folder name; a correction's `seq` is `1 + months between
 * period and issued` (unique per issuing payslip, so two corrections of one month from different
 * payslips never share an identity — FR-016); an unknown coded line under GESETZLICHE ABZÜGE
 * rejects the file (`UNKNOWN_LINE`) instead of adding a note; a statement without a section of its
 * own month gets a `PAYOUT_ONLY` record carrying the payout.
 */

const MONTHS_DE: Record<string, number> = {
  januar: 1,
  februar: 2,
  märz: 3,
  maerz: 3,
  april: 4,
  mai: 5,
  juni: 6,
  juli: 7,
  august: 8,
  september: 9,
  oktober: 10,
  november: 11,
  dezember: 12,
};

const STATEMENT = /Entgeltnachweis für\s+(\p{L}+)\s+(\d{4})/u;
const SECTION = /Abrechnungsdaten für\s+(\p{L}+)\s+(\d{4})/u;
const CODED = /^([0-9A-Z/$#]{4})\s+(\S.*)$/;
const AMOUNT = /(?<![\d,])\d{1,3}(?:\.\d{3})*,\d{2}(?:-(?![A-Z]))?/g;
const QUANTITY = /(?<!\d)\d+,\d{2}(?: ?-)? ?[STH]\b/g;
const KENNZ = /\s([ELSG]{1,4})(?=\s|$)/;

type AmountKey =
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
  | 'net'
  | 'other';

/** Statutory line labels (`Y$..` regular, `Y#..` / ", EZ" one-off); `null` = recognized, not stored. */
const STATUTORY: [RegExp, AmountKey | null][] = [
  [/Steuer-Brutto/, 'taxGross'],
  [/SV-Brutto KV/, 'svGrossKv'],
  [/SV-Brutto RV/, 'svGrossRv'],
  [/SV-Brutto AV/, null],
  [/SV-Brutto PV/, null],
  [/Pausch\.StB/, null],
  [/Lohnsteuer/, 'wageTax'],
  [/Solidarit/, 'soli'],
  [/Kirchensteuer/, 'churchTax'],
  [/Krankenvers/, 'health'],
  [/Pflegevers/, 'care'],
  [/Rentenvers/, 'pension'],
  [/Arbeitslosenvers/, 'unemployment'],
];

/** Voluntary KV/PV lines under SONSTIGE BE-/ABZÜGE: +1 = contribution (printed as a deduction), −1 = employer subsidy. */
const VOLUNTARY: Record<string, ['health' | 'care', 1 | -1]> = {
  '/381': ['health', 1],
  '/3MI': ['health', 1],
  '/358': ['health', -1],
  '/3MS': ['health', -1],
  '/3QR': ['care', 1],
  '/3QW': ['care', 1],
  '/3Q8': ['care', -1],
};

/** Printed year-to-date labels → key; `_regular`/`_one_off` parts are added up. */
const YTD_KEYS: [string, OneOffKey][] = [
  ['Gesamt-Brut', 'gross'],
  ['St-Br-lfd', 'taxGross'],
  ['St-Br-EZ', 'taxGross'],
  ['Lohnst.lfd', 'wageTax'],
  ['Lohnst. EZ', 'wageTax'],
  ['KiSt. lfd.', 'churchTax'],
  ['KiSt. EZ', 'churchTax'],
  ['SolZ. lfd.', 'soli'],
  ['SolZ. EZ', 'soli'],
  ['KV-Beitrag', 'health'],
  ['PV-Beitrag', 'care'],
  ['RV-Beitrag', 'pension'],
  ['AV-Beitrag', 'unemployment'],
];

/** `'3.750,00'` → 375000, `'591,70-'` → −59170. */
function cents(text: string): number {
  const negative = text.endsWith('-');
  const [euros, fraction] = text.replace(/-$/, '').split(',');
  const value = Number(euros.replaceAll('.', '')) * 100 + Number(fraction);
  return negative ? -value : value;
}

function money(text: string): number[] {
  return [...text.replace(QUANTITY, ' ').matchAll(AMOUNT)].map((m) => cents(m[0]));
}

function month(name: string, year: string): string | null {
  const m = MONTHS_DE[name.toLowerCase()];
  return m ? toPeriod(Number(year), m) : null;
}

class Section {
  readonly amounts = new Map<AmountKey, number>();
  readonly oneOff = new Map<OneOffKey, number>();
  subsidy: Partial<Record<'health' | 'care', number>> = {};
  contribution: Partial<Record<'health' | 'care', number>> = {};
  oneOffGross = 0;
  hasGross = false;
  hasNet = false;

  constructor(
    readonly period: string,
    readonly regular: boolean,
  ) {}

  add(key: AmountKey, value: number, oneOff = false): void {
    this.amounts.set(key, (this.amounts.get(key) ?? 0) + value);
    if (oneOff) {
      const k = key as OneOffKey;
      this.oneOff.set(k, (this.oneOff.get(k) ?? 0) + value);
    }
  }

  get(key: AmountKey): number {
    return this.amounts.get(key) ?? 0;
  }

  /** Only amount-less lines (e.g. vacation days of an earlier month booked late) — no pay record. */
  get informational(): boolean {
    return (
      !this.regular &&
      !this.hasGross &&
      !this.hasNet &&
      this.amounts.size === 0 &&
      this.oneOffGross === 0 &&
      Object.keys(this.subsidy).length === 0 &&
      Object.keys(this.contribution).length === 0
    );
  }
}

class Failure {
  constructor(readonly error: ParseError) {}
}

/**
 * Employer from the header of the first statement page (up to its first section): the first line
 * naming a legal entity. Earlier pages are skipped — a cover letter there names the payroll
 * provider (e.g. the parent company's HR service), not the employer printed on the statement.
 */
function detectEmployer(pages: string[][]): string | null {
  const page = pages.find((lines) => lines.some((l) => STATEMENT.test(l))) ?? [];
  const end = page.findIndex((l) => SECTION.test(l));
  return employerFromLines(end < 0 ? page : page.slice(0, end));
}

function ytdOf(lines: string[]): YtdAmounts | null {
  const idx = lines.map((l) => l.startsWith('JAHRESSUMMEN')).lastIndexOf(true);
  if (idx < 0) return null;
  const end = lines.findIndex((l, i) => i > idx && l.startsWith('GRUNDDATEN'));
  const block = lines.slice(idx, end < 0 ? undefined : end).join('\n');
  const out = new Map<OneOffKey, number>();
  for (const [label, key] of YTD_KEYS) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
    const m = new RegExp(String.raw`${escaped}\s*:?\s*(\d{1,3}(?:\.\d{3})*,\d{2})`).exec(block);
    if (m) out.set(key, (out.get(key) ?? 0) + cents(m[1]));
  }
  if (out.size === 0) return null;
  return Object.fromEntries([...out].map(([k, v]) => [k, centsToMoney(v)]));
}

type Block = 'earnings' | 'bases' | 'deductions' | 'other';

function fail(field: string, period?: string): never {
  throw new Failure({ code: 'MISSING_FIELD', params: period ? { field, period } : { field } });
}

function last(values: number[]): number | undefined {
  return values.at(-1);
}

/**
 * Reads a statement line by line: page and section structure, block headings, totals and coded
 * wage-type lines of the current section.
 */
class StatementReader {
  readonly sections: Section[] = [];
  payout = 0;
  private rec: Section | null = null;
  private block: Block | null = null;
  private resume: Block | null = null;

  constructor(private readonly issued: string) {}

  read(raw: string): void {
    const line = raw.trim();
    if (!line || this.structure(line)) return;
    if (!this.rec || !this.block) return;
    if (this.heading(line) || this.totals(line, this.rec)) return;
    const cm = CODED.exec(line);
    if (cm && cm[1] !== 'LArt') this.coded(cm[1], cm[2], this.rec, this.block);
  }

  /** Page headers/footers, section starts, payout line and end markers. */
  private structure(line: string): boolean {
    if (STATEMENT.test(line)) {
      // page header: continue the block interrupted by the previous page's GRUNDDATEN footer
      this.block = this.resume;
      this.resume = null;
      return true;
    }
    const sm = SECTION.exec(line);
    if (sm) {
      const period = month(sm[1], sm[2]) ?? fail('sectionMonth');
      this.rec = new Section(period, period === this.issued);
      this.sections.push(this.rec);
      this.block = 'earnings';
      return true;
    }
    if (line.startsWith('Überweisung an')) {
      this.payout += last(money(line)) ?? 0;
      return true;
    }
    if (line.startsWith('GRUNDDATEN')) {
      this.resume = this.block;
      this.block = null;
      return true;
    }
    if (line.startsWith('JAHRESSUMMEN') || line.startsWith('Kennz.:')) {
      this.block = this.resume = null;
      return true;
    }
    return false;
  }

  private heading(line: string): boolean {
    const upper = line.toUpperCase();
    if (upper.includes('GESETZLICHE ABZÜGE')) this.block = 'deductions';
    else if (upper.includes('BRUTTOENTGELTE')) this.block = 'bases';
    else if (upper.includes('SONSTIGE BE-/ABZÜGE') && !line.startsWith('Summe'))
      this.block = 'other';
    else return false;
    return true;
  }

  private totals(line: string, rec: Section): boolean {
    if (line.startsWith('Gesamtbrutto')) {
      rec.add('gross', last(money(line)) ?? fail('gross', rec.period));
      rec.hasGross = true;
      return true;
    }
    if (line.startsWith('Summe Sonstige')) {
      const value = last(money(line));
      if (value !== undefined) rec.add('other', value); // empty when the items cancel out
      return true;
    }
    return line.startsWith('Summe ');
  }

  private coded(code: string, rest: string, rec: Section, block: Block): void {
    const amount = last(money(rest));
    if (code === '/55E') {
      rec.add('net', amount ?? fail('net', rec.period));
      rec.hasNet = true;
      return;
    }
    const voluntary = VOLUNTARY[code];
    if (voluntary && block === 'other' && amount !== undefined) {
      const [key, sign] = voluntary;
      if (sign > 0) rec.contribution[key] = (rec.contribution[key] ?? 0) - amount;
      else rec.subsidy[key] = (rec.subsidy[key] ?? 0) + amount;
      return;
    }
    // other technical wage types (/xxx) are informational
    if (code.startsWith('/') || amount === undefined) return;

    if (block === 'earnings') {
      const kennz = KENNZ.exec(' ' + rest)?.[1] ?? '';
      if (kennz.includes('E') && kennz.includes('G')) rec.oneOffGross += amount;
    } else if (block === 'bases' || block === 'deductions') {
      this.statutory(code, rest, amount, rec, block);
    } else if (code === 'Y551' && !rec.regular) {
      // the correction's net is moved to the current month (/552 there), not paid in this section
      rec.add('other', -amount);
    }
  }

  private statutory(code: string, rest: string, amount: number, rec: Section, block: Block): void {
    const match = STATUTORY.find(([pattern]) => pattern.test(rest));
    if (match) {
      if (match[1]) rec.add(match[1], amount, code.includes('#') || rest.includes(', EZ'));
    } else if (block === 'deductions') {
      const label = rest.replace(QUANTITY, ' ').replace(AMOUNT, ' ').trim();
      throw new Failure({
        code: 'UNKNOWN_LINE',
        params: { label: `${code} ${label}`.trim(), period: rec.period },
      });
    }
  }
}

/** Voluntary KV/PV: the own share (contribution − subsidy) counts like a statutory deduction (FR-019). */
function applyVoluntaryShare(s: Section): void {
  for (const key of ['health', 'care'] as const) {
    const contribution = s.contribution[key];
    if (contribution === undefined) continue;
    const own = contribution - (s.subsidy[key] ?? 0);
    s.add(key, own);
    s.add('net', -own);
    s.add('other', own);
  }
}

function recordKind(s: Section, main: Section): PayRecordInput['kind'] {
  if (s.regular) return 'REGULAR';
  return s === main ? 'PAYOUT_ONLY' : 'CORRECTION';
}

function toRecord(
  s: Section,
  main: Section,
  ctx: { employer: string; issued: string; payout: number; ytd: YtdAmounts | null },
): PayRecordInput {
  applyVoluntaryShare(s);
  if (s.oneOffGross) s.oneOff.set('gross', s.oneOffGross);
  const hasSubsidy = s.subsidy.health !== undefined || s.subsidy.care !== undefined;
  const amounts = emptyPayRecordAmounts();
  for (const key of Object.keys(amounts) as (keyof typeof amounts)[]) {
    if (key === 'payout' || key === 'oneOff' || key === 'employerSubsidy' || key === 'ytd')
      continue;
    amounts[key] = centsToMoney(s.get(key));
  }
  const isMain = s === main;
  amounts.payout = isMain ? centsToMoney(ctx.payout) : null;
  amounts.oneOff = Object.fromEntries(
    [...s.oneOff].filter(([, v]) => v !== 0).map(([k, v]) => [k, centsToMoney(v)]),
  );
  amounts.employerSubsidy = hasSubsidy
    ? { health: centsToMoney(s.subsidy.health ?? 0), care: centsToMoney(s.subsidy.care ?? 0) }
    : null;
  amounts.ytd = isMain ? ctx.ytd : null;
  return {
    employer: ctx.employer,
    period: s.period,
    issued: ctx.issued,
    kind: recordKind(s, main),
    seq: s.regular || isMain ? 1 : 1 + monthsBetween(s.period, ctx.issued),
    amounts,
  };
}

function parsePages(pages: string[][]): ParseOutcome {
  const lines = pages.flat();
  const statement = lines.map((l) => STATEMENT.exec(l)).find(Boolean);
  const issued = (statement ? month(statement[1], statement[2]) : null) ?? fail('statementMonth');
  const employer = detectEmployer(pages) ?? fail('employer');

  const reader = new StatementReader(issued);
  for (const line of lines) reader.read(line);
  if (reader.sections.length === 0) fail('section');
  const sections = reader.sections.filter((s) => !s.informational);
  const { payout } = reader;

  for (const s of sections) {
    // a correction that only recalculates taxes/contributions prints no Gesamtbrutto: gross stays 0;
    // one that only reclassifies pay (e.g. taxable → tax-free) prints no Gesetzl. Netto: net stays 0
    if (!s.hasGross && s.regular) fail('gross', s.period);
    if (!s.hasNet && s.regular) fail('net', s.period);
  }

  // A statement with only back-payments has no section of its own month: a PAYOUT_ONLY record for
  // the statement month carries the payout, so the month is not counted as employed (spec Edge Cases).
  let main = sections.find((s) => s.regular);
  const payoutOnly = !main;
  if (!main) {
    main = new Section(issued, false);
    main.add('other', payout);
    sections.push(main);
  }
  const ctx = { employer, issued, payout, ytd: payoutOnly ? null : ytdOf(lines) };
  const records = sections.map((s) => toRecord(s, main, ctx));
  return { ok: true, employer, records, certificates: [] };
}

export const sapEntgeltnachweisParser: EarningsParser = {
  id: 'sap-entgeltnachweis',
  version: '1.0.0',
  documentType: 'PAYSLIP',
  detect: (doc: PdfDocumentText) => allLines(doc).some((l) => STATEMENT.test(l.text)),
  parse: (doc: PdfDocumentText): ParseOutcome => {
    try {
      return parsePages(doc.pages.map((p) => p.lines.map((l) => l.text)));
    } catch (e) {
      if (e instanceof Failure) return { ok: false, error: e.error };
      throw e;
    }
  },
};
