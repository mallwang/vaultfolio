import {
  emptyPayRecordAmounts,
  type ParseError,
  type PayRecordAmounts,
  type PayRecordInput,
} from '../model';

/**
 * Synthetic SAP "Entgeltnachweis" payslips as page lines (what the PDF adapter produces). Every
 * name, address, identifier and amount is INVENTED — never paste real payslip content here. The
 * same page lines drive the text-level parser tests and the synthetic PDFs of the frontend adapter
 * tests (libs/frontend/domain/earnings/src/testing/synthetic-pdfs.ts). Expected values are
 * hand-computed; the arithmetic is written next to each fixture and in ./README.md.
 */

export const SAP_EMPLOYER = 'Brightline Software GmbH';

export interface SapFixture {
  fileName: string;
  pages: string[][];
  expected: { records: PayRecordInput[] } | { error: ParseError };
}

/** Header block of every page — identifiers are present so tests prove they are never read. */
function header(statement: string): string[] {
  return [
    `${SAP_EMPLOYER} · Hafenstraße 12 · 20457 Hamburg`,
    'Erika Musterfrau',
    'Musterweg 1',
    '12345 Musterstadt',
    `Entgeltnachweis für ${statement}`,
    'Personalnummer 00012345 Steuer-ID 12 345 678 901 SV-Nummer 12 010180 M 123',
  ];
}

const FOOTER = [
  'GRUNDDATEN',
  'Steuerklasse 1 Kinderfreibetrag 0,0 Konfession ev',
  'Krankenkasse Musterkasse',
];
const LEGEND = 'Kennz.: E = Einmalbezug, G = Gesamtbrutto';

function amounts(values: Partial<PayRecordAmounts>): PayRecordAmounts {
  return { ...emptyPayRecordAmounts(), ...values };
}

function record(
  values: Omit<PayRecordInput, 'employer' | 'amounts'> & { amounts: Partial<PayRecordAmounts> },
): PayRecordInput {
  return { employer: SAP_EMPLOYER, ...values, amounts: amounts(values.amounts) };
}

