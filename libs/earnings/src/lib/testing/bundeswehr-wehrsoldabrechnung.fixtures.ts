import {
  emptyPayRecordAmounts,
  type ParseError,
  type PayRecordAmounts,
  type PayRecordInput,
} from '../model';

/**
 * Synthetic Bundeswehr "Wehrsoldabrechnungsbeleg" statements as page lines (what the PDF adapter
 * produces from the scan's OCR layer). **Every name, address, identifier and amount is INVENTED** —
 * never paste real statement content here. Expected values are hand-computed; the arithmetic is
 * written next to each fixture and in ./README.md.
 */

export const BWE_EMPLOYER = 'Bundeswehr';

export interface BundeswehrFixture {
  fileName: string;
  pages: string[][];
  expected: { records: PayRecordInput[] } | { error: ParseError };
}

/** Letterhead identifiers — present on every page so tests prove they are never read. */
export const BWE_PERSONAL_DATA = [
  'Max Mustermann',
  'Musterweg 3',
  '12345 Musterstadt',
  '010101A12345',
  '123456789',
  '10000000',
  'SPARKASSE MUSTERSTADT',
];

interface PageSpec {
  /** Letter date `DD.MM.YYYY`. */
  date: string;
  /** Header month, e.g. `März 2011` (OCR damage allowed). */
  statement: string;
  /** Table lines as printed. */
  table: string[];
  /** `[Summe Bezüge lfd. Monat, Summe der Ausgleichsbeträge]` as printed. */
  sums: [string, string];
  /** Printed `Auszahlungsbetrag`; `null` leaves the line out (unreadable). */
  payout: string | null;
}

function page(spec: PageSpec): string[] {
  return [
    `BwDLZ Musterstadt - Beispieldienststelle Musterstadt, ${spec.date}`,
    'Musterstraße 1, 12345 Musterstadt',
    '4./Beispielbataillon 123',
    `Wehrsoldabrechnungsbeleg ${spec.statement}`,
    'Herrn Personenkennziffer: 010101A12345',
    'Max Mustermann (Bei Schriftverkehr bitte angeben.)',
    'Musterweg 3',
    '12345 Musterstadt',
    'Zahlungsart: unbar Dienstgrad: Gefreiter',
    'auf das Konto: 123456789 Eintritt W9: 01.10.2010',
    'Bankleitzahl: 10000000 Dienstmonat: 6',
    'bei: SPARKASSE MUSTERSTADT Dienststelle: 4./Beispielbataillon 123',
    'Bestandteile der Bezüge Bezüge Ausgleiche,',
    'lfd. Monat Einmalbezüge',
    'Anspruchs- Bezugstyp Satz Bezug Anzahl',
    'zeitraum (Euro) (Euro) (Euro)',
    ...spec.table,
    `Summe Bezüge ${spec.sums[0]} ${spec.sums[1]}`,
    `Summe der Ausgleichsbeträge ${spec.sums[1]}`,
    ...(spec.payout === null ? [] : [`Auszahlungsbetrag ${spec.payout}`]),
  ];
}

/** Attached travel-expense certificate: no statement header, must be ignored. */
const TRAVEL_CERTIFICATE = [
  'Bescheinigung über gezahlte Reisekostenvergütung',
  'Reisekosten Kommandierung Musterort vom 07.02.2011 - 11.02.2011',
  'Wegstreckenentschädigung gem. § 5 BRKG',
  'Hinfahrt 50 km x 0,25 € = 12,50 €',
  'Rückfahrt 50 km x 0,25 € = 12,50 €',
  'Auszuzahlender Betrag: 25,00 €',
];

function record(
  period: string,
  issued: string,
  kind: PayRecordInput['kind'],
  seq: number,
  amounts: Partial<PayRecordAmounts>,
): PayRecordInput {
  return {
    employer: BWE_EMPLOYER,
    period,
    issued,
    kind,
    seq,
    amounts: { ...emptyPayRecordAmounts(), ...amounts },
  };
}

const WEHRSOLD_31 = '03.2011 Wehrsold, Wehrsoldgruppe 2 10,50 x 31 325,50';

