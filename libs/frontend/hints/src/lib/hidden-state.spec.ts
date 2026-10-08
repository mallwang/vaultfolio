import {
  isHidden,
  hide,
  restore,
  purgeStale,
  parseHiddenState,
  serializeHiddenState,
} from './hidden-state';
import { hintSignature } from './hint-signature';
import type { Hint } from './hint';

const hint: Hint = {
  id: 'ins.redundant.1',
  severity: 'warning',
  titleKey: 'hints.ins.title',
  descriptionKey: 'hints.ins.desc',
  target: { commands: ['/insurances'] },
  linkLabelKey: 'hints.ins.link',
};

const EMPTY = parseHiddenState(null);

describe('isHidden', () => {
  it('returns false for empty state', () => {
    expect(isHidden(EMPTY, hint)).toBe(false);
  });

  it('returns true when id and signature match', () => {
    const state = hide(EMPTY, hint, 'insurances');
    expect(isHidden(state, hint)).toBe(true);
  });

  it('returns false when signature changes (content changed)', () => {
    const state = hide(EMPTY, hint, 'insurances');
    const changed = { ...hint, params: { name: 'updated' } };
    expect(isHidden(state, changed)).toBe(false);
  });
});

describe('hide', () => {
  it('adds entry with correct source and signature', () => {
    const state = hide(EMPTY, hint, 'insurances');
    expect(state.entries[hint.id]).toEqual({
      source: 'insurances',
      signature: hintSignature(hint),
    });
  });

  it('does not mutate original state', () => {
    hide(EMPTY, hint, 'insurances');
    expect(EMPTY.entries).toEqual({});
  });
});

describe('restore', () => {
  it('removes the entry', () => {
    const state = hide(EMPTY, hint, 'insurances');
    const restored = restore(state, hint.id);
    expect(restored.entries[hint.id]).toBeUndefined();
  });
});

describe('purgeStale', () => {
  it('keeps entries for non-ready sources', () => {
    const state = hide(EMPTY, hint, 'insurances');
    const purged = purgeStale(state, new Set(), new Set());
    expect(purged.entries[hint.id]).toBeDefined();
  });

  it('removes entry when source is ready and id not in current hints', () => {
    const state = hide(EMPTY, hint, 'insurances');
    const purged = purgeStale(state, new Set(['insurances']), new Set());
    expect(purged.entries[hint.id]).toBeUndefined();
  });

  it('keeps entry when source is ready and id is still present', () => {
    const state = hide(EMPTY, hint, 'insurances');
    const purged = purgeStale(state, new Set(['insurances']), new Set([hint.id]));
    expect(purged.entries[hint.id]).toBeDefined();
  });
});

describe('parseHiddenState / serializeHiddenState', () => {
  it('round-trips correctly', () => {
    const state = hide(EMPTY, hint, 'insurances');
    const serialized = serializeHiddenState(state);
    const parsed = parseHiddenState(serialized);
    expect(parsed).toEqual(state);
  });

  it('returns empty for null', () => {
    expect(parseHiddenState(null)).toEqual(EMPTY);
  });

  it('returns empty for invalid JSON', () => {
    expect(parseHiddenState('not-json')).toEqual(EMPTY);
  });

  it('returns empty for version mismatch', () => {
    expect(parseHiddenState(JSON.stringify({ version: 2, entries: {} }))).toEqual(EMPTY);
  });
});