// ---------------------------------------------------------------- Sep 2026 with a Jul correction
// Sep (regular): gross 5000.00 + 200.00 = 5200.00
//   taxes 850.00 + 0.00 + 68.00 = 918.00; social 416.00 + 93.60 + 483.60 + 67.60 = 1060.80
//   net 5200.00 − 918.00 − 1060.80 = 3221.20; other −40.00 (VL) − 62.85 (/552) = −102.85
// Jul (correction, seq 1 + 2 = 3): gross −120.00; taxes −30.25 − 2.42 = −32.67;
//   social −9.60 − 2.16 − 11.16 − 1.56 = −24.48; net −120.00 + 32.67 + 24.48 = −62.85; other = −Y551 = 62.85
// payout 3221.20 − 102.85 + (−62.85 + 62.85) = 3118.35
// The Sep section breaks across pages (GRUNDDATEN footer → next page header resumes the block).
export const SAP_SEP_2026_WITH_CORRECTION: SapFixture = {
  fileName: '2026_09_Entgeltnachweis.pdf',
  pages: [
    [
      ...header('September 2026'),
      'Abrechnungsdaten für September 2026',
      'ENTGELTBESTANDTEILE',
      'LArt Bezeichnung Menge Betrag Kennz',
      '1000 Tarifgehalt 160,00 S 5.000,00 G',
      '1100 Funktionszulage 200,00 G',
      '1500 Jobticket geldwerter Vorteil 49,00',
      'Summe Entgeltbestandteile 5.249,00',
      'BRUTTOENTGELTE',
      'Y$10 Steuer-Brutto 5.200,00',
      'Y$20 SV-Brutto KV 5.200,00',
      'Y$21 SV-Brutto PV 5.200,00',
      'Y$22 SV-Brutto RV 5.200,00',
      'Y$23 SV-Brutto AV 5.200,00',
      'Gesamtbrutto 5.200,00',
      'GESETZLICHE ABZÜGE',
      'Y$50 Lohnsteuer 850,00',
      'Y$51 Solidaritätszuschlag 0,00',
      'Y$52 Kirchensteuer 68,00',
      'Y$60 Krankenversicherung 416,00',
      ...FOOTER,
    ],
    [
      ...header('September 2026'),
      'Y$61 Pflegeversicherung 93,60',
      'Y$62 Rentenversicherung 483,60',
      'Y$63 Arbeitslosenversicherung 67,60',
      'Summe gesetzliche Abzüge 1.978,80',
      '/55E Gesetzl. Netto 3.221,20',
      'SONSTIGE BE-/ABZÜGE',
      '4100 VL Arbeitnehmeranteil 40,00-',
      '/552 Nachverrechnung aus Vorm. 62,85-',
      'Summe Sonstige Be-/Abzüge 102,85-',
      'Abrechnungsdaten für Juli 2026',
      'ENTGELTBESTANDTEILE',
      '1000 Tarifgehalt 120,00- G',
      'BRUTTOENTGELTE',
      'Y$10 Steuer-Brutto 120,00-',
      'Y$20 SV-Brutto KV 120,00-',
      'Y$22 SV-Brutto RV 120,00-',
      'Gesamtbrutto 120,00-',
      'GESETZLICHE ABZÜGE',
      'Y$50 Lohnsteuer 30,25-',
      'Y$51 Solidaritätszuschlag 0,00',
      'Y$52 Kirchensteuer 2,42-',
      'Y$60 Krankenversicherung 9,60-',
      'Y$61 Pflegeversicherung 2,16-',
      'Y$62 Rentenversicherung 11,16-',
      'Y$63 Arbeitslosenversicherung 1,56-',
      '/55E Gesetzl. Netto 62,85-',
      'SONSTIGE BE-/ABZÜGE',
      'Y551 Differenz zur letzt. Abr. 62,85-',
      'Summe Sonstige Be-/Abzüge:',
      'Überweisung an IBAN DE00 **** **** **** 1234 3.118,35',
      LEGEND,
      'JAHRESSUMMEN',
      'Gesamt-Brut 46.680,00 St-Br-lfd 45.180,00 St-Br-EZ 1.500,00',
      'Lohnst.lfd 7.650,00 Lohnst. EZ 450,00 KiSt. lfd. 612,00 KiSt. EZ 36,00',
      'SolZ. lfd. 0,00 SolZ. EZ 0,00',
      'KV-Beitrag 3.734,40 PV-Beitrag 840,24 RV-Beitrag 4.341,24 AV-Beitrag 606,84',
      ...FOOTER,
    ],
  ],
  expected: {
    records: [
      record({
        period: '2026-09',
        issued: '2026-09',
        kind: 'REGULAR',
        seq: 1,
        amounts: {
          gross: '5200.00',
          taxGross: '5200.00',
          svGrossKv: '5200.00',
          svGrossRv: '5200.00',
          wageTax: '850.00',
          soli: '0.00',
          churchTax: '68.00',
          health: '416.00',
          care: '93.60',
          pension: '483.60',
          unemployment: '67.60',
          net: '3221.20',
          other: '-102.85',
          payout: '3118.35',
          ytd: {
            gross: '46680.00',
            taxGross: '46680.00',
            wageTax: '8100.00',
            churchTax: '648.00',
            soli: '0.00',
            health: '3734.40',
            care: '840.24',
            pension: '4341.24',
            unemployment: '606.84',
          },
        },
      }),
      record({
        period: '2026-07',
        issued: '2026-09',
        kind: 'CORRECTION',
        seq: 3,
        amounts: {
          gross: '-120.00',
          taxGross: '-120.00',
          svGrossKv: '-120.00',
          svGrossRv: '-120.00',
          wageTax: '-30.25',
          soli: '0.00',
          churchTax: '-2.42',
          health: '-9.60',
          care: '-2.16',
          pension: '-11.16',
          unemployment: '-1.56',
          net: '-62.85',
          other: '62.85',
          payout: null,
        },
      }),
    ],
  },
};

