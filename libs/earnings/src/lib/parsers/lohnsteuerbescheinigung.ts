import { type CertificateAmounts, emptyCertificateAmounts, type ParseOutcome } from '../model';
import { allLines, employerFromLines, parseGermanAmount, type PdfDocumentText } from './pdf-text';
import type { EarningsParser } from './registry';

/**
 * Wage-tax certificate ("Lohnsteuerbescheinigung für <Jahr>") — port of earnings-evolution's
 * `annual.parse_lstb`. The official BMF form has the same numbered lines for every employer, so
 * the parser reads by line number and works for any employer (FR-006). A line without an amount
 * (or a line that is absent) is `"0.00"`. Identifiers on the form (eTIN, tax ID, name, address)
 * are never read (FR-009); the employer is the first line naming a legal entity after the
 * employer label.
 */

const LSTB = /Lohnsteuerbescheinigung für\s+(\d{4})/;
const EUR = /(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/;

/** Form line → amount key. Form up to 2024: "… Sachbezüge ohne 9. und 10.", from 2025 on one line. */
const LINES: [keyof CertificateAmounts, RegExp][] = [
  ['grossWage', /(?<!\d)3\.\s*Bruttoarbeitslohn einschl\.\s*Sachbezüge(?: ohne 9\. und 10\.)?/],
  ['wageTax', /(?<!\d)4\.\s*Einbehaltene Lohnsteuer von 3\./],
  ['soli', /(?<!\d)5\.\s*Einbehaltener Solidaritätszuschlag von 3\./],
  ['churchTax', /(?<!\d)6\.\s*Einbehaltene Kirchensteuer des\s+Arbeitnehmers von 3\./],
  // lines 10–13: pay for several years (e.g. multi-year stock plans), taxed at a reduced rate outside 3.–6.
  ['multiYearComp', /ermäßigt besteuerte Entschädigungen/],
  ['multiYearWageTax', /(?<!\d)11\.\s*Einbehaltene Lohnsteuer von 9\. und 10\./],
  ['multiYearSoli', /(?<!\d)12\.\s*Einbehaltener Solizuschlag von 9\. und 10\./],
  [
    'multiYearChurchTax',
    /(?<!\d)13\.\s*Einbehaltene Kirchensteuer des\s+Arbeitnehmers von 9\. und 10\./,
  ],
  ['pensionEmployer', /(?<!\d)22\.\s*Arbeitgeberan-\s*a\)\s*zur gesetzlichen RV/],
  ['pensionEmployee', /(?<!\d)23\.\s*Arbeitnehmer-\s*a\)\s*zur gesetzlichen RV/],
  ['employerSubsidyHealth', /(?<!\d)24\.\s*Steuerfreie\s*a\)\s*zur gesetzlichen KV/],
  ['employerSubsidyCare', /c\)\s*zur gesetzlichen PV/],
  ['health', /(?<!\d)25\.\s*Arbeitnehmerbeiträge zur gesetzlichen KV/],
  ['care', /(?<!\d)26\.\s*Arbeitnehmerbeiträge zur sozialen PV/],
  ['unemployment', /(?<!\d)27\.\s*Arbeitnehmerbeiträge zur AV/],
];

function parse(doc: PdfDocumentText): ParseOutcome {
  const lines = allLines(doc).map((l) => l.text);
  const text = lines.join('\n');
  const year = LSTB.exec(text);
  if (!year) return { ok: false, error: { code: 'MISSING_FIELD', params: { field: 'year' } } };

  const labelIdx = lines.findIndex((l) => /Arbeitgeber/.test(l) && /Anschrift|Name/.test(l));
  const employer =
    employerFromLines(labelIdx >= 0 ? lines.slice(labelIdx + 1) : lines) ??
    employerFromLines(lines);
  if (!employer)
    return { ok: false, error: { code: 'MISSING_FIELD', params: { field: 'employer' } } };

  const amounts = emptyCertificateAmounts();
  for (const [key, pattern] of LINES) {
    // the amount is the last number on the (possibly two-line) label; empty fields have none
    const m = new RegExp(pattern.source + '([^\\n]*)').exec(text);
    const value = m ? EUR.exec(m[m.length - 1].trim()) : null;
    if (value) amounts[key] = parseGermanAmount(value[1]) as string;
  }
  return {
    ok: true,
    employer,
    records: [],
    certificates: [{ employer, year: Number(year[1]), amounts }],
  };
}

export const lohnsteuerbescheinigungParser: EarningsParser = {
  id: 'lohnsteuerbescheinigung',
  version: '1.0.0',
  documentType: 'CERTIFICATE',
  detect: (doc) => allLines(doc).some((l) => LSTB.test(l.text)),
  parse,
};
