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

/** Line layout of the Renteninformation since 2024 (amounts in a right-hand column, page 2 text). */
export function syntheticDrvRenteninformation2024(): PdfDocumentText {
  return textDocument([
    [
      'Versicherungsnummer, Kennzeichen',
      '12 010190 A 123, 4724, (000-00)',
      'Datum 10.05.2024',
      'Ihre Renteninformation',
      'in dieser Renteninformation haben wir die für Sie vom 01.09.2004 bis zum 31.12.2023 gespeicherten',
      'Daten und das geltende Rentenrecht berücksichtigt. Ihre Regelaltersrente würde am 01.05.2057',
      'Rente wegen voller Erwerbsminderung',
      'Wären Sie heute wegen gesundheitlicher Einschränkungen voll',
      'erwerbsgemindert, bekämen Sie von uns eine monatliche Rente von: 1.876,72 EUR',
      'Höhe Ihrer künftigen Regelaltersrente',
      'Ihre bislang erreichte Rentenanwartschaft entspräche nach heutigem Stand',
      'einer monatlichen Rente von: 636,18 EUR',
      'Sollten bis zum Rentenbeginn Beiträge wie im Durchschnitt der letzten fünf',
      'Rentenanpassungen von uns eine monatliche Rente von: 2.734,46 EUR',
      'Aufgrund zukünftiger Rentenanpassungen kann die errechnete Rente in Höhe von 2.734,46 EUR',
      'für Sie gerechnet. Beträgt der jährliche Anpassungssatz 1 Prozent, so ergäbe sich eine',
      'monatliche Rente von etwa 3.790 EUR. Bei einem jährlichen Anpassungssatz von 2 Prozent ergäbe',
      'sich eine monatliche Rente von etwa 5.250 EUR.',
    ],
    [
      'Grundlagen der Rentenberechnung',
      'Versicherten (zurzeit 45.358 EUR) erzielt haben. Daneben können Ihnen aber auch',
      'Entgeltpunkte für bestimmte Zeiten gutgeschrieben werden, in denen keine Beiträge (z.B. für',
      'Rente zu ermitteln, werden alle Entgeltpunkte zusammengezählt und mit dem so genannten',
      'aktuellen Rentenwert vervielfältigt. Der aktuelle Rentenwert beträgt zurzeit 37,60 EUR.',
      'Von Ihnen 58.492,35 EUR',
      'Von Ihrem/n Arbeitgeber/n 58.531,76 EUR',
      'Von öffentlichen Kassen (z.B. Krankenkasse, Agentur für Arbeit) 3.226,00 EUR',
      'Versicherungszeiten haben Sie bisher insgesamt Entgeltpunkte in',
      'folgender Höhe erworben: 16,9196',
    ],
  ]);
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

/** Standardised "Standmitteilung" layout of a Riester insurer (invented provider, figures, contract). */
export function syntheticStandmitteilung(): PdfDocumentText {
  return textDocument([
    [
      'Musterleben Lebensversicherung a. G.',
      'Standmitteilung für Ihre Musterleben FörderRente 11 222 333',
      'Sehr geehrte Frau Musterfrau,',
    ],
    [
      'Standmitteilung zum 01.04.2024',
      'für Versicherung 11 222 333',
      'Garantierte Todesfallleistung 4.000,00 EUR',
      'Derzeitige Todesfallleistung 4.100,00 EUR',
      'Garantierte Leistung bei Kündigung 3.500,00 EUR',
      'Derzeitige Leistung bei Kündigung 3.600,00 EUR',
      'Garantiertes Rentenkapital zum 01.04.2057 68.000,00 EUR',
      'oder garantierte Rente zum 01.04.2057 171,00 EUR',
      'Garantiertes Rentenkapital zum 01.04.2057 bei zum Stichtag angenommener',
      'Beitragsfreistellung 4.500,00 EUR',
      'oder garantierte Rente zum 01.04.2057 bei zum Stichtag angenommener',
      'Beitragsfreistellung 11,00 EUR',
      'Konventionelles Deckungskapital 3.800,00 EUR',
      'Eingezahlte Beiträge bis zum 01.04.2024',
      'Summe der gezahlten Beiträge 3.800,00 EUR',
      'davon Summe der gezahlten Beiträge für die Hauptversicherung 3.800,00 EUR',
      'Summe der bereits geleisteten Zuzahlungen 500,00 EUR',
      'Insgesamt gezahlte Beiträge plus Zuzahlungen 4.300,00 EUR',
    ],
    [
      'Fondsbestand zum 01.04.2024',
      'Gesamtwert des Fondsbestands 400,00',
      'Mögliches Rentenkapital in EUR bei einer angenommenen Wertentwicklung',
      '0% 3% 6% 9%',
      '01.04.2057 Vereinbarter Rentenbeginn 68.000,00 102.000,00 185.000,00 358.000,00',
      'Mögliche Gesamtrente in EUR bei einer angenommenen Wertentwicklung von',
      '0% 3% 6% 9%',
      '01.04.2057 Vereinbarter Rentenbeginn 233,00 350,00 637,00 1.230,00',
      'Wird der Rentenbeginn zu einem anderen Termin wahrgenommen, ergeben sich andere Werte.',
      'Die angegebenen Renten sind mit folgenden Rentengarantiezeiten berechnet:',
      'Vereinbarter Rentenbeginn 23 Jahre',
    ],
  ]);
}

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

/** Account statement of a contribution-oriented company pension as printed since 2019 (invented data). */
export function syntheticCapitalAccountStatement2019(): PdfDocumentText {
  return textDocument([
    [
      'Musterkonzern AG, HR Service, Postfach 1, 12345 Musterstadt',
      'Datum 21.01.2019',
      'Dieser Kontoauszug weist Ihre Versorgungsanwartschaft gegenüber der Beispiel GmbH aus.',
      'Kontoauszug zum 01. Januar 2019',
      'Kontostand (01. Januar 2018) 2.000,00',
      'Garantiezins (1,00%) für Kalenderjahr 2018 (nachschüssig) 20,00',
      'Beitrag gemäß Beitragsgruppe für Geschäftsjahr 2017/2018 1.000,00',
      'Kontozuführung aus Beitrag 1.000,00',
      'Stand des Versorgungskontos (01. Januar 2019) 3.020,00',
      'Schlussüberschuss-Gutschrift (für unterstellten Versorgungsfall im Januar 2019) 3 0,00',
    ],
  ]);
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