// ---------------------------------------------------------------- Aug 2026, plain month
// gross 5000.00; taxes 800.00 + 0.00 + 64.00 = 864.00; social 400.00 + 90.00 + 465.00 + 65.00 = 1020.00
// net 5000.00 − 864.00 − 1020.00 = 3116.00; other −40.00; payout 3076.00
function augustLines(net: string, payout: string, extraDeduction?: string): string[][] {
  return [
    [
      ...header('August 2026'),
      'Abrechnungsdaten für August 2026',
      'ENTGELTBESTANDTEILE',
      '1000 Tarifgehalt 160,00 S 5.000,00 G',
      'BRUTTOENTGELTE',
      'Y$10 Steuer-Brutto 5.000,00',
      'Y$20 SV-Brutto KV 5.000,00',
      'Y$22 SV-Brutto RV 5.000,00',
      'Gesamtbrutto 5.000,00',
      'GESETZLICHE ABZÜGE',
      'Y$50 Lohnsteuer 800,00',
      'Y$51 Solidaritätszuschlag 0,00',
      'Y$52 Kirchensteuer 64,00',
      'Y$60 Krankenversicherung 400,00',
      'Y$61 Pflegeversicherung 90,00',
      'Y$62 Rentenversicherung 465,00',
      'Y$63 Arbeitslosenversicherung 65,00',
      ...(extraDeduction ? [extraDeduction] : []),
      `/55E Gesetzl. Netto ${net}`,
      'SONSTIGE BE-/ABZÜGE',
      '4100 VL Arbeitnehmeranteil 40,00-',
      'Summe Sonstige Be-/Abzüge 40,00-',
      `Überweisung an IBAN DE00 **** **** **** 1234 ${payout}`,
      LEGEND,
      ...FOOTER,
    ],
  ];
}

const AUGUST_RECORD = record({
  period: '2026-08',
  issued: '2026-08',
  kind: 'REGULAR',
  seq: 1,
  amounts: {
    gross: '5000.00',
    taxGross: '5000.00',
    svGrossKv: '5000.00',
    svGrossRv: '5000.00',
    wageTax: '800.00',
    soli: '0.00',
    churchTax: '64.00',
    health: '400.00',
    care: '90.00',
    pension: '465.00',
    unemployment: '65.00',
    net: '3116.00',
    other: '-40.00',
    payout: '3076.00',
  },
});

export const SAP_AUG_2026: SapFixture = {
  fileName: '2026_08_Entgeltnachweis.pdf',
  pages: augustLines('3.116,00', '3.076,00'),
  expected: { records: [AUGUST_RECORD] },
};

/** Printed net is 12.40 higher than gross − taxes − social → NET fails with difference 12.40. */
export const SAP_AUG_2026_NET_OFF: SapFixture = {
  fileName: '2026_08_Entgeltnachweis_falsch.pdf',
  pages: augustLines('3.128,40', '3.088,40'),
  expected: {
    error: {
      code: 'CHECK_FAILED',
      params: { check: 'NET', period: '2026-08', difference: '12.40' },
    },
  },
};

/** An unknown coded line under GESETZLICHE ABZÜGE rejects the file. */
export const SAP_AUG_2026_UNKNOWN_LINE: SapFixture = {
  fileName: '2026_08_Entgeltnachweis_unbekannt.pdf',
  pages: augustLines('3.104,00', '3.064,00', 'Y$58 Umlage Sonderabgabe 12,00'),
  expected: {
    error: {
      code: 'UNKNOWN_LINE',
      params: { label: 'Y$58 Umlage Sonderabgabe', period: '2026-08' },
    },
  },
};

