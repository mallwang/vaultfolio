import {
  STANDARD_CLASSES,
  classKey,
  defaultGroupOf,
  groupsOf,
  isStandardClassId,
  matchStandardByLabel,
  otherGroupOf,
  sideOfStandard,
  suggestionsOf,
} from './classes';
import type { StandardClassId } from './model';
import { buildEntry, buildSnapshot } from './testing/builders';

const de: Record<string, string> = {
  cash: 'Bargeld',
  bankBalances: 'Bankguthaben',
  crypto: 'Krypto',
  mortgage: 'Immobilienkredit',
};
const translate = (id: StandardClassId) => de[id] ?? id;

describe('standard classes and groups', () => {
  it('has the documented defaults and every default belongs to its own side', () => {
    expect(defaultGroupOf('cash')).toBe('LIQUID');
    expect(defaultGroupOf('crypto')).toBe('SECURITIES');
    expect(defaultGroupOf('realEstate')).toBe('TANGIBLE');
    expect(defaultGroupOf('otherAsset')).toBe('OTHER_ASSET');
    expect(defaultGroupOf('mortgage')).toBe('LONG_TERM');
    expect(defaultGroupOf('otherDebt')).toBe('SHORT_TERM');
    for (const side of ['ASSET', 'LIABILITY'] as const) {
      for (const id of STANDARD_CLASSES[side]) {
        expect(sideOfStandard(id)).toBe(side);
        expect(groupsOf(side)).toContain(defaultGroupOf(id));
      }
    }
    expect(otherGroupOf('ASSET')).toBe('OTHER_ASSET');
    expect(otherGroupOf('LIABILITY')).toBe('OTHER_LIABILITY');
  });

  it('recognizes standard ids only', () => {
    expect(isStandardClassId('cash')).toBe(true);
    expect(isStandardClassId('Bargeld')).toBe(false);
    expect(isStandardClassId(1)).toBe(false);
  });
});

describe('classKey', () => {
  it('normalizes trim, case and unicode form', () => {
    expect(classKey('ASSET', { custom: ' Whisky ' })).toBe(classKey('ASSET', { custom: 'WHISKY' }));
    expect(classKey('ASSET', { custom: 'Café' })).toBe(classKey('ASSET', { custom: 'Café' }));
  });

  it('keeps the same text on both sides apart and standard apart from custom', () => {
    expect(classKey('ASSET', { custom: 'Auto' })).not.toBe(
      classKey('LIABILITY', { custom: 'Auto' }),
    );
    expect(classKey('ASSET', { standard: 'cash' })).not.toBe(classKey('ASSET', { custom: 'cash' }));
  });
});

describe('matchStandardByLabel', () => {
  it('matches the translated name case-insensitively on the given side only', () => {
    expect(matchStandardByLabel('ASSET', ' krypto ', translate)).toBe('crypto');
    expect(matchStandardByLabel('LIABILITY', 'Krypto', translate)).toBeNull();
    expect(matchStandardByLabel('LIABILITY', 'immobilienkredit', translate)).toBe('mortgage');
    expect(matchStandardByLabel('ASSET', 'Whisky', translate)).toBeNull();
    expect(matchStandardByLabel('ASSET', '  ', translate)).toBeNull();
  });
});

describe('suggestionsOf', () => {
  it('lists the standard classes then distinct custom labels per side', () => {
    const snapshots = [
      buildSnapshot({
        entries: [
          buildEntry({ class: { custom: 'Whisky' } }),
          buildEntry({ class: { custom: ' whisky ' } }),
          buildEntry({ class: { custom: 'Wein' } }),
          buildEntry({ side: 'LIABILITY', class: { custom: 'Privatdarlehen' } }),
        ],
      }),
    ];
    const assets = suggestionsOf('ASSET', snapshots);
    expect(assets.slice(0, STANDARD_CLASSES.ASSET.length)).toEqual(
      STANDARD_CLASSES.ASSET.map((standard) => ({ standard })),
    );
    expect(assets.slice(STANDARD_CLASSES.ASSET.length)).toEqual([
      { custom: 'Whisky' },
      { custom: 'Wein' },
    ]);
    expect(suggestionsOf('LIABILITY', snapshots).slice(-1)).toEqual([{ custom: 'Privatdarlehen' }]);
  });
});
