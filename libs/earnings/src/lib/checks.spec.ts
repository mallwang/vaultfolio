import {
  collectCheckFailures,
  EDITABLE_KEYS,
  editableKeys,
  evaluateChecks,
  groupPayslips,
  runPayoutCheck,
  runRecordChecks,
} from './checks';
import { payRecord } from './testing/builders';

describe('runRecordChecks', () => {
  it('passes a balanced record', () => {
    expect(runRecordChecks(payRecord())).toEqual([
      { code: 'NET', passed: true, difference: '0.00' },
    ]);
  });

  it('passes at exactly ±0.01', () => {
    expect(runRecordChecks(payRecord({ amounts: { net: '3180.01' } }))).toEqual([
      { code: 'NET', passed: true, difference: '0.01' },
    ]);
    expect(runRecordChecks(payRecord({ amounts: { net: '3179.99' } }))).toEqual([
      { code: 'NET', passed: true, difference: '-0.01' },
    ]);
  });

  it('fails at 0.02 with the signed difference', () => {
    expect(runRecordChecks(payRecord({ amounts: { net: '3180.02' } }))).toEqual([
      { code: 'NET', passed: false, difference: '0.02' },
    ]);
    expect(runRecordChecks(payRecord({ amounts: { net: '3167.60' } }))).toEqual([
      { code: 'NET', passed: false, difference: '-12.40' },
    ]);
  });

  it('handles negative correction amounts', () => {
    const correction = payRecord({
      kind: 'CORRECTION',
      period: '2026-07',
      seq: 3,
      amounts: {
        gross: '-120.00',
        wageTax: '-30.25',
        soli: '0.00',
        health: '-9.60',
        care: '-2.16',
        pension: '-11.16',
        unemployment: '-1.56',
        net: '-65.27',
        payout: null,
      },
    });
    expect(runRecordChecks(correction)).toEqual([
      { code: 'NET', passed: true, difference: '0.00' },
    ]);
  });

  it('uses the own share for voluntary health/care insurance', () => {
    // contribution 520.00/110.00, subsidy 260.00/55.00 → own share 260.00/55.00
    const voluntary = payRecord({
      amounts: {
        health: '260.00',
        care: '55.00',
        net: '3355.00',
        payout: '3355.00',
        employerSubsidy: { health: '260.00', care: '55.00' },
      },
    });
    expect(runRecordChecks(voluntary)[0]).toEqual({
      code: 'NET',
      passed: true,
      difference: '0.00',
    });
  });
});

describe('runPayoutCheck', () => {
  const regular = payRecord({ amounts: { other: '-50.00', payout: '3065.73' } });
  const correction = payRecord({
    kind: 'CORRECTION',
    period: '2026-07',
    seq: 3,
    amounts: {
      gross: '-120.00',
      wageTax: '-30.25',
      health: '-9.60',
      care: '-2.16',
      pension: '-11.16',
      unemployment: '-1.56',
      net: '-65.27',
      payout: null,
    },
  });

  it('sums net + other over a regular and a correction section', () => {
    // 3180.00 − 50.00 − 65.27 = 3064.73
    expect(runPayoutCheck([regular, correction])).toEqual({
      code: 'PAYOUT',
      passed: false,
      difference: '1.00',
    });
    const fixed = payRecord({ amounts: { other: '-50.00', payout: '3064.73' } });
    expect(runPayoutCheck([fixed, correction])).toEqual({
      code: 'PAYOUT',
      passed: true,
      difference: '0.00',
    });
  });

  it('passes when no section carries a payout', () => {
    expect(runPayoutCheck([correction])).toEqual({
      code: 'PAYOUT',
      passed: true,
      difference: '0.00',
    });
  });
});

