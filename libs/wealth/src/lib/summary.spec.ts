import type { WealthSnapshot } from './model';
import {
  changesOf,
  copyTemplateOf,
  filterPeriod,
  latestOf,
  seriesOf,
  sortedByDate,
  totalsOf,
} from './summary';
import { buildEntry, buildSnapshot } from './testing/builders';

const snap = (id: string, snapshotDate: string, assets: string[], liabilities: string[] = []) =>
  buildSnapshot({
    id,
    snapshotDate,
    entries: [
      ...assets.map((amount) => buildEntry({ amount })),
      ...liabilities.map((amount) =>
        buildEntry({ side: 'LIABILITY', class: { standard: 'loan' }, name: 'Kredit', amount }),
      ),
    ],
  });

describe('totalsOf', () => {
  it('sums exactly (0.1 + 0.2)', () => {
    expect(totalsOf(snap('a', '2025-01-01', ['0.10', '0.20']))).toEqual({
      assets: '0.30',
      liabilities: '0.00',
      net: '0.30',
    });
  });

  it('handles a negative net worth', () => {
    expect(totalsOf(snap('a', '2025-01-01', ['100.00'], ['350.25']))).toEqual({
      assets: '100.00',
      liabilities: '350.25',
      net: '-250.25',
    });
  });

  it('handles large values and duplicate name+class (both summed)', () => {
    const s = buildSnapshot({
      entries: [
        buildEntry({ amount: '999999999999.99' }),
        buildEntry({ amount: '999999999999.99' }),
      ],
    });
    expect(totalsOf(s).assets).toBe('1999999999999.98');
  });

  it('is zero for no entries of a side', () => {
    expect(totalsOf({ entries: [] })).toEqual({ assets: '0.00', liabilities: '0.00', net: '0.00' });
  });
});

describe('sortedByDate / filterPeriod', () => {
  const all = [
    snap('c', '2025-06-30', ['3.00']),
    snap('a', '2021-06-30', ['1.00']),
    snap('b', '2024-06-30', ['2.00']),
    snap('d', '2024-06-29', ['2.00']),
  ];

  it('orders chronologically regardless of input order without mutating it', () => {
    expect(sortedByDate(all).map((s) => s.id)).toEqual(['a', 'd', 'b', 'c']);
    expect(all[0].id).toBe('c');
  });

  it('filters back from the latest snapshot date', () => {
    expect(filterPeriod(all, 'all').map((s) => s.id)).toEqual(['a', 'd', 'b', 'c']);
    expect(filterPeriod(all, '1y').map((s) => s.id)).toEqual(['b', 'c']);
    expect(filterPeriod(all, '3y').map((s) => s.id)).toEqual(['d', 'b', 'c']);
  });

  it('includes the snapshot exactly one year back and clamps leap days', () => {
    const s = [snap('x', '2024-02-28', ['1.00']), snap('y', '2025-02-28', ['1.00'])];
    expect(filterPeriod(s, '1y')).toHaveLength(2);
    const leap = [snap('x', '2023-02-28', ['1.00']), snap('y', '2024-02-29', ['1.00'])];
    expect(filterPeriod(leap, '1y')).toHaveLength(2);
  });

  it('returns an empty list for no snapshots', () => {
    expect(filterPeriod([], '1y')).toEqual([]);
  });
});

describe('seriesOf', () => {
  it('zero-fills classes that are absent in a snapshot and orders by date', () => {
    const s1 = buildSnapshot({
      id: '1',
      snapshotDate: '2025-02-01',
      entries: [
        buildEntry({ amount: '10.00' }),
        buildEntry({ class: { standard: 'crypto' }, amount: '5.00' }),
        buildEntry({ side: 'LIABILITY', class: { standard: 'mortgage' }, amount: '4.00' }),
      ],
    });
    const s0 = buildSnapshot({
      id: '0',
      snapshotDate: '2025-01-01',
      entries: [buildEntry({ amount: '1.00' })],
    });
    const series = seriesOf([s1, s0]);
    expect(series.dates).toEqual(['2025-01-01', '2025-02-01']);
    expect(series.assets).toEqual(['1.00', '15.00']);
    expect(series.liabilities).toEqual(['0.00', '4.00']);
    expect(series.net).toEqual(['1.00', '11.00']);
    expect(series.byClass['ASSET:std:cash']).toEqual(['1.00', '10.00']);
    expect(series.byClass['ASSET:std:crypto']).toEqual(['0.00', '5.00']);
    expect(series.byClass['LIABILITY:std:mortgage']).toEqual(['0.00', '4.00']);
  });

  it('merges custom labels that differ only in case and keeps both sides apart', () => {
    const s = buildSnapshot({
      entries: [
        buildEntry({ class: { custom: 'Whisky' }, amount: '2.00' }),
        buildEntry({ class: { custom: ' whisky ' }, amount: '3.00' }),
        buildEntry({ side: 'LIABILITY', class: { custom: 'Whisky' }, amount: '1.00' }),
      ],
    });
    const { byClass } = seriesOf([s]);
    expect(byClass['ASSET:custom:whisky']).toEqual(['5.00']);
    expect(byClass['LIABILITY:custom:whisky']).toEqual(['1.00']);
  });
});

