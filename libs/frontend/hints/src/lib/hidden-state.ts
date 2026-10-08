import type { Hint } from './hint.js';
import { hintSignature } from './hint-signature.js';

export interface HiddenEntry {
  source: string;
  signature: string;
}

export interface HiddenHintState {
  version: 1;
  entries: Record<string, HiddenEntry>;
}

const EMPTY: HiddenHintState = { version: 1, entries: {} };

export function parseHiddenState(raw: string | null | undefined): HiddenHintState {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return EMPTY;
    const p = parsed as Record<string, unknown>;
    if (p['version'] !== 1 || typeof p['entries'] !== 'object' || p['entries'] === null)
      return EMPTY;
    return { version: 1, entries: p['entries'] as Record<string, HiddenEntry> };
  } catch {
    return EMPTY;
  }
}

export function serializeHiddenState(state: HiddenHintState): string {
  return JSON.stringify(state);
}

export function isHidden(state: HiddenHintState, hint: Hint): boolean {
  const entry = state.entries[hint.id];
  return entry?.signature === hintSignature(hint);
}

export function hide(state: HiddenHintState, hint: Hint, source: string): HiddenHintState {
  return {
    version: 1,
    entries: { ...state.entries, [hint.id]: { source, signature: hintSignature(hint) } },
  };
}

export function restore(state: HiddenHintState, hintId: string): HiddenHintState {
  const { [hintId]: _removed, ...rest } = state.entries;
  return { version: 1, entries: rest };
}

export function purgeStale(
  state: HiddenHintState,
  readySources: ReadonlySet<string>,
  currentIds: ReadonlySet<string>,
): HiddenHintState {
  const entries = Object.fromEntries(
    Object.entries(state.entries).filter(
      ([id, entry]) => !readySources.has(entry.source) || currentIds.has(id),
    ),
  );
  return { version: 1, entries };
}