// ---------------------------------------------------------------- Mar 2011, regular + corrections
// Wehrsold 31 × 10.50 = 325.50; Feb: Reisekosten 25.00 + Verpflegungsgeld 120.00 = 145.00
// payout 325.50 + 145.00 = 470.50; Mar other = 470.50 − 325.50 = 145.00; Feb other = −145.00
export const BWE_MAR_2011: BundeswehrFixture = {
  fileName: '2011-03.pdf',
  pages: [
    page({
      date: '03.03.2011',
      statement: 'März 2011',
      table: [
        WEHRSOLD_31,
        '02.2011 Reisekostenvergütung Inland, manueller Zuschlag 25,00 E 25,00',
        '02.2011 Verpflegungsgeld 120,00 E 120,00',
      ],
      sums: ['325,50', '145,00'],
      payout: '470,50',
    }),
    TRAVEL_CERTIFICATE,
  ],
  expected: {
    records: [
      record('2011-03', '2011-03', 'REGULAR', 1, {
        gross: '325.50',
        net: '325.50',
        other: '145.00',
        payout: '470.50',
      }),
      record('2011-02', '2011-03', 'CORRECTION', 2, {
        gross: '145.00',
        net: '145.00',
        other: '-145.00',
      }),
    ],
  },
};

// ---------------------------------------------------------------- Jan 2011, two statements
// Statement 1 (unit A, 10.01.): Verpflegungsgeld Dec 40.00, payout 40.00
// Statement 2 (unit B, 11.01.): Wehrsold 31 × 10.50 = 325.50, Mobilitätszuschlag Dec −20.00,
//   Verpflegungsgeld Dec 60.00, payout 365.50 (sums 325.50 / 40.00)
// merged: payout 405.50; Dec net 40.00 − 20.00 + 60.00 = 80.00; Jan other 405.50 − 325.50 = 80.00
export const BWE_JAN_2011_TWO_STATEMENTS: BundeswehrFixture = {
  fileName: '2011-01.pdf',
  pages: [
    page({
      date: '10.01.2011',
      statement: 'Januar 2011',
      table: ['12.2010 | Verpflegungsgeld 40,00 | E \\ 40,00'],
      sums: ['0,00', '40,00'],
      payout: '40,00',
    }),
    page({
      date: '11.01.2011',
      statement: 'Januar 2011',
      table: [
        '01.2011 Wehrsold, Wehrsoldgruppe 2 10,50|x 31 325,50',
        '12.2010 Mobilitätszuschlag -20,001E -20,00',
        '12.2010 Verpflegungsgeld 60,00|E 60,00',
      ],
      sums: ['325,50', '40,00'],
      payout: '365,50',
    }),
  ],
  expected: {
    records: [
      record('2011-01', '2011-01', 'REGULAR', 1, {
        gross: '325.50',
        net: '325.50',
        other: '80.00',
        payout: '405.50',
      }),
      record('2010-12', '2011-01', 'CORRECTION', 2, {
        gross: '80.00',
        net: '80.00',
        other: '-80.00',
      }),
    ],
  },
};

// ---------------------------------------------------------------- Feb 2011, superseded statement
// Statement 1 (05.02.): Wehrsold 28 × 10.50 = 294.00; statement 2 (08.02.) repeats it and adds
// Verpflegungsgeld Jan 130.00 → statement 1 is ignored; payout 424.00
export const BWE_FEB_2011_SUPERSEDED: BundeswehrFixture = {
  fileName: '2011-02.pdf',
  pages: [
    page({
      date: '05.02.2011',
      statement: 'Februar 2011',
      table: ['02.2011 Wehrsold, Wehrsoldgruppe 2 10,50 x 28 294,00'],
      sums: ['294,00', '0,00'],
      payout: '294,00',
    }),
    page({
      date: '08.02.2011',
      statement: 'Februar 2011',
      table: [
        '02.2011 Wehrsold, Wehrsoldgruppe 2 10,50 x 28 294,00',
        '01.2011 Verpflegungsgeld 130,00 E 130,00',
      ],
      sums: ['294,00', '130,00'],
      payout: '424,00',
    }),
  ],
  expected: {
    records: [
      record('2011-02', '2011-02', 'REGULAR', 1, {
        gross: '294.00',
        net: '294.00',
        other: '130.00',
        payout: '424.00',
      }),
      record('2011-01', '2011-02', 'CORRECTION', 2, {
        gross: '130.00',
        net: '130.00',
        other: '-130.00',
      }),
    ],
  },
};

