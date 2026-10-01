import type { PayRecordInput } from '../model';
import type { PdfDocumentText, PdfLine, PdfWord } from '../parsers/pdf-text';

/**
 * Synthetic Deutsche Bundesbank "Verdienstabrechnung" statements. **Every name, address,
 * identifier and amount is invented.**
 *
 * The real text layer prints every character as its own run, the Betrag/year-to-date columns as
 * cents without decimal separator (`1375-` = 13,75) and the EBV column and SV-Brutto table formatted.
 * `row()` reproduces that: one single-character word per glyph at a fixed pitch, text right-aligned
 * to the column edges measured on the real form (points).
 */

const PITCH = 6.8;
const GLYPH = 3.4;
const X_LABEL = 46;
const X_CODE = 196;
const X_RATE = 295;
const X_AMOUNT = 387;
const X_EBR = 486;
const X_YTD = 546;
/** The table at the bottom: left edge of the label and right edges of the five value columns. */
const TABLE_RIGHT = [209, 288, 367, 446, 546];

function glyphs(text: string, x0: number): PdfWord[] {
  const words: PdfWord[] = [];
  [...text].forEach((c, i) => {
    if (c !== ' ') words.push({ text: c, x: x0 + i * PITCH, width: GLYPH });
  });
  return words;
}

function right(text: string, x1: number): PdfWord[] {
  return glyphs(text, x1 - GLYPH - (text.length - 1) * PITCH);
}

function line(words: PdfWord[], y: number): PdfLine {
  const text = words.map((w) => w.text).join(' ');
  return { text, words, y };
}

interface Cells {
  label?: string;
  code?: string;
  rate?: string;
  amount?: string;
  /** Printed after an `Arbg.` marker (employer share, formatted). */
  arbg?: string;
  ebr?: string;
  ytd?: string;
}

function row(y: number, c: Cells): PdfLine {
  const words = [
    ...(c.label ? glyphs(c.label, X_LABEL) : []),
    ...(c.code ? right(c.code, X_CODE) : []),
    ...(c.rate ? right(c.rate, X_RATE) : []),
    ...(c.amount ? right(c.amount, X_AMOUNT) : []),
    ...(c.arbg ? [...glyphs('Arbg.', 402), ...right(c.arbg, X_EBR)] : []),
    ...(c.ebr ? right(c.ebr, X_EBR) : []),
    ...(c.ytd ? right(c.ytd, X_YTD) : []),
  ];
  return line(words, y);
}

function table(y: number, label: string, values: string[]): PdfLine {
  return line(
    [...glyphs(label, X_LABEL), ...values.flatMap((v, i) => right(v, TABLE_RIGHT[i]))],
    y,
  );
}

function free(y: number, x: number, text: string): PdfLine {
  return line(glyphs(text, x), y);
}

type Entry = Cells | 'rule';

/** Statement page with the letterhead (invented personal data) and the figure rows. */
function page1(headerLine: string, entries: Entry[], tableRows: [string, string[]][]): PdfLine[] {
  const lines: PdfLine[] = [
    free(779, 79, 'DEUTSCHE BUNDESBANK'),
    line([...glyphs('ZENTRALE', 79), ...glyphs(headerLine, 297)], 767),
    free(742, 79, 'FRANKFURT'),
    free(706, 79, 'Erika Musterfrau'),
    free(694, 79, 'Musterweg 1'),
    free(681, 79, '12345 Musterstadt'),
    free(669, 376, 'DE00123456780000000000'),
    free(572, 46, 'wö. Arb.Zeit'),
  ];
  let y = 547;
  for (const entry of entries) {
    lines.push(entry === 'rule' ? free(y, 46, '-'.repeat(60)) : row(y, entry));
    y -= 12;
  }
  y -= 24;
  lines.push(line([...glyphs('KV-Brutto', 152), ...glyphs('RV-Brutto', 231)], y));
  for (const [label, values] of tableRows) {
    y -= 12;
    lines.push(table(y, label, values));
  }
  lines.push(free(y - 12, 46, 'Einzugsstelle 000 MUSTERKASSE'));
  lines.push(free(y - 24, 46, 'Steueridentifikationsnummer: 00000000000'));
  return lines;
}

const PAGE2: PdfLine[] = [
  free(767, 79, 'Seite 2'),
  free(559, 46, 'Überwiesene Beträge :'),
  free(535, 46, 'EUR 40,00 IBAN: DE00000000000000000000'),
  free(523, 46, 'Entgeltbescheinigung nach Para.108 Absatz 3 Satz 1 der Gewerbeordnung'),
];

