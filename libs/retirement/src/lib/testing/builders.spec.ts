import { runChecks } from '../checks';
import { CONTRACT_TYPES, pillarOf } from '../model';
import { validateRecordInput } from '../validation';
import { SAMPLE_FIGURES, buildRecord } from './builders';

describe('buildRecord', () => {
  it('builds a consistent record for every contract type', () => {
    for (const type of CONTRACT_TYPES) {
      const record = buildRecord({ contractType: type });
      expect(record.pillar).toBe(pillarOf(type));
      const checks = runChecks(type, record.figures, {
        statementDate: record.statementDate,
        payoutStart: record.payoutStart,
      });
      expect(checks.filter((c) => !c.ok)).toEqual([]);
      const result = validateRecordInput(
        {
          contractType: type,
          origin: 'MANUAL',
          status: record.status,
          statementDate: record.statementDate,
          payoutStart: record.payoutStart ?? undefined,
          providerLabel: record.providerLabel ?? undefined,
          figures: record.figures,
        },
        { now: new Date('2026-10-03T00:00:00Z') },
      );
      expect(result).toMatchObject({ ok: true });
    }
  });

  it('applies overrides', () => {
    expect(buildRecord({ id: 'x', origin: 'IMPORTED' })).toMatchObject({
      id: 'x',
      origin: 'IMPORTED',
    });
    expect(Object.keys(SAMPLE_FIGURES)).toHaveLength(CONTRACT_TYPES.length);
  });
});
