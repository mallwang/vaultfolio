import type { EmployerRef, StoredCertificate, StoredRecord } from '../model';
import { emptyCertificateAmounts } from '../model';
import { storedRecord } from './builders';

/**
 * Aggregation fixture with INVENTED figures (see ./README.md "aggregation.fixtures.ts" for every
 * hand-computed expected value):
 *
 * - Employer A "Northwind Instruments AG" (emp-a): 2024-10..2024-12, gross 4000.00/month,
 *   December adds a 1000.00 bonus.
 * - Employer B "Brightline Software GmbH" (emp-b): 2025-01..2025-12 without March (a payout-only
 *   record sits in 2025-03), 2026-01..2026-09 (incomplete latest year of 9 months), a negative
 *   correction for 2026-07 issued with the September payslip.
 */
export const EMPLOYERS: EmployerRef[] = [
  { id: 'emp-a', label: 'Northwind Instruments AG' },
  { id: 'emp-b', label: 'Brightline Software GmbH' },
];

// A: gross 4000.00 − wage tax 600.00 − social (320.00 + 72.00 + 372.00 + 52.00 = 816.00) = 2584.00
const A_MONTH = {
  gross: '4000.00',
  taxGross: '4000.00',
  svGrossKv: '4000.00',
  svGrossRv: '4000.00',
  wageTax: '600.00',
  health: '320.00',
  care: '72.00',
  pension: '372.00',
  unemployment: '52.00',
  net: '2584.00',
  payout: '2584.00',
};

function a(period: string, overrides: Record<string, unknown> = {}): StoredRecord {
  return storedRecord({
    period,
    issued: period,
    employerId: 'emp-a',
    amounts: { ...A_MONTH, ...overrides },
  });
}

// B: builder default — gross 5000.00, wage tax 800.00, social 1020.00, net 3180.00
function b(period: string, overrides: Record<string, unknown> = {}): StoredRecord {
  return storedRecord({ period, issued: period, employerId: 'emp-b', amounts: overrides });
}

const B_2025_PERIODS = ['01', '02', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(
  (m) => `2025-${m}`,
);
const B_2026_PERIODS = ['01', '02', '03', '04', '05', '06', '07', '08', '09'].map(
  (m) => `2026-${m}`,
);

export const RECORDS: StoredRecord[] = [
  a('2024-10'),
  a('2024-11'),
  // Dec: + 1000.00 bonus → gross 5000.00; wage tax 900.00 (of which 300.00 one-off); net 3284.00
  a('2024-12', {
    gross: '5000.00',
    taxGross: '5000.00',
    wageTax: '900.00',
    net: '3284.00',
    payout: '3284.00',
    oneOff: { gross: '1000.00', taxGross: '1000.00', wageTax: '300.00' },
  }),
  ...B_2025_PERIODS.map((p) =>
    p === '2025-12'
      ? // printed year-to-date wage tax 8700.00 deliberately differs from the sum 8800.00
        b(p, {
          ytd: {
            taxGross: '55000.00',
            wageTax: '8700.00',
            soli: '0.00',
            churchTax: '0.00',
            health: '4400.00',
            care: '990.00',
            pension: '5115.00',
            unemployment: '715.00',
          },
        })
      : b(p),
  ),
  storedRecord({
    period: '2025-03',
    issued: '2025-03',
    kind: 'PAYOUT_ONLY',
    employerId: 'emp-b',
    amounts: {
      gross: '0.00',
      taxGross: '0.00',
      svGrossKv: '0.00',
      svGrossRv: '0.00',
      wageTax: '0.00',
      health: '0.00',
      care: '0.00',
      pension: '0.00',
      unemployment: '0.00',
      net: '0.00',
      other: '150.00',
      payout: '150.00',
    },
  }),
  ...B_2026_PERIODS.map((p) =>
    p === '2026-09'
      ? b(p, {
          ytd: {
            taxGross: '44900.00',
            wageTax: '7175.00',
            soli: '0.00',
            churchTax: '0.00',
            health: '3592.00',
            care: '808.20',
            pension: '4175.70',
            unemployment: '583.70',
          },
        })
      : b(p),
  ),
  // correction for Jul issued with Sep: gross −100.00, taxes −25.00, social −20.40, net −54.60
  storedRecord({
    period: '2026-07',
    issued: '2026-09',
    kind: 'CORRECTION',
    seq: 3,
    employerId: 'emp-b',
    amounts: {
      gross: '-100.00',
      taxGross: '-100.00',
      svGrossKv: '-100.00',
      svGrossRv: '-100.00',
      wageTax: '-25.00',
      health: '-8.00',
      care: '-1.80',
      pension: '-9.30',
      unemployment: '-1.30',
      net: '-54.60',
      other: '54.60',
      payout: null,
    },
  }),
];

/** Certificate 2025 for employer B, matching the payslip sums exactly. */
export const CERTIFICATES: StoredCertificate[] = [
  {
    id: 'cert-b-2025',
    importId: 'imp-cert',
    employerId: 'emp-b',
    year: 2025,
    amounts: {
      ...emptyCertificateAmounts(),
      grossWage: '55000.00',
      wageTax: '8800.00',
      pensionEmployee: '5115.00',
      pensionEmployer: '5115.00',
      health: '4400.00',
      care: '990.00',
      unemployment: '715.00',
    },
  },
];