function document(first: PdfLine[]): PdfDocumentText {
  return { pages: [{ lines: first }, { lines: PAGE2 }] };
}

export interface BundesbankFixture {
  fileName: string;
  document: PdfDocumentText;
  expected:
    { records: PayRecordInput[] } | { error: { code: string; params: Record<string, string> } };
}

const NO_ONE_OFF = {};

/**
 * Regular month 2025-03. Gross components 3000.00 + 150.00 = Zahlbrutto 3150.00; Gesamtbrutto EBV
 * 3150.00 + 20.00 (SV-pfl. VBL-Umlage) = 3170.00.
 *
 * - taxes: 300.00 + 27.00 = 327.00; social: 290.00 + 56.00 + 295.00 + 47.00 = 688.00
 * - Netto EBV (net): 3170.00 − 327.00 − 688.00 = 2155.00
 * - Netto (Zahlnetto): 2155.00 − 20.00 = 2135.00
 * - payout: 2135.00 − 40.00 (VL) − 30.00 (VBL-AN-Umlage) − 100.00 (Übertrag) = 1965.00
 * - other: 1965.00 − 2155.00 = −190.00
 * - year-to-date (three months): taxes 900.00 / 81.00, health 870.00, care 168.00, pension 885.00,
 *   unemployment 141.00, Steuer-Brutto 9450.00
 */
function regularRows(netEbv = '2155,00'): Entry[] {
  return [
    'rule',
    { label: 'Grundbetrag', code: '122', amount: '3.00000' },
    { label: 'Zulage', code: '132', amount: '15000' },
    { label: 'Zwisch-Summe Brutto', code: '258', amount: '3.15000' },
    { label: 'VBL-Brutto', code: '591', ebr: '3150,00', ytd: '945000' },
    { label: 'VBL-AG-UMLAGE', code: '592', rate: '645', ebr: '67,31', ytd: '20193' },
    { label: 'SV-pfl. VBL-Umlage', code: '622', ebr: '20,00', ytd: '6000' },
    'rule',
    { label: 'Zahlbrutto', code: '599', amount: '3.15000', ytd: '945000' },
    { label: 'Gesamtbrutto EBV', code: '700', ebr: '3170,00' },
    'rule',
    { label: 'Lohnsteuer', code: '610', amount: '30000-', ytd: '90000' },
    { label: 'Kirchensteuer', code: '630', amount: '2700-', ytd: '8100' },
    {
      label: 'Pflegeversicherung',
      code: '646',
      rate: '1,775',
      amount: '5600-',
      arbg: '56,00',
      ytd: '16800',
    },
    {
      label: 'Krankenversicherung',
      code: '660',
      rate: '820',
      amount: '29000-',
      arbg: '290,00',
      ytd: '87000',
    },
    {
      label: 'Rentenversicherung',
      code: '670',
      rate: '945',
      amount: '29500-',
      arbg: '295,00',
      ytd: '88500',
    },
    {
      label: 'Arbeitslosenvers.',
      code: '680',
      rate: '150',
      amount: '4700-',
      arbg: '47,00',
      ytd: '14100',
    },
    'rule',
    { label: 'Netto', code: '799', amount: '213500' },
    { label: 'Netto EBV', code: '800', ebr: netEbv },
    'rule',
    { label: 'VL-Überwsg', code: '723', amount: '4000-', ytd: '12000' },
    { label: 'VBL-AN-Umlage', code: '818', rate: '141', amount: '3000-', ytd: '9000' },
    { label: 'Übertr.a.Nachbere.', code: '891', amount: '10000-' },
    'rule',
    { label: 'Überweisung', code: '895', amount: '196500' },
  ];
}

const REGULAR_TABLE: [string, string[]][] = [
  ['laufend', ['3.170,00', '3.170,00', '3.170,00', '3.170,00', '3.150,00']],
  ['EGA/Sonstige', ['0,00', '0,00', '0,00', '0,00', '0,00']],
  ['Abrech.-Summe', ['3.170,00', '3.170,00', '3.170,00', '3.170,00', '3.150,00']],
  ['Jahressumme', ['9.510,00', '9.510,00', '9.510,00', '9.510,00', '9.450,00']],
];

