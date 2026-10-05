import { effectiveSocialLines, linkedLinesFromEarnings } from './social';

const rec = (period: string, h: string, oneOff?: string) => ({
  period,
  amounts: {
    health: h,
    care: '10.00',
    pension: '100.00',
    unemployment: '0.00',
    oneOff: oneOff ? { health: oneOff } : {},
  },
});

describe('social', () => {
  it('uses the latest period and sums its records', () => {
    const lines = linkedLinesFromEarnings([
      rec('2026-01', '100.00'),
      rec('2026-02', '120.00'),
      rec('2026-02', '30.00'),
    ]);
    expect(lines).toEqual([
      { kind: 'HEALTH', monthly: '150.00', period: '2026-02' },
      { kind: 'CARE', monthly: '20.00', period: '2026-02' },
      { kind: 'PENSION', monthly: '200.00', period: '2026-02' },
    ]);
  });

  it('subtracts the one-off part', () => {
    expect(linkedLinesFromEarnings([rec('2026-02', '150.00', '50.00')])[0].monthly).toBe('100.00');
  });

  it('omits kinds with a zero total and handles missing one-off', () => {
    const lines = linkedLinesFromEarnings([
      {
        period: '2026-03',
        amounts: { health: '0.00', care: '0.00', pension: '5.00', unemployment: '2.00' },
      },
    ]);
    expect(lines.map((l) => l.kind)).toEqual(['PENSION', 'UNEMPLOYMENT']);
  });

  it('returns nothing without records', () => {
    expect(linkedLinesFromEarnings([])).toEqual([]);
  });

  it('suppresses lines with an active manual contract of that kind', () => {
    const linked = [
      { kind: 'HEALTH' as const, monthly: '1.00', period: '2026-02' },
      { kind: 'CARE' as const, monthly: '1.00', period: '2026-02' },
    ];
    expect(effectiveSocialLines([{ type: 'STATUTORY_HEALTH', status: 'ACTIVE' }], linked)).toEqual([
      linked[1],
    ]);
    expect(
      effectiveSocialLines([{ type: 'STATUTORY_HEALTH', status: 'CANCELLED' }], linked),
    ).toEqual(linked);
  });
});
