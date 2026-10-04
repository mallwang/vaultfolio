import type { BalanceGroup, ClassRef, Side, StandardClassId, WealthSnapshot } from './model';

export const STANDARD_CLASSES: Record<Side, readonly StandardClassId[]> = {
  ASSET: [
    'cash',
    'bankBalances',
    'preciousMetals',
    'securities',
    'crypto',
    'realEstate',
    'vehicles',
    'collectibles',
    'otherAsset',
  ],
  LIABILITY: ['mortgage', 'loan', 'otherDebt'],
};

const GROUPS: Record<Side, readonly BalanceGroup[]> = {
  ASSET: ['LIQUID', 'SECURITIES', 'TANGIBLE', 'OTHER_ASSET'],
  LIABILITY: ['SHORT_TERM', 'LONG_TERM', 'OTHER_LIABILITY'],
};

const DEFAULT_GROUPS: Record<StandardClassId, BalanceGroup> = {
  cash: 'LIQUID',
  bankBalances: 'LIQUID',
  securities: 'SECURITIES',
  crypto: 'SECURITIES',
  preciousMetals: 'TANGIBLE',
  realEstate: 'TANGIBLE',
  vehicles: 'TANGIBLE',
  collectibles: 'TANGIBLE',
  otherAsset: 'OTHER_ASSET',
  mortgage: 'LONG_TERM',
  loan: 'LONG_TERM',
  otherDebt: 'SHORT_TERM',
};

const ALL_STANDARD = new Set<string>([...STANDARD_CLASSES.ASSET, ...STANDARD_CLASSES.LIABILITY]);

export function isStandardClassId(value: unknown): value is StandardClassId {
  return typeof value === 'string' && ALL_STANDARD.has(value);
}

/** The standard class's side. */
export function sideOfStandard(id: StandardClassId): Side {
  return STANDARD_CLASSES.ASSET.includes(id) ? 'ASSET' : 'LIABILITY';
}

export function defaultGroupOf(id: StandardClassId): BalanceGroup {
  return DEFAULT_GROUPS[id];
}

export function groupsOf(side: Side): readonly BalanceGroup[] {
  return GROUPS[side];
}

/** The group a class falls under when it has neither an assignment nor a standard default. */
export function otherGroupOf(side: Side): BalanceGroup {
  return side === 'ASSET' ? 'OTHER_ASSET' : 'OTHER_LIABILITY';
}

export function normalizeLabel(label: string): string {
  return label.trim().normalize('NFC').toLocaleLowerCase('en-US');
}

/**
 * Identity of a class within a side: the standard id, or the normalized custom label. The side is
 * part of the key, so the same text on both sides is two classes.
 */
export function classKey(side: Side, ref: ClassRef): string {
  return 'standard' in ref
    ? `${side}:std:${ref.standard}`
    : `${side}:custom:${normalizeLabel(ref.custom)}`;
}

/** The standard class of `side` whose translated name equals `label` (case-insensitive), if any. */
export function matchStandardByLabel(
  side: Side,
  label: string,
  translate: (id: StandardClassId) => string,
): StandardClassId | null {
  const wanted = normalizeLabel(label);
  if (!wanted) return null;
  return STANDARD_CLASSES[side].find((id) => normalizeLabel(translate(id)) === wanted) ?? null;
}

/** Standard classes of the side followed by the distinct custom labels in use (first spelling wins). */
export function suggestionsOf(side: Side, snapshots: readonly WealthSnapshot[]): ClassRef[] {
  const result: ClassRef[] = STANDARD_CLASSES[side].map((standard) => ({ standard }));
  const seen = new Set<string>();
  for (const snapshot of snapshots) {
    for (const entry of snapshot.entries) {
      if (entry.side !== side || !('custom' in entry.class)) continue;
      const key = classKey(side, entry.class);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ custom: entry.class.custom.trim() });
    }
  }
  return result;
}
