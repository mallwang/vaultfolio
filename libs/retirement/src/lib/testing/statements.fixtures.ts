import { type PdfDocumentText, textDocument } from '@vaultfolio/document-text';

/**
 * Synthetic statements reproducing the three launch layouts (research R6, R12). Every name,
 * address, bank detail, number and amount is INVENTED; nothing here stems from a real document.
 * Each builder returns a `PdfDocumentText`; variants cover a misread figure, a missing label and
 * a scanned (`RECOGNISED`) rendition with the digit confusions text recognition typically makes.
 */
export type StatementVariant = 'valid' | 'misread' | 'missing-label' | 'scanned';

/** Personal lines every layout carries; parsers must never let them reach their output. */
export const PERSONAL_LINES = [
  'Erika Musterfrau',
  'Musterweg 1',
  '12345 Musterstadt',
  'IBAN DE02 1203 0000 0000 2020 51',
  'Steuer-ID 12 345 678 901',
];

function asScan(
  doc: PdfDocumentText,
  confusions: ReadonlyArray<[RegExp, string]>,
): PdfDocumentText {
  return {
    origin: 'RECOGNISED',
    pages: doc.pages.map((page) => ({
      ...page,
      lines: page.lines.map((line) => {
        const words = line.words.map((w) => ({ ...w, text: applyConfusions(w.text, confusions) }));
        return { ...line, words, text: words.map((w) => w.text).join(' ') };
      }),
    })),
  };
}

function applyConfusions(text: string, confusions: ReadonlyArray<[RegExp, string]>): string {
  return confusions.reduce((t, [from, to]) => t.replace(from, to), text);
}

function withoutLine(lines: string[], label: RegExp): string[] {
  return lines.filter((l) => !label.test(l));
}

// ------------------------------------------------------------ DRV Renteninformation

/** Expected figures of {@link syntheticDrvRenteninformation} (variant `valid`/`scanned`). */
export const DRV_EXPECTED = {
  identifier: '12 010190 A 123',
  statementDate: '2026-03-15',
  payoutStart: '2057-03-01',
  dataPeriodFrom: '1998-01-01',
  dataPeriodTo: '2025-12-31',
  fullDisabilityMonthly: '1320.00',
  accruedMonthly: '1140.00',
  projectedMonthly: '1980.50',
  projectedAt1Pct: '2410.40',
  projectedAt2Pct: '2950.75',
  earningsPoints: '28.5000',
  currentPensionValue: '40.00',
  contributionsOwn: '41230.55',
  contributionsEmployer: '41230.55',
  contributionsPublic: '3120.00',
} as const;

function drvLines(): string[] {
  return [
    'Deutsche Rentenversicherung',
    'Renteninformation',
    ...PERSONAL_LINES,
    'Datum: 15.03.2026',
    'Versicherungsnummer: 12 010190 A 123',
    'Grundlage dieser Renteninformation sind die gespeicherten Daten vom 01.01.1998 bis 31.12.2025.',
    'Ihre Regelaltersgrenze erreichen Sie am 01.03.2057.',
    'Ihre Rente wegen voller Erwerbsminderung beträgt monatlich 1.320,00 Euro',
    'Ihre bisher erreichte Rentenanwartschaft beträgt monatlich 1.140,00 Euro',
    'Entgeltpunkte 28,5000',
    'Aktueller Rentenwert 40,00 Euro',
    'Ihre Regelaltersrente beträgt ohne weitere Rentenanpassung monatlich 1.980,50 Euro',
    'Bei jährlicher Rentenanpassung von 1 % beträgt sie 2.410,40 Euro',
    'Bei jährlicher Rentenanpassung von 2 % beträgt sie 2.950,75 Euro',
    'Beiträge von Ihnen 41.230,55 Euro',
    'Beiträge von Arbeitgebern 41.230,55 Euro',
    'Beiträge von öffentlichen Kassen 3.120,00 Euro',
  ];
}

/** DRV "Renteninformation" (statutory pension) — the real sample is a scan, hence `scanned`. */
export function syntheticDrvRenteninformation(
  variant: StatementVariant = 'valid',
): PdfDocumentText {
  let lines = drvLines();
  if (variant === 'misread') {
    // transposed digits: points × value no longer equals the accrued pension (never "healed")
    lines = lines.map((l) => l.replace('1.140,00', '1.410,00'));
  }
  if (variant === 'missing-label') lines = withoutLine(lines, /ohne weitere Rentenanpassung/);
  const doc = textDocument([lines]);
  return variant === 'scanned'
    ? asScan(doc, [
        [/^1\.140,00$/, '1.14O,OO'],
        [/^1\.320,00$/, '1.32O,OO'],
      ])
    : doc;
}

// ------------------------------------------------------------ private / Riester statement

