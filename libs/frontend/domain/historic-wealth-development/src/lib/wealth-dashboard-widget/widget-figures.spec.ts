import type { WealthSnapshot } from '@vaultfolio/api-contract';
import { sparklinePoints, widgetFiguresOf } from './widget-figures';

const snap = (id: string, date: string, assets: string, liabilities = '0.00'): WealthSnapshot => ({
  id,
  snapshotDate: date,
  entries: [
    { side: 'ASSET', class: { standard: 'cash' }, name: 'x', amount: assets },
    { side: 'LIABILITY', class: { standard: 'loan' }, name: 'y', amount: liabilities },
  ],
  createdAt: '',
  updatedAt: '',
});

describe('widgetFiguresOf', () => {
  it('is empty without snapshots', () => {
    expect(widgetFiguresOf([]).kind).toBe('empty');
  });

  it('describes one snapshot without change or trend', () => {
    const f = widgetFiguresOf([snap('a', '2025-01-01', '100.00', '30.00')]);
    expect(f).toMatchObject({
      kind: 'single',
      net: '70.00',
      assets: '100.00',
      liabilities: '30.00',
    });
    expect(f.delta).toBeNull();
    expect(f.previousDate).toBeNull();
  });

  it('describes the latest of several snapshots with change versus the previous one', () => {
    const f = widgetFiguresOf([
      snap('c', '2025-03-01', '300.00'),
      snap('a', '2025-01-01', '100.00'),
      snap('b', '2025-02-01', '200.00'),
    ]);
    expect(f).toMatchObject({
      kind: 'trend',
      net: '300.00',
      date: '2025-03-01',
      delta: '100.00',
      pct: '50.00',
      previousDate: '2025-02-01',
      trend: [100, 200, 300],
    });
  });

  it('has no percent for a non-positive previous net worth and handles negative net worth', () => {
    const f = widgetFiguresOf([
      snap('a', '2025-01-01', '10.00', '50.00'),
      snap('b', '2025-02-01', '10.00', '30.00'),
    ]);
    expect(f.net).toBe('-20.00');
    expect(f.delta).toBe('20.00');
    expect(f.pct).toBeNull();
  });
});

describe('sparklinePoints', () => {
  it('scales into the box with the minimum at the bottom and maximum at the top', () => {
    expect(sparklinePoints([0, 10], 100, 20)).toBe('0.0,18.0 100.0,2.0');
  });

  it('draws a flat line in the middle and needs two values', () => {
    expect(sparklinePoints([5, 5, 5], 100, 20)).toBe('0.0,18.0 50.0,18.0 100.0,18.0');
    expect(sparklinePoints([5], 100, 20)).toBe('');
  });
});