describe('evaluateChecks', () => {
  it('attaches NET to every record and PAYOUT to the payout carrier', () => {
    const regular = payRecord({ amounts: { payout: '3180.00' } });
    const out = evaluateChecks([regular]);
    expect(out.failure).toBeNull();
    expect(out.perRecord).toEqual([
      [
        { code: 'NET', passed: true, difference: '0.00' },
        { code: 'PAYOUT', passed: true, difference: '0.00' },
      ],
    ]);
  });

  it('reports the first failing check with period and difference', () => {
    const off = payRecord({
      period: '2026-08',
      issued: '2026-08',
      amounts: { net: '3192.40', payout: '3192.40' },
    });
    expect(evaluateChecks([off]).failure).toEqual({
      code: 'CHECK_FAILED',
      params: { check: 'NET', period: '2026-08', difference: '12.40' },
    });
  });

  it('reports a failing payout per payslip', () => {
    const r = payRecord({ amounts: { payout: '3100.00' } });
    expect(evaluateChecks([r]).failure).toEqual({
      code: 'CHECK_FAILED',
      params: { check: 'PAYOUT', period: '2026-09', difference: '-80.00' },
    });
  });

  it('groups payslips by employer and issue month', () => {
    const a = payRecord({ issued: '2026-09' });
    const b = payRecord({ issued: '2026-09', period: '2026-07', kind: 'CORRECTION', seq: 3 });
    const c = payRecord({ issued: '2026-10', period: '2026-10' });
    expect(groupPayslips([a, b, c])).toEqual([[a, b], [c]]);
  });
});

describe('collectCheckFailures', () => {
  const NET_KEYS = [
    'gross',
    'wageTax',
    'soli',
    'churchTax',
    'health',
    'care',
    'pension',
    'unemployment',
    'net',
  ];

  it('returns [] for a passing file', () => {
    expect(collectCheckFailures([payRecord()])).toEqual([]);
  });

  it('returns one NET failure with the signed difference and the nine involved figures', () => {
    const off = payRecord({ amounts: { net: '3162.00', payout: '3162.00' } });
    expect(
      collectCheckFailures([payRecord({ period: '2026-08', issued: '2026-08' }), off]),
    ).toEqual([
      {
        check: 'NET',
        period: '2026-09',
        difference: '-18.00',
        recordIndexes: [1],
        involved: NET_KEYS.map((key) => ({ recordIndex: 1, key })),
      },
    ]);
  });

  it('returns a PAYOUT failure listing net and payout of every section carrying them', () => {
    const regular = payRecord({ amounts: { other: '-50.00', payout: '3065.73' } });
    const correction = payRecord({
      kind: 'CORRECTION',
      period: '2026-07',
      seq: 3,
      amounts: {
        gross: '-120.00',
        wageTax: '-30.25',
        health: '-9.60',
        care: '-2.16',
        pension: '-11.16',
        unemployment: '-1.56',
        net: '-65.27',
        payout: null,
      },
    });
    expect(collectCheckFailures([regular, correction])).toEqual([
      {
        check: 'PAYOUT',
        period: '2026-09',
        difference: '1.00',
        recordIndexes: [0, 1],
        involved: [
          { recordIndex: 0, key: 'net' },
          { recordIndex: 1, key: 'net' },
          { recordIndex: 0, key: 'payout' },
        ],
      },
    ]);
  });

  it('returns every failing check, not just the first', () => {
    const a = payRecord({
      period: '2026-08',
      issued: '2026-08',
      amounts: { net: '3192.40', payout: '3192.40' },
    });
    const b = payRecord({ amounts: { net: '3162.00', payout: '3162.00' } });
    expect(collectCheckFailures([a, b]).map((f) => [f.check, f.period, f.difference])).toEqual([
      ['NET', '2026-08', '12.40'],
      ['NET', '2026-09', '-18.00'],
    ]);
    // evaluateChecks keeps reporting only the first failure
    expect(evaluateChecks([a, b]).failure).toEqual({
      code: 'CHECK_FAILED',
      params: { check: 'NET', period: '2026-08', difference: '12.40' },
    });
  });
});

describe('editableKeys', () => {
  it('is empty for a passing file', () => {
    expect(editableKeys(collectCheckFailures([payRecord()]))).toEqual([]);
  });

  it('equals the involved figures without duplicates', () => {
    const off = payRecord({ amounts: { net: '3162.00', payout: '3180.00', other: '0.00' } });
    const failures = collectCheckFailures([off]);
    expect(failures.map((f) => f.check)).toEqual(['NET', 'PAYOUT']);
    const editable = editableKeys(failures);
    expect(editable).toHaveLength(10);
    expect(new Set(editable.map((e) => e.key))).toEqual(new Set(EDITABLE_KEYS));
  });

  it('never offers bases, other or year-to-date figures', () => {
    expect(EDITABLE_KEYS).not.toContain('taxGross');
    expect(EDITABLE_KEYS).not.toContain('other');
  });
});
