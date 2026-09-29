/**
 * Synthetic `earnings-export` v1 documents (contracts/earnings-export-v1.md) with INVENTED
 * figures, in integer cents as the companion tool writes them.
 */
export function validExport(): Record<string, unknown> {
  return {
    schema: 'earnings-export',
    version: 1,
    generated: '2026-09-27T11:37:49',
    records: [
      {
        employer: 'Deutsche Musterbank',
        period: '2013-11',
        issued: '2013-11',
        kind: 'regular',
        seq: 1,
        // 4000.00 − 600.00 − 30.00 − 48.00 − (330.00 + 41.00 + 378.00 + 60.00) = 2513.00
        amounts: {
          gross: 400000,
          tax_gross: 400000,
          sv_gross_kv: 400000,
          sv_gross_rv: 400000,
          wage_tax: 60000,
          soli: 3000,
          church_tax: 4800,
          health: 33000,
          care: 4100,
          pension: 37800,
          unemployment: 6000,
          net: 251300,
          other: -2000,
          payout: 249300,
        },
        one_off: { gross: 50000, wage_tax: 12000 },
        employer_share: { health_subsidy: 0, care_subsidy: 0 },
        ytd: { gross: 4400000, tax_gross: 4400000, wage_tax: 660000 },
      },
      {
        employer: 'Deutsche Musterbank',
        period: '2013-10',
        issued: '2013-11',
        kind: 'correction',
        seq: 2,
        // −22.07: wage tax −5.63, health −1.72 → net −14.72, moved to the regular month
        amounts: {
          gross: -2207,
          tax_gross: -2207,
          wage_tax: -563,
          health: -172,
          net: -1472,
          other: 1472,
          payout: null,
        },
      },
      {
        employer: 'Deutsche Musterbank',
        period: '2013-12',
        issued: '2013-12',
        kind: 'payout_only',
        seq: 1,
        amounts: { other: 15000, payout: 15000 },
      },
    ],
    certificates: [
      {
        employer: 'Deutsche Musterbank',
        year: 2013,
        amounts: {
          gross_wage: 4400000,
          wage_tax: 660000,
          pension_employee: 415800,
          multi_year_comp: 0,
        },
      },
    ],
  };
}

/** `count` balanced regular months starting 2005-01 — a full-career-sized export. */
export function largeExport(count: number): Record<string, unknown> {
  const records = Array.from({ length: count }, (_, i) => {
    const period = `${2005 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
    return {
      employer: 'Deutsche Musterbank',
      period,
      issued: period,
      kind: 'regular',
      seq: 1,
      amounts: {
        gross: 300000,
        tax_gross: 300000,
        wage_tax: 40000,
        health: 24000,
        net: 236000,
        payout: 236000,
      },
    };
  });
  return {
    schema: 'earnings-export',
    version: 1,
    generated: '2026-09-27T11:37:49',
    records,
    certificates: [],
  };
}