export const BBK_MAR_2025: BundesbankFixture = {
  fileName: '2025-03.pdf',
  document: document(page1('03.25/1 30,0', regularRows(), REGULAR_TABLE)),
  expected: {
    records: [
      {
        employer: 'Deutsche Bundesbank',
        period: '2025-03',
        issued: '2025-03',
        kind: 'REGULAR',
        seq: 1,
        amounts: {
          gross: '3170.00',
          taxGross: '3150.00',
          svGrossKv: '3170.00',
          svGrossRv: '3170.00',
          wageTax: '300.00',
          soli: '0.00',
          churchTax: '27.00',
          health: '290.00',
          care: '56.00',
          pension: '295.00',
          unemployment: '47.00',
          net: '2155.00',
          other: '-190.00',
          payout: '1965.00',
          oneOff: NO_ONE_OFF,
          employerSubsidy: null,
          ytd: {
            taxGross: '9450.00',
            wageTax: '900.00',
            churchTax: '81.00',
            health: '870.00',
            care: '168.00',
            pension: '885.00',
            unemployment: '141.00',
          },
        },
      },
    ],
  },
};

/** Printed Netto EBV 12.40 too high: NET check difference `net − (gross − taxes − social)` = 12.40. */
export const BBK_MAR_2025_NET_OFF: BundesbankFixture = {
  fileName: '2025-03-net-off.pdf',
  document: document(page1('03.25/1 30,0', regularRows('2167,40'), REGULAR_TABLE)),
  expected: {
    error: {
      code: 'CHECK_FAILED',
      params: { check: 'NET', period: '2025-03', difference: '12.40' },
    },
  },
};

/**
 * Bonus month 2025-12: Zahlbrutto 3150.00 + 1000.00 bonus (`441`) = 4150.00; Gesamtbrutto EBV
 * 4150.00 + 20.00 = 4170.00.
 *
 * - taxes: wage tax 520.00 (of which 220.00 on the bonus, `643`) + church tax 46.80 (19.80, `644`)
 * - social: 340.00 + 66.00 + 345.00 + 54.00 = 805.00
 * - net: 4170.00 − 566.80 − 805.00 = 2798.20; Zahlnetto 2778.20
 * - payout: 2778.20 − 40.00 − 30.00 = 2708.20; other −90.00
 * - EGA row: Steuer-Brutto of the bonus 1000.00; first statement of the year → year-to-date = month
 */
export const BBK_DEC_2025_BONUS: BundesbankFixture = {
  fileName: '2025-12.pdf',
  document: document(
    page1(
      '12.25/1 30,0',
      [
        'rule',
        { label: 'Grundbetrag', code: '122', amount: '3.00000' },
        { label: 'Zulage', code: '132', amount: '15000' },
        { label: 'Einmalzahlung', code: '441', amount: '1.00000' },
        { label: 'Zahlbrutto', code: '599', amount: '4.15000' },
        { label: 'Gesamtbrutto EBV', code: '700', ebr: '4170,00' },
        'rule',
        { label: 'Lohnsteuer', code: '610', amount: '52000-', ytd: '52000' },
        { label: 'Lohnsteuer EZ', code: '643', amount: '22000-' },
        { label: 'Kirchensteuer', code: '630', amount: '4680-', ytd: '4680' },
        { label: 'Kirchensteuer EZ', code: '644', amount: '1980-' },
        {
          label: 'Pflegeversicherung',
          code: '646',
          rate: '1,775',
          amount: '6600-',
          arbg: '66,00',
          ytd: '6600',
        },
        {
          label: 'Krankenversicherung',
          code: '660',
          rate: '820',
          amount: '34000-',
          arbg: '340,00',
          ytd: '34000',
        },
        {
          label: 'Rentenversicherung',
          code: '670',
          rate: '945',
          amount: '34500-',
          arbg: '345,00',
          ytd: '34500',
        },
        {
          label: 'Arbeitslosenvers.',
          code: '680',
          rate: '150',
          amount: '5400-',
          arbg: '54,00',
          ytd: '5400',
        },
        'rule',
        { label: 'Netto', code: '799', amount: '277820' },
        { label: 'Netto EBV', code: '800', ebr: '2798,20' },
        'rule',
        { label: 'VL-Überwsg', code: '723', amount: '4000-' },
        { label: 'VBL-AN-Umlage', code: '818', rate: '141', amount: '3000-' },
        'rule',
        { label: 'Überweisung', code: '895', amount: '270820' },
      ],
      [
        ['laufend', ['3.170,00', '3.170,00', '3.170,00', '3.170,00', '3.150,00']],
        ['EGA/Sonstige', ['1.000,00', '1.000,00', '1.000,00', '1.000,00', '1.000,00']],
        ['Abrech.-Summe', ['4.170,00', '4.170,00', '4.170,00', '4.170,00', '4.150,00']],
        ['Jahressumme', ['4.170,00', '4.170,00', '4.170,00', '4.170,00', '4.150,00']],
      ],
    ),
  ),
  expected: {
    records: [
      {
        employer: 'Deutsche Bundesbank',
        period: '2025-12',
        issued: '2025-12',
        kind: 'REGULAR',
        seq: 1,
        amounts: {
          gross: '4170.00',
          taxGross: '4150.00',
          svGrossKv: '4170.00',
          svGrossRv: '4170.00',
          wageTax: '520.00',
          soli: '0.00',
          churchTax: '46.80',
          health: '340.00',
          care: '66.00',
          pension: '345.00',
          unemployment: '54.00',
          net: '2798.20',
          other: '-90.00',
          payout: '2708.20',
          oneOff: { gross: '1000.00', taxGross: '1000.00', wageTax: '220.00', churchTax: '19.80' },
          employerSubsidy: null,
          ytd: {
            taxGross: '4150.00',
            wageTax: '520.00',
            churchTax: '46.80',
            health: '340.00',
            care: '66.00',
            pension: '345.00',
            unemployment: '54.00',
          },
        },
      },
    ],
  },
};