describe('changesOf', () => {
  it('has no delta for the first snapshot and computes exact percent against a positive previous net', () => {
    const changes = changesOf([
      snap('b', '2025-02-01', ['110.00']),
      snap('a', '2025-01-01', ['100.00']),
      snap('c', '2025-03-01', ['99.00']),
    ]);
    expect(changes).toMatchObject([
      { id: 'a', delta: null, pct: null, ratio: null },
      { id: 'b', delta: '10.00', pct: '10.00', ratio: '0.1000' },
      { id: 'c', delta: '-11.00', pct: '-10.00', ratio: '-0.1000' },
    ]);
  });

  it('annualises the change over the days between the two snapshots', () => {
    const changes = changesOf([
      snap('a', '2025-01-01', ['100.00']),
      snap('b', '2026-01-01', ['110.00']),
      snap('c', '2026-07-02', ['110.00']),
    ]);
    expect(changes[0].pctPerYear).toBeNull();
    expect(changes[1].pctPerYear).toBe('10.00');
    expect(changes[1].ratioPerYear).toBe('0.1000');
    expect(changes[0].ratioPerYear).toBeNull();
    expect(changes[2].pctPerYear).toBe('0.00');
    const [, halfYear] = changesOf([
      snap('x', '2025-01-01', ['100.00']),
      snap('y', '2025-07-02', ['110.00']),
    ]);
    // 182 days: 1.1^(365/182) − 1 ≈ 21.05 %
    expect(Number(halfYear.pctPerYear)).toBeCloseTo(21.05, 1);
  });

  it('has no annual figure when the net worth is not positive', () => {
    const [, second] = changesOf([
      snap('a', '2025-01-01', ['100.00']),
      snap('b', '2026-01-01', [], ['5.00']),
    ]);
    expect(second.pctPerYear).toBeNull();
  });

  it('rounds the percent to two decimals', () => {
    const [, second] = changesOf([
      snap('a', '2025-01-01', ['3.00']),
      snap('b', '2025-02-01', ['4.00']),
    ]);
    expect(second.pct).toBe('33.33');
  });

  it('gives pct null when the previous net worth is zero or negative', () => {
    const changes = changesOf([
      snap('a', '2025-01-01', [], ['50.00']),
      snap('b', '2025-02-01', ['10.00']),
      snap('c', '2025-03-01', ['20.00']),
    ]);
    expect(changes[1]).toMatchObject({ id: 'b', delta: '60.00', pct: null, ratio: null });
    expect(changes[2]).toMatchObject({ id: 'c', delta: '10.00', pct: '100.00', ratio: '1.0000' });
    const zero = changesOf([
      buildSnapshot({ id: 'z', entries: [buildEntry({ amount: '0.00' })] }),
      snap('n', '2026-01-01', ['5.00']),
    ]);
    expect(zero[1].pct).toBeNull();
  });

  it('is empty for no snapshots', () => {
    expect(changesOf([])).toEqual([]);
  });
});

describe('latestOf', () => {
  it('returns the newest snapshot with totals and its change', () => {
    const latest = latestOf([
      snap('b', '2025-02-01', ['120.00']),
      snap('a', '2025-01-01', ['100.00']),
    ]);
    expect(latest?.snapshot.id).toBe('b');
    expect(latest?.totals.net).toBe('120.00');
    expect(latest?.change).toMatchObject({
      id: 'b',
      delta: '20.00',
      pct: '20.00',
      ratio: '0.2000',
    });
  });

  it('is null without snapshots', () => {
    expect(latestOf([])).toBeNull();
  });
});

describe('copyTemplateOf', () => {
  it('keeps names, sides and classes and blanks the amounts without aliasing the source', () => {
    const source: WealthSnapshot = buildSnapshot({
      entries: [
        buildEntry({ name: 'Depot', class: { standard: 'securities' }, amount: '10.00' }),
        buildEntry({ name: 'Wein', class: { custom: 'Wein' }, amount: '5.00' }),
        buildEntry({
          side: 'LIABILITY',
          class: { standard: 'mortgage' },
          name: 'Haus',
          amount: '1.00',
        }),
      ],
    });
    const copy = copyTemplateOf(source);
    expect(copy).toEqual([
      { side: 'ASSET', class: { standard: 'securities' }, name: 'Depot', amount: '' },
      { side: 'ASSET', class: { custom: 'Wein' }, name: 'Wein', amount: '' },
      { side: 'LIABILITY', class: { standard: 'mortgage' }, name: 'Haus', amount: '' },
    ]);
    expect(copy[0].class).not.toBe(source.entries[0].class);
    expect(source.entries[0].amount).toBe('10.00');
  });
});