// ---------------------------------------------------------------- Mar 2026, voluntary KV/PV
// gross 7000.00; taxes 1500.00 + 0.00 + 120.00 = 1620.00; statutory RV 651.00, AV 91.00
// printed net 7000.00 − 1620.00 − 742.00 = 4638.00
// contribution KV 520.00, PV 110.00; subsidy 260.00 / 55.00 → own share 260.00 / 55.00
// Summe Sonstige −520.00 − 110.00 + 260.00 + 55.00 − 40.00 = −355.00; payout 4638.00 − 355.00 = 4283.00
// record: health 260.00, care 55.00, net 4638.00 − 315.00 = 4323.00, other −355.00 + 315.00 = −40.00
export const SAP_MAR_2026_VOLUNTARY: SapFixture = {
  fileName: '2026_03_Entgeltnachweis.pdf',
  pages: [
    [
      ...header('März 2026'),
      'Abrechnungsdaten für März 2026',
      'ENTGELTBESTANDTEILE',
      '1000 Tarifgehalt 7.000,00 G',
      'BRUTTOENTGELTE',
      'Y$10 Steuer-Brutto 7.000,00',
      'Y$20 SV-Brutto KV 5.512,50',
      'Y$22 SV-Brutto RV 7.000,00',
      'Gesamtbrutto 7.000,00',
      'GESETZLICHE ABZÜGE',
      'Y$50 Lohnsteuer 1.500,00',
      'Y$51 Solidaritätszuschlag 0,00',
      'Y$52 Kirchensteuer 120,00',
      'Y$62 Rentenversicherung 651,00',
      'Y$63 Arbeitslosenversicherung 91,00',
      '/55E Gesetzl. Netto 4.638,00',
      'SONSTIGE BE-/ABZÜGE',
      '/381 KV-Beitrag Firmenzahler 520,00-',
      '/3QR PV-Beitrag Firmenzahler 110,00-',
      '/358 AG-Zuschuss KV 260,00',
      '/3Q8 AG-Zuschuss PV 55,00',
      '4100 VL Arbeitnehmeranteil 40,00-',
      'Summe Sonstige Be-/Abzüge 355,00-',
      'Überweisung an IBAN DE00 **** **** **** 1234 4.283,00',
      LEGEND,
      ...FOOTER,
    ],
  ],
  expected: {
    records: [
      record({
        period: '2026-03',
        issued: '2026-03',
        kind: 'REGULAR',
        seq: 1,
        amounts: {
          gross: '7000.00',
          taxGross: '7000.00',
          svGrossKv: '5512.50',
          svGrossRv: '7000.00',
          wageTax: '1500.00',
          soli: '0.00',
          churchTax: '120.00',
          health: '260.00',
          care: '55.00',
          pension: '651.00',
          unemployment: '91.00',
          net: '4323.00',
          other: '-40.00',
          payout: '4283.00',
          employerSubsidy: { health: '260.00', care: '55.00' },
        },
      }),
    ],
  },
};

// ---------------------------------------------------------------- Dec 2025, bonus month
// gross 5000.00 + 3000.00 (E G) = 8000.00, oneOff.gross 3000.00
// taxGross 5000.00 + 3000.00 (EZ) = 8000.00, oneOff 3000.00
// wageTax 800.00 + 900.00 (EZ) = 1700.00, oneOff 900.00; churchTax 64.00 + 72.00 = 136.00, oneOff 72.00
// taxes 1836.00; social 441.00 + 99.23 + 744.00 + 104.00 = 1388.23
// net 8000.00 − 1836.00 − 1388.23 = 4775.77; other −40.00; payout 4735.77
export const SAP_DEC_2025_BONUS: SapFixture = {
  fileName: '2025_12_Entgeltnachweis.pdf',
  pages: [
    [
      ...header('Dezember 2025'),
      'Abrechnungsdaten für Dezember 2025',
      'ENTGELTBESTANDTEILE',
      '1000 Tarifgehalt 160,00 S 5.000,00 G',
      '2P60 Sonderzahlung GJ 2024/2025 3.000,00 EG',
      'BRUTTOENTGELTE',
      'Y$10 Steuer-Brutto 5.000,00',
      'Y#10 Steuer-Brutto, EZ 3.000,00',
      'Y$20 SV-Brutto KV 5.512,50',
      'Y$22 SV-Brutto RV 8.000,00',
      'Gesamtbrutto 8.000,00',
      'GESETZLICHE ABZÜGE',
      'Y$50 Lohnsteuer 800,00',
      'Y#50 Lohnsteuer, EZ 900,00',
      'Y$51 Solidaritätszuschlag 0,00',
      'Y$52 Kirchensteuer 64,00',
      'Y#52 Kirchensteuer, EZ 72,00',
      'Y$60 Krankenversicherung 441,00',
      'Y$61 Pflegeversicherung 99,23',
      'Y$62 Rentenversicherung 744,00',
      'Y$63 Arbeitslosenversicherung 104,00',
      'P3BG Pausch.StB §37b AG 12,50',
      '/55E Gesetzl. Netto 4.775,77',
      'SONSTIGE BE-/ABZÜGE',
      '4100 VL Arbeitnehmeranteil 40,00-',
      'Summe Sonstige Be-/Abzüge 40,00-',
      'Überweisung an IBAN DE00 **** **** **** 1234 4.735,77',
      LEGEND,
      ...FOOTER,
    ],
  ],
  expected: {
    records: [
      record({
        period: '2025-12',
        issued: '2025-12',
        kind: 'REGULAR',
        seq: 1,
        amounts: {
          gross: '8000.00',
          taxGross: '8000.00',
          svGrossKv: '5512.50',
          svGrossRv: '8000.00',
          wageTax: '1700.00',
          soli: '0.00',
          churchTax: '136.00',
          health: '441.00',
          care: '99.23',
          pension: '744.00',
          unemployment: '104.00',
          net: '4775.77',
          other: '-40.00',
          payout: '4735.77',
          oneOff: { gross: '3000.00', taxGross: '3000.00', wageTax: '900.00', churchTax: '72.00' },
        },
      }),
    ],
  },
};