// ---------------------------------------------------------------- Apr 2011, one-off pay
// Wehrsold 30 × 10.50 = 315.00 + Zuwendung 100.00 = 415.00 (one-off gross 100.00); payout 415.00
export const BWE_APR_2011_BONUS: BundeswehrFixture = {
  fileName: '2011-04.pdf',
  pages: [
    page({
      date: '05.04.2011',
      statement: 'April 2011',
      table: [
        '04.2011 Wehrsold, Wehrsoldgruppe 2 10,50 x 30 315,00',
        '04.2011 Sonderzuwendung 100,00 E 100,00',
      ],
      sums: ['315,00', '100,00'],
      payout: '415,00',
    }),
  ],
  expected: {
    records: [
      record('2011-04', '2011-04', 'REGULAR', 1, {
        gross: '415.00',
        net: '415.00',
        other: '0.00',
        payout: '415.00',
        oneOff: { gross: '100.00' },
      }),
    ],
  },
};

// ---------------------------------------------------------------- May 2011, only a back payment
// Verpflegungsgeld Apr 90.00; payout 90.00 → PAYOUT_ONLY May (other = payout), Apr net 90.00
export const BWE_MAY_2011_PAYOUT_ONLY: BundeswehrFixture = {
  fileName: '2011-05.pdf',
  pages: [
    page({
      date: '06.05.2011',
      statement: 'Mai 2011',
      table: ['04.2011 Verpflegungsgeld 90,00 E 90,00'],
      sums: ['0,00', '90,00'],
      payout: '90,00',
    }),
  ],
  expected: {
    records: [
      record('2011-05', '2011-05', 'PAYOUT_ONLY', 1, { other: '90.00', payout: '90.00' }),
      record('2011-04', '2011-05', 'CORRECTION', 2, {
        gross: '90.00',
        net: '90.00',
        other: '-90.00',
      }),
    ],
  },
};

// ---------------------------------------------------------------- Jun 2011, unreadable payout
// Wehrsold 30 × 10.50 = 315.00; the Auszahlungsbetrag line is missing → derived from the sums
// 315.00 + 0.00 = 315.00
export const BWE_JUN_2011_PAYOUT_DERIVED: BundeswehrFixture = {
  fileName: '2011-06.pdf',
  pages: [
    page({
      date: '07.06.2011',
      statement: 'Juni 2011',
      table: ['06.2011 Wehrsold, Wehrsoldgruppe 2 10,50 x 30 315,00'],
      sums: ['315,00', '0,00'],
      payout: null,
    }),
  ],
  expected: {
    records: [
      record('2011-06', '2011-06', 'REGULAR', 1, {
        gross: '315.00',
        net: '315.00',
        other: '0.00',
        payout: '315.00',
      }),
    ],
  },
};

// ---------------------------------------------------------------- Mar 2011, printed payout 10.00 too high
export const BWE_MAR_2011_PAYOUT_OFF: BundeswehrFixture = {
  fileName: '2011-03-falsch.pdf',
  pages: [
    page({
      date: '03.03.2011',
      statement: 'März 2011',
      table: [
        WEHRSOLD_31,
        '02.2011 Reisekostenvergütung Inland, manueller Zuschlag 25,00 E 25,00',
        '02.2011 Verpflegungsgeld 120,00 E 120,00',
      ],
      sums: ['325,50', '145,00'],
      payout: '480,50',
    }),
  ],
  expected: {
    error: {
      code: 'CHECK_FAILED',
      params: { check: 'PAYOUT', period: '2011-03', difference: '10.00' },
    },
  },
};

// ---------------------------------------------------------------- OCR damage in the header month
export const BWE_MAR_2011_OCR_HEADER: BundeswehrFixture = {
  ...BWE_MAR_2011,
  fileName: '2011-03-ocr.pdf',
  pages: [
    BWE_MAR_2011.pages[0].map((l) => l.replace('März 2011', 'Marz 2011')),
    TRAVEL_CERTIFICATE,
  ],
};

export const BWE_FIXTURES: readonly BundeswehrFixture[] = [
  BWE_MAR_2011,
  BWE_JAN_2011_TWO_STATEMENTS,
  BWE_FEB_2011_SUPERSEDED,
  BWE_APR_2011_BONUS,
  BWE_MAY_2011_PAYOUT_ONLY,
  BWE_JUN_2011_PAYOUT_DERIVED,
  BWE_MAR_2011_PAYOUT_OFF,
  BWE_MAR_2011_OCR_HEADER,
];