export const PRIVATE_EXPECTED = {
  providerLabel: 'Musterleben Versicherung AG',
  identifier: 'RV-48211593',
  statementDate: '2025-12-31',
  payoutStart: '2057-03-01',
  guaranteedMonthly: '100.00',
  guaranteedCapital: '28000.00',
  scenarioMonthly: { '0': '110.00', '3': '150.00', '6': '200.00', '9': '260.00' },
  currentValue: '9000.00',
  contributionsMain: '9000.00',
  contributionsExtra: '1000.00',
  contributionsPaid: '10000.00',
  surrenderValue: '8500.00',
  deathBenefit: '9000.00',
  guaranteePeriodYears: 10,
} as const;

function privateLines(riester: boolean): string[] {
  return [
    'Musterleben Versicherung AG',
    riester
      ? 'Jährliche Unterrichtung nach § 155 VVG – Altersvorsorgevertrag (Riester-Rente)'
      : 'Jährliche Unterrichtung nach § 155 VVG – Private Rentenversicherung',
    ...PERSONAL_LINES,
    'Versicherer: Musterleben Versicherung AG',
    'Versicherungsschein-Nr.: RV-48211593',
    'Stand: 31.12.2025',
    'Beginn der Rentenzahlung: 01.03.2057',
    'Garantierte monatliche Rente 100,00 Euro',
    'Garantiertes Kapital zu Rentenbeginn 28.000,00 Euro',
    'Wertentwicklung 0 % 3 % 6 % 9 %',
    'Voraussichtliche monatliche Rente 110,00 150,00 200,00 260,00',
    'Aktueller Vertragswert 9.000,00 Euro',
    'Rückkaufswert 8.500,00 Euro',
    'Todesfallleistung 9.000,00 Euro',
    'Eingezahlte Beiträge 9.000,00 Euro',
    'Zuzahlungen 1.000,00 Euro',
    'Summe aller bisherigen Einzahlungen 10.000,00 Euro',
    'Rentengarantiezeit 10 Jahre',
  ];
}

/** Annual statement (§ 155 VVG) of a Riester (`riester`, default) or private pension contract. */
export function syntheticPrivateStatement(
  variant: StatementVariant = 'valid',
  riester = true,
): PdfDocumentText {
  let lines = privateLines(riester);
  if (variant === 'misread') {
    // the 6 % scenario drops below the 3 % scenario
    lines = lines.map((l) => l.replace('150,00 200,00 260,00', '150,00 140,00 260,00'));
  }
  if (variant === 'missing-label') lines = withoutLine(lines, /^Stand:/);
  const doc = textDocument([lines]);
  return variant === 'scanned'
    ? asScan(doc, [
        [/^100,00$/, '1OO,OO'],
        [/^9\.000,00$/, '9.OOO,OO'],
      ])
    : doc;
}

// ------------------------------------------------------------ employer capital account

export const CAPITAL_ACCOUNT_EXPECTED = {
  providerLabel: 'Brightline Software GmbH',
  identifier: 'VK-20931',
  statementDate: '2025-12-31',
  openingBalance: '10000.00',
  interestCredit: '125.00',
  annualContribution: '1200.00',
  accountBalance: '11325.00',
  guaranteedInterestRate: '1.2500',
  finalBonus: '900.00',
} as const;

function capitalAccountLines(): string[] {
  return [
    'Kontoauszug betriebliche Altersversorgung – Kapitalkonto',
    ...PERSONAL_LINES,
    'Arbeitgeber: Brightline Software GmbH',
    'Versorgungsnummer: VK-20931',
    'Stand: 31.12.2025',
    'Kontostand zu Jahresbeginn 10.000,00 Euro',
    'Zinsgutschrift 125,00 Euro',
    'Beitragsgutschrift 1.200,00 Euro',
    'Kontostand zum Jahresende 11.325,00 Euro',
    'Garantiezins 1,25 %',
    'Hypothetischer Schlussbonus 900,00 Euro',
  ];
}

/** Statement of a contribution-oriented employer capital account (no monthly pension). */
export function syntheticCapitalAccountStatement(
  variant: StatementVariant = 'valid',
): PdfDocumentText {
  let lines = capitalAccountLines();
  if (variant === 'misread') {
    lines = lines.map((l) => l.replace('11.325,00', '11.525,00'));
  }
  if (variant === 'missing-label') lines = withoutLine(lines, /^Kontostand zum Jahresende/);
  const doc = textDocument([lines]);
  return variant === 'scanned'
    ? asScan(doc, [
        [/^10\.000,00$/, '1O.OOO,OO'],
        [/^11\.325,00$/, '11.325,OO'],
      ])
    : doc;
}

/** A document no parser knows (an unrelated letter). */
export function syntheticUnrelatedDocument(): PdfDocumentText {
  return textDocument([
    [
      'Rechnung Nr. 2026-0042',
      'Bitte überweisen Sie 49,90 Euro bis zum 30.04.2026.',
      ...PERSONAL_LINES,
    ],
  ]);
}