// ---------------------------------------------------------------- Oct 2026, back-payment only
// Only a correction section for Aug 2026 (seq 1 + 2 = 3): gross 300.00; taxes 75.00 + 6.00 = 81.00;
//   social 24.00 + 5.40 + 27.90 + 3.90 = 61.20; net 300.00 − 81.00 − 61.20 = 157.80; other −157.80
// No section for October → a PAYOUT_ONLY record for 2026-10 carries the payout: net 0.00,
//   other = payout 157.80 (the moved correction net)
export const SAP_OCT_2026_PAYOUT_ONLY: SapFixture = {
  fileName: '2026_10_Entgeltnachweis_Nachzahlung.pdf',
  pages: [
    [
      ...header('Oktober 2026'),
      'Abrechnungsdaten für August 2026',
      'ENTGELTBESTANDTEILE',
      '1000 Tarifgehalt 300,00 G',
      'BRUTTOENTGELTE',
      'Y$10 Steuer-Brutto 300,00',
      'Y$20 SV-Brutto KV 300,00',
      'Y$22 SV-Brutto RV 300,00',
      'Gesamtbrutto 300,00',
      'GESETZLICHE ABZÜGE',
      'Y$50 Lohnsteuer 75,00',
      'Y$52 Kirchensteuer 6,00',
      'Y$60 Krankenversicherung 24,00',
      'Y$61 Pflegeversicherung 5,40',
      'Y$62 Rentenversicherung 27,90',
      'Y$63 Arbeitslosenversicherung 3,90',
      '/55E Gesetzl. Netto 157,80',
      'SONSTIGE BE-/ABZÜGE',
      'Y551 Differenz zur letzt. Abr. 157,80',
      'Summe Sonstige Be-/Abzüge:',
      'Überweisung an IBAN DE00 **** **** **** 1234 157,80',
      LEGEND,
      ...FOOTER,
    ],
  ],
  expected: {
    records: [
      record({
        period: '2026-08',
        issued: '2026-10',
        kind: 'CORRECTION',
        seq: 3,
        amounts: {
          gross: '300.00',
          taxGross: '300.00',
          svGrossKv: '300.00',
          svGrossRv: '300.00',
          wageTax: '75.00',
          churchTax: '6.00',
          health: '24.00',
          care: '5.40',
          pension: '27.90',
          unemployment: '3.90',
          net: '157.80',
          other: '-157.80',
          payout: null,
        },
      }),
      record({
        period: '2026-10',
        issued: '2026-10',
        kind: 'PAYOUT_ONLY',
        seq: 1,
        amounts: { other: '157.80', payout: '157.80' },
      }),
    ],
  },
};

export const SAP_FIXTURES: readonly SapFixture[] = [
  SAP_SEP_2026_WITH_CORRECTION,
  SAP_AUG_2026,
  SAP_AUG_2026_NET_OFF,
  SAP_AUG_2026_UNKNOWN_LINE,
  SAP_MAR_2026_VOLUNTARY,
  SAP_DEC_2025_BONUS,
  SAP_OCT_2026_PAYOUT_ONLY,
];

/** Text that is not a payslip (for `detect` = false and UNSUPPORTED_FORMAT). */
export const UNRELATED_PAGES: string[][] = [
  ['Rechnung Nr. 4711', 'Musterladen GmbH · Einkaufsstraße 5', 'Gesamtbetrag 119,00 EUR'],
];
