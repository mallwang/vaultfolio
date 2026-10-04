import type { WealthEntry, WealthSnapshot } from '../model';

export function buildEntry(overrides: Partial<WealthEntry> = {}): WealthEntry {
  return {
    side: 'ASSET',
    class: { standard: 'cash' },
    name: 'Girokonto',
    amount: '1000.00',
    ...overrides,
  };
}

export function buildSnapshot(overrides: Partial<WealthSnapshot> = {}): WealthSnapshot {
  return {
    id: 'snapshot-1',
    snapshotDate: '2025-01-01',
    entries: [buildEntry()],
    ...overrides,
  };
}
