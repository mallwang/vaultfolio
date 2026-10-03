import { validateRecordInput, validateSupplement, validateSupplementPatch } from './validation';

const NOW = new Date('2026-10-03T12:00:00Z');

const statutory = (over: Record<string, unknown> = {}) => ({
  contractType: 'STATUTORY_PENSION',
  origin: 'MANUAL',
  status: 'ACTIVE',
  statementDate: '2026-05-01',
  payoutStart: '2056-03-01',
  figures: { projectedMonthly: '2100.50' },
  ...over,
});

const riester = (over: Record<string, unknown> = {}) => ({
  contractType: 'RIESTER',
  origin: 'MANUAL',
  status: 'ACTIVE',
  providerLabel: 'Muster Versicherung',
  statementDate: '2026-04-01',
  payoutStart: '2050-01-01',
  figures: { guaranteedMonthly: '120', expectedMonthly: '180.5' },
  ...over,
});

function issues(body: unknown): string[] {
  const result = validateRecordInput(body, { now: NOW });
  return result.ok ? [] : result.issues.map((i) => `${i.field}:${i.code}`);
}

describe('validateRecordInput', () => {
  it('accepts a statutory record and canonicalises amounts', () => {
    const result = validateRecordInput(statutory({ identifier: ' 12 345678 A 123 ' }), {
      now: NOW,
    });
    expect(result).toEqual({
      ok: true,
      value: {
        contractType: 'STATUTORY_PENSION',
        origin: 'MANUAL',
        status: 'ACTIVE',
        statementDate: '2026-05-01',
        payoutStart: '2056-03-01',
        identifier: '12 345678 A 123',
        figures: { projectedMonthly: '2100.50' },
      },
    });
  });

  it('accepts a Riester record and canonicalises "120" to "120.00"', () => {
    const result = validateRecordInput(riester(), { now: NOW });
    expect(result.ok && result.value.figures).toEqual({
      guaranteedMonthly: '120.00',
      expectedMonthly: '180.50',
    });
  });

  it('rejects unknown top-level and figure fields', () => {
    expect(issues(riester({ owner_id: 'x' }))).toEqual(['owner_id:UNKNOWN_FIELD']);
    expect(issues(riester({ figures: { guaranteedMonthly: '1', bogus: '2' } }))).toEqual([
      'figures.bogus:UNKNOWN_FIELD',
    ]);
  });

  it('rejects guaranteed figures on an Altersvorsorgedepot as not applicable', () => {
    const depot = {
      contractType: 'ALTERSVORSORGEDEPOT',
      origin: 'MANUAL',
      status: 'ACTIVE',
      providerLabel: 'Depotbank',
      statementDate: '2026-04-01',
      figures: { currentValue: '5000', guaranteedMonthly: '10' },
    };
    expect(issues(depot)).toEqual(['figures.guaranteedMonthly:UNKNOWN_FIELD']);
    expect(
      issues({ ...depot, figures: { currentValue: '5000', contributionMonthly: '100' } }),
    ).toEqual([]);
  });

  it('rejects fields of another type', () => {
    expect(issues(riester({ figures: { accountBalance: '100' } }))).toEqual([
      'figures.accountBalance:UNKNOWN_FIELD',
    ]);
    expect(issues(riester({ figures: { subsidiesYearly: '175' } }))).toEqual([]);
    expect(
      issues(
        riester({ contractType: 'PRIVATE_PENSION_INSURANCE', figures: { subsidiesYearly: '175' } }),
      ),
    ).toEqual(['figures.subsidiesYearly:UNKNOWN_FIELD']);
  });

  it('checks amounts: format, decimals, range', () => {
    expect(issues(riester({ figures: { guaranteedMonthly: '12,5' } }))).toEqual([
      'figures.guaranteedMonthly:INVALID_AMOUNT',
    ]);
    expect(issues(riester({ figures: { guaranteedMonthly: '1.234' } }))).toEqual([
      'figures.guaranteedMonthly:INVALID_AMOUNT',
    ]);
    expect(issues(riester({ figures: { guaranteedMonthly: '-1' } }))).toEqual([
      'figures.guaranteedMonthly:INVALID_AMOUNT',
    ]);
    expect(issues(riester({ figures: { guaranteedMonthly: 12 } }))).toEqual([
      'figures.guaranteedMonthly:INVALID_AMOUNT',
    ]);
    expect(issues(riester({ figures: { guaranteedMonthly: '100001' } }))).toEqual([
      'figures.guaranteedMonthly:OUT_OF_RANGE',
    ]);
    expect(issues(riester({ figures: { guaranteedCapital: '100000001' } }))).toEqual([
      'figures.guaranteedCapital:OUT_OF_RANGE',
    ]);
  });

  it('allows rates and earnings points with up to four decimals', () => {
    const account = {
      contractType: 'CAPITAL_ACCOUNT',
      origin: 'MANUAL',
      status: 'ACTIVE',
      providerLabel: 'Arbeitgeber GmbH',
      statementDate: '2026-04-01',
      figures: { accountBalance: '10000', guaranteedInterestRate: '1.2500' },
    };
    const ok = validateRecordInput(account, { now: NOW });
    expect(ok.ok && ok.value.figures).toEqual({
      accountBalance: '10000.00',
      guaranteedInterestRate: '1.25',
    });
    expect(
      issues({ ...account, figures: { accountBalance: '1', guaranteedInterestRate: '1.23456' } }),
    ).toEqual(['figures.guaranteedInterestRate:INVALID_AMOUNT']);
    expect(
      issues(statutory({ figures: { projectedMonthly: '1', earningsPoints: '35.1234' } })),
    ).toEqual([]);
    expect(
      issues(statutory({ figures: { projectedMonthly: '1', earningsPoints: '201' } })),
    ).toEqual(['figures.earningsPoints:OUT_OF_RANGE']);
  });

  it('checks dates', () => {
    expect(issues(riester({ statementDate: '2026-02-30' }))).toEqual([
      'statementDate:INVALID_DATE',
    ]);
    expect(issues(riester({ statementDate: '2026-10-04' }))).toEqual([
      'statementDate:OUT_OF_RANGE',
    ]);
    expect(issues(riester({ statementDate: '2026-10-03' }))).toEqual([]);
    expect(issues(riester({ payoutStart: '2025-03-31' }))).toEqual(['payoutStart:OUT_OF_RANGE']);
    expect(issues(riester({ payoutStart: '2025-04-01' }))).toEqual([]);
    expect(issues(riester({ payoutStart: '2106-04-02' }))).toEqual(['payoutStart:OUT_OF_RANGE']);
    expect(issues(riester({ payoutStart: 'soon' }))).toEqual(['payoutStart:INVALID_DATE']);
    expect(issues(riester({ statementDate: undefined }))).toEqual(['statementDate:REQUIRED']);
  });

  it('flags a guaranteed pension above the expected one', () => {
    expect(
      issues(riester({ figures: { guaranteedMonthly: '200', expectedMonthly: '150' } })),
    ).toEqual(['figures.guaranteedMonthly:GUARANTEE_ABOVE_EXPECTED']);
    expect(
      issues(riester({ figures: { guaranteedMonthly: '150', expectedMonthly: '150' } })),
    ).toEqual([]);
  });

  it('checks the identifier charset and length', () => {
    expect(issues(riester({ identifier: 'AB-12/34.5 6' }))).toEqual([]);
    expect(issues(riester({ identifier: 'AB;12' }))).toEqual(['identifier:INVALID_IDENTIFIER']);
    expect(issues(riester({ identifier: 'A'.repeat(41) }))).toEqual([
      'identifier:INVALID_IDENTIFIER',
    ]);
    expect(issues(riester({ identifier: 'A'.repeat(40) }))).toEqual([]);
  });

  it('requires the fields of each type incl. providerLabel', () => {
    expect(issues(statutory({ figures: {} }))).toEqual(['figures.projectedMonthly:REQUIRED']);
    expect(issues(statutory({ payoutStart: undefined }))).toEqual(['payoutStart:REQUIRED']);
    expect(issues(riester({ providerLabel: undefined }))).toEqual(['providerLabel:REQUIRED']);
    expect(issues(riester({ providerLabel: '   ' }))).toEqual(['providerLabel:REQUIRED']);
    expect(issues(riester({ providerLabel: 'x'.repeat(81) }))).toEqual([
      'providerLabel:OUT_OF_RANGE',
    ]);
    expect(issues(statutory({ providerLabel: 'DRV' }))).toEqual(['providerLabel:NOT_APPLICABLE']);
    expect(
      issues(riester({ contractType: 'CAPITAL_ACCOUNT', figures: { openingBalance: '1' } })),
    ).toEqual(['figures.accountBalance:REQUIRED']);
    expect(issues({})).toEqual([
      'contractType:REQUIRED',
      'origin:REQUIRED',
      'status:REQUIRED',
      'statementDate:REQUIRED',
      'figures:REQUIRED',
    ]);
  });

  it('keeps a statutory record ACTIVE', () => {
    expect(issues(statutory({ status: 'PAID_UP' }))).toEqual(['status:INVALID_VALUE']);
  });

  it('never throws and rejects non-objects', () => {
    for (const body of [null, 'x', 5, [], undefined]) {
      expect(validateRecordInput(body, { now: NOW }).ok).toBe(false);
    }
    expect(issues(riester({ figures: 'x' }))).toEqual(['figures:INVALID_VALUE']);
    expect(issues(riester({ contractType: 'NOPE' }))).toEqual(['contractType:INVALID_VALUE']);
  });

  describe('scenarios', () => {
    it('validates the printed scenario amounts', () => {
      const ok = validateRecordInput(
        riester({
          figures: { scenarioMonthly: { '0': '100', '3': '150.5', '6': '200', '9': '250' } },
        }),
        { now: NOW },
      );
      expect(ok.ok && ok.value.figures).toEqual({
        scenarioMonthly: { '0': '100.00', '3': '150.50', '6': '200.00', '9': '250.00' },
      });
      expect(issues(riester({ figures: { scenarioMonthly: { '4': '1' } } }))).toEqual([
        'figures.scenarioMonthly.4:UNKNOWN_FIELD',
      ]);
      expect(issues(riester({ figures: { scenarioMonthly: { '3': 'x' } } }))).toEqual([
        'figures.scenarioMonthly.3:INVALID_AMOUNT',
      ]);
    });
  });

  describe('origin', () => {
    const imported = (over: Record<string, unknown> = {}) =>
      riester({
        origin: 'IMPORTED',
        import: { parserId: 'private-statement', parserVersion: '1', ocrRead: false },
        figures: { guaranteedMonthly: '120', expectedMonthly: '180' },
        ...over,
      });

    it('accepts an imported record with a supplement', () => {
      const result = validateRecordInput(
        imported({ supplement: { contributionMonthly: '50', expectedScenario: '3' } }),
        { now: NOW },
      );
      expect(result.ok && result.value.supplement).toEqual({
        contributionMonthly: '50.00',
        expectedScenario: '3',
      });
    });

    it('requires import info for imports and forbids import-only fields on manual records', () => {
      expect(issues(imported({ import: undefined }))).toEqual(['import:REQUIRED']);
      expect(issues(riester({ supplement: {} }))).toEqual(['supplement:NOT_APPLICABLE']);
      expect(issues(riester({ import: {} }))).toEqual(['import:NOT_APPLICABLE']);
      expect(issues(riester({ replaces: 'abc' }))).toEqual(['replaces:NOT_APPLICABLE']);
    });

    it('keeps user-supplied contribution fields out of imported figures', () => {
      expect(issues(imported({ figures: { contributionMonthly: '50' } }))).toEqual([
        'figures.contributionMonthly:UNKNOWN_FIELD',
      ]);
    });

    it('checks the import info and the replaces id', () => {
      expect(
        issues(imported({ import: { parserId: 'Bad Id', parserVersion: '1', ocrRead: false } })),
      ).toEqual(['import.parserId:INVALID_VALUE']);
      expect(
        issues(imported({ import: { parserId: 'a', parserVersion: '1', ocrRead: 'no' } })),
      ).toEqual(['import.ocrRead:INVALID_VALUE']);
      expect(
        issues(imported({ import: { parserId: 'a', parserVersion: '1', ocrRead: true, x: 1 } })),
      ).toEqual(['import.x:UNKNOWN_FIELD']);
      expect(issues(imported({ replaces: 'a/b' }))).toEqual(['replaces:INVALID_VALUE']);
      expect(issues(imported({ replaces: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' }))).toEqual([]);
    });

    it('rejects supplement fields that do not apply to the type', () => {
      expect(issues(imported({ supplement: { employerContributionMonthly: '10' } }))).toEqual([
        'supplement.employerContributionMonthly:UNKNOWN_FIELD',
      ]);
      expect(issues(imported({ supplement: { expectedScenario: '5' } }))).toEqual([
        'supplement.expectedScenario:INVALID_VALUE',
      ]);
    });
  });
});

describe('validateSupplement', () => {
  it('whitelists the supplement per type', () => {
    expect(
      validateSupplement('RIESTER', { subsidiesYearly: '175', contributionMonthly: '30' }),
    ).toEqual({
      ok: true,
      value: { subsidiesYearly: '175.00', contributionMonthly: '30.00' },
    });
    expect(validateSupplement('PENSIONSKASSE', { subsidiesYearly: '175' })).toEqual({
      ok: false,
      issues: [{ field: 'subsidiesYearly', code: 'UNKNOWN_FIELD' }],
    });
    expect(validateSupplement('CAPITAL_ACCOUNT', { expectedMonthly: '90' }).ok).toBe(true);
    expect(validateSupplement('STATUTORY_PENSION', { contributionMonthly: '1' }).ok).toBe(false);
    expect(validateSupplement('ALTERSVORSORGEDEPOT', {}).ok).toBe(true);
    expect(validateSupplement('RIESTER', 5).ok).toBe(false);
  });
});

describe('validateSupplementPatch', () => {
  it('accepts supplement fields and a status', () => {
    expect(
      validateSupplementPatch('RIESTER', { contributionMonthly: '30', status: 'PAID_UP' }),
    ).toEqual({
      ok: true,
      value: { contributionMonthly: '30.00', status: 'PAID_UP' },
    });
  });

  it('rejects an invalid status, unknown fields and figures', () => {
    expect(validateSupplementPatch('RIESTER', { status: 'GONE' })).toEqual({
      ok: false,
      issues: [{ field: 'status', code: 'INVALID_VALUE' }],
    });
    expect(validateSupplementPatch('RIESTER', { guaranteedMonthly: '1' }).ok).toBe(false);
    expect(validateSupplementPatch('RIESTER', null).ok).toBe(false);
  });
});
