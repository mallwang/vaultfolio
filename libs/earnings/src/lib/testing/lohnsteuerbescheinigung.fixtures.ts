import { type CertificateAmounts, emptyCertificateAmounts } from '../model';

/**
 * Synthetic "Ausdruck der elektronischen Lohnsteuerbescheinigung" pages in two employer layouts of
 * the same official form. Every name, identifier and amount is INVENTED.
 */
export interface CertificateFixture {
  fileName: string;
  pages: string[][];
  expected: { employer: string; year: number; amounts: CertificateAmounts };
}

/** Layout A (form up to 2024 wording), statutory health/care insurance, empty lines 5, 6, 11–13, 24. */
export const LSTB_2025_BRIGHTLINE: CertificateFixture = {
  fileName: '2025_Lohnsteuerbescheinigung.pdf',
  pages: [
    [
      'Ausdruck der elektronischen Lohnsteuerbescheinigung für 2025',
      'Dauer des Dienstverhältnisses 01.01. - 31.12.',
      'Anschrift und Steuernummer des Arbeitgebers',
      'Brightline Software GmbH',
      'Hafenstraße 12, 20457 Hamburg',
      'Erika Musterfrau, Musterweg 1, 12345 Musterstadt',
      'eTIN MSTRERKA80A01 Identifikationsnummer 12 345 678 901',
      '3. Bruttoarbeitslohn einschl. Sachbezüge ohne 9. und 10. 55.000,00',
      '4. Einbehaltene Lohnsteuer von 3. 8.800,00',
      '5. Einbehaltener Solidaritätszuschlag von 3.',
      '6. Einbehaltene Kirchensteuer des Arbeitnehmers von 3.',
      '10. Ermäßigt besteuerter Arbeitslohn für mehrere Kalenderjahre und ermäßigt besteuerte Entschädigungen',
      '11. Einbehaltene Lohnsteuer von 9. und 10.',
      '12. Einbehaltener Solizuschlag von 9. und 10.',
      '13. Einbehaltene Kirchensteuer des Arbeitnehmers von 9. und 10.',
      '22. Arbeitgeberan- a) zur gesetzlichen RV 5.115,00',
      'teil b) an berufsständische Versorgungseinrichtungen',
      '23. Arbeitnehmer- a) zur gesetzlichen RV 5.115,00',
      'anteil b) an berufsständische Versorgungseinrichtungen',
      '24. Steuerfreie a) zur gesetzlichen KV',
      'Arbeitgeber- b) zur privaten KV',
      'zuschüsse c) zur gesetzlichen PV',
      '25. Arbeitnehmerbeiträge zur gesetzlichen KV 4.400,00',
      '26. Arbeitnehmerbeiträge zur sozialen PV 990,00',
      '27. Arbeitnehmerbeiträge zur AV 715,00',
    ],
  ],
  expected: {
    employer: 'Brightline Software GmbH',
    year: 2025,
    amounts: {
      ...emptyCertificateAmounts(),
      grossWage: '55000.00',
      wageTax: '8800.00',
      pensionEmployer: '5115.00',
      pensionEmployee: '5115.00',
      health: '4400.00',
      care: '990.00',
      unemployment: '715.00',
    },
  },
};

/**
 * Layout B (form from 2025 wording, two-line church-tax label), another employer, voluntary KV/PV
 * with employer subsidies (24a/24c) and multi-year pay (lines 10–13). Line 6 spans two lines.
 */
export const LSTB_2026_NORTHWIND: CertificateFixture = {
  fileName: 'LStB_2026_Northwind.pdf',
  pages: [
    [
      'Northwind Instruments AG | Personalabteilung | Postfach 100, 80331 München',
      'Ausdruck der elektronischen Lohnsteuerbescheinigung für 2026',
      'Name und Anschrift des Arbeitgebers: Northwind Instruments AG, Seestraße 3, 80331 München',
      'Identifikationsnummer 98 765 432 109',
      '3. Bruttoarbeitslohn einschl.Sachbezüge 84.000,00',
      '4. Einbehaltene Lohnsteuer von 3. 19.320,00',
      '5. Einbehaltener Solidaritätszuschlag von 3. 312,40',
      '6. Einbehaltene Kirchensteuer des',
      'Arbeitnehmers von 3. 1.545,60',
      '10. Ermäßigt besteuerter Arbeitslohn (mj.) und ermäßigt besteuerte Entschädigungen 6.000,00',
      '11. Einbehaltene Lohnsteuer von 9. und 10. 2.100,00',
      '12. Einbehaltener Solizuschlag von 9. und 10. 115,50',
      '13. Einbehaltene Kirchensteuer des Arbeitnehmers von 9. und 10. 168,00',
      '22. Arbeitgeberan- a) zur gesetzlichen RV 8.370,00',
      '23. Arbeitnehmer- a) zur gesetzlichen RV 8.370,00',
      '24. Steuerfreie a) zur gesetzlichen KV 5.200,00',
      'Arbeitgeber- b) zur privaten KV',
      'zuschüsse c) zur gesetzlichen PV 1.100,00',
      '25. Arbeitnehmerbeiträge zur gesetzlichen KV 10.400,00',
      '26. Arbeitnehmerbeiträge zur sozialen PV 2.200,00',
      '27. Arbeitnehmerbeiträge zur AV 1.170,00',
    ],
  ],
  expected: {
    employer: 'Northwind Instruments AG',
    year: 2026,
    amounts: {
      grossWage: '84000.00',
      wageTax: '19320.00',
      soli: '312.40',
      churchTax: '1545.60',
      multiYearComp: '6000.00',
      multiYearWageTax: '2100.00',
      multiYearSoli: '115.50',
      multiYearChurchTax: '168.00',
      pensionEmployer: '8370.00',
      pensionEmployee: '8370.00',
      employerSubsidyHealth: '5200.00',
      employerSubsidyCare: '1100.00',
      health: '10400.00',
      care: '2200.00',
      unemployment: '1170.00',
    },
  },
};

export const CERTIFICATE_FIXTURES: readonly CertificateFixture[] = [
  LSTB_2025_BRIGHTLINE,
  LSTB_2026_NORTHWIND,
];