/**
 * Correction statement `02.25/2 03.25`: recalculation of February, calculated in March (`period`
 * 2025-02, `issued` 2025-03, `seq` 2). Gross 3170.00, wage tax 310.00, church tax 27.90, social
 * 688.00 → net 3170.00 − 337.90 − 688.00 = 2144.10. The printed Zahlnetto/Überweisung belong to the
 * statement of March: no payout, other = −net, no year-to-date.
 */
export const BBK_FEB_2025_CORRECTION: BundesbankFixture = {
  fileName: '2025-02_correction-2_calc-2025-03.pdf',
  document: document(
    page1(
      '02.25/2 03.25 30,0',
      [
        'rule',
        { label: 'Zahlbrutto', code: '599', amount: '3.15000' },
        { label: 'Gesamtbrutto EBV', code: '700', ebr: '3170,00' },
        'rule',
        { label: 'Lohnsteuer', code: '610', amount: '31000-', ytd: '61000' },
        { label: 'Kirchensteuer', code: '630', amount: '2790-', ytd: '5490' },
        {
          label: 'Pflegeversicherung',
          code: '646',
          rate: '1,775',
          amount: '5600-',
          arbg: '56,00',
          ytd: '11200',
        },
        {
          label: 'Krankenversicherung',
          code: '660',
          rate: '820',
          amount: '29000-',
          arbg: '290,00',
          ytd: '58000',
        },
        {
          label: 'Rentenversicherung',
          code: '670',
          rate: '945',
          amount: '29500-',
          arbg: '295,00',
          ytd: '59000',
        },
        {
          label: 'Arbeitslosenvers.',
          code: '680',
          rate: '150',
          amount: '4700-',
          arbg: '47,00',
          ytd: '9400',
        },
        'rule',
        { label: 'Netto', code: '799', amount: '212410' },
        { label: 'Netto EBV', code: '800', ebr: '2144,10' },
        'rule',
        { label: 'Überweisung', code: '895', amount: '212410' },
      ],
      [
        ['laufend', ['3.170,00', '3.170,00', '3.170,00', '3.170,00', '3.150,00']],
        ['EGA/Sonstige', ['0,00', '0,00', '0,00', '0,00', '0,00']],
        ['Abrech.-Summe', ['3.170,00', '3.170,00', '3.170,00', '3.170,00', '3.150,00']],
        ['Jahressumme', ['6.340,00', '6.340,00', '6.340,00', '6.340,00', '6.300,00']],
      ],
    ),
  ),
  expected: {
    records: [
      {
        employer: 'Deutsche Bundesbank',
        period: '2025-02',
        issued: '2025-03',
        kind: 'CORRECTION',
        seq: 2,
        amounts: {
          gross: '3170.00',
          taxGross: '3150.00',
          svGrossKv: '3170.00',
          svGrossRv: '3170.00',
          wageTax: '310.00',
          soli: '0.00',
          churchTax: '27.90',
          health: '290.00',
          care: '56.00',
          pension: '295.00',
          unemployment: '47.00',
          net: '2144.10',
          other: '-2144.10',
          payout: null,
          oneOff: NO_ONE_OFF,
          employerSubsidy: null,
          ytd: null,
        },
      },
    ],
  },
};

export const BBK_FIXTURES: readonly BundesbankFixture[] = [
  BBK_MAR_2025,
  BBK_MAR_2025_NET_OFF,
  BBK_DEC_2025_BONUS,
  BBK_FEB_2025_CORRECTION,
];

/** Personal data printed in every fixture's letterhead — must never appear in a parse result. */
export const BBK_PERSONAL_DATA = ['Musterfrau', 'Musterweg', 'Musterstadt', 'DE00', '00000000000'];
