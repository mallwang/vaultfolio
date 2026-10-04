import { balanceSheetOf, effectiveGroup } from './balance-sheet';
import type { ClassGroupAssignment } from './model';
import { buildEntry, buildSnapshot } from './testing/builders';

describe('effectiveGroup', () => {
  it("prefers an assignment, then the standard default, then the side's other group", () => {
    const assignments: ClassGroupAssignment[] = [
      { side: 'ASSET', class: { custom: 'Whisky' }, group: 'TANGIBLE' },
      { side: 'ASSET', class: { standard: 'crypto' }, group: 'OTHER_ASSET' },
    ];
    expect(effectiveGroup('ASSET', { custom: ' whisky' }, assignments)).toBe('TANGIBLE');
    expect(effectiveGroup('ASSET', { standard: 'crypto' }, assignments)).toBe('OTHER_ASSET');
    expect(effectiveGroup('ASSET', { standard: 'cash' }, assignments)).toBe('LIQUID');
    expect(effectiveGroup('ASSET', { custom: 'Wein' }, assignments)).toBe('OTHER_ASSET');
    expect(effectiveGroup('LIABILITY', { custom: 'Whisky' }, assignments)).toBe('OTHER_LIABILITY');
  });
});

describe('balanceSheetOf', () => {
  const snapshot = buildSnapshot({
    entries: [
      buildEntry({ name: 'Giro', amount: '1000.10' }),
      buildEntry({ name: 'ETF', class: { standard: 'securities' }, amount: '5000.20' }),
      buildEntry({ name: 'Whisky', class: { custom: 'Whisky' }, amount: '300.00' }),
      buildEntry({
        side: 'LIABILITY',
        class: { standard: 'mortgage' },
        name: 'Haus',
        amount: '2000.00',
      }),
    ],
  });

  it('groups entries with sub-totals and puts equity on the passiva side', () => {
    const sheet = balanceSheetOf(snapshot, []);
    const by = (group: string) =>
      [...sheet.assets, ...sheet.liabilities].find((g) => g.group === group)!;
    expect(by('LIQUID').subtotal).toBe('1000.10');
    expect(by('SECURITIES').subtotal).toBe('5000.20');
    expect(by('OTHER_ASSET').entries.map((e) => e.name)).toEqual(['Whisky']);
    expect(by('TANGIBLE').entries).toEqual([]);
    expect(by('TANGIBLE').subtotal).toBe('0.00');
    expect(by('LONG_TERM').subtotal).toBe('2000.00');
    expect(sheet.equity).toBe('4300.30');
    expect(sheet.sumAssets).toBe('6300.30');
    expect(sheet.sumPassiva).toBe('6300.30');
  });

  it('moves a class when its group is reassigned, including a standard class', () => {
    const sheet = balanceSheetOf(snapshot, [
      { side: 'ASSET', class: { custom: 'Whisky' }, group: 'TANGIBLE' },
      { side: 'ASSET', class: { standard: 'securities' }, group: 'LIQUID' },
    ]);
    expect(sheet.assets.find((g) => g.group === 'TANGIBLE')!.subtotal).toBe('300.00');
    expect(sheet.assets.find((g) => g.group === 'LIQUID')!.subtotal).toBe('6000.30');
    expect(sheet.assets.find((g) => g.group === 'SECURITIES')!.subtotal).toBe('0.00');
  });

  it('allows negative equity and still balances', () => {
    const sheet = balanceSheetOf(
      buildSnapshot({
        entries: [
          buildEntry({ amount: '100.00' }),
          buildEntry({ side: 'LIABILITY', class: { standard: 'loan' }, amount: '350.50' }),
        ],
      }),
      [],
    );
    expect(sheet.equity).toBe('-250.50');
    expect(sheet.sumPassiva).toBe('100.00');
    expect(sheet.sumAssets).toBe(sheet.sumPassiva);
  });

  it.each([
    [[]],
    [[buildEntry({ amount: '0.10' }), buildEntry({ amount: '0.20' })]],
    [[buildEntry({ side: 'LIABILITY', class: { custom: 'X' }, amount: '9.99' })]],
    [
      [
        buildEntry({ amount: '123456789.01', class: { custom: 'A' } }),
        buildEntry({ side: 'LIABILITY', class: { standard: 'otherDebt' }, amount: '0.07' }),
        buildEntry({ side: 'LIABILITY', class: { standard: 'mortgage' }, amount: '5.55' }),
      ],
    ],
  ])('keeps assets equal to passiva (fixture %#)', (entries) => {
    const sheet = balanceSheetOf({ entries }, []);
    expect(sheet.sumAssets).toBe(sheet.sumPassiva);
  });

  it('keeps group order stable per side', () => {
    const sheet = balanceSheetOf({ entries: [] }, []);
    expect(sheet.assets.map((g) => g.group)).toEqual([
      'LIQUID',
      'SECURITIES',
      'TANGIBLE',
      'OTHER_ASSET',
    ]);
    expect(sheet.liabilities.map((g) => g.group)).toEqual([
      'SHORT_TERM',
      'LONG_TERM',
      'OTHER_LIABILITY',
    ]);
  });
});
