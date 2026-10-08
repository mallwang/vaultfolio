import { viewOf, sortHints } from './hint-view';
import { hide } from './hidden-state';
import type { Hint } from './hint';

const parseHiddenState = (raw: string | null) => {
  if (!raw) return { version: 1 as const, entries: {} };
  return JSON.parse(raw) as ReturnType<typeof import('./hidden-state').parseHiddenState>;
};

const EMPTY = parseHiddenState(null);

function makeHint(id: string, severity: 'warning' | 'info' = 'info'): Hint {
  return {
    id,
    severity,
    titleKey: `hints.${id}.title`,
    descriptionKey: `hints.${id}.desc`,
    target: { commands: [`/${id}`] },
    linkLabelKey: `hints.${id}.link`,
  };
}

const h1 = makeHint('h1', 'warning');
const h2 = makeHint('h2', 'info');
const h3 = makeHint('h3', 'warning');

describe('viewOf', () => {
  it('puts all hints in active when state is empty', () => {
    const { active, hidden } = viewOf([h1, h2], EMPTY);
    expect(active).toHaveLength(2);
    expect(hidden).toHaveLength(0);
  });

  it('moves hidden hint to hidden list', () => {
    const state = hide(EMPTY, h1, 'src');
    const { active, hidden } = viewOf([h1, h2], state);
    expect(active.map((h) => h.id)).toEqual(['h2']);
    expect(hidden.map((h) => h.id)).toEqual(['h1']);
  });

  it('badge count equals active count', () => {
    const state = hide(EMPTY, h1, 'src');
    const { badge } = viewOf([h1, h2], state);
    expect(badge.count).toBe(1);
  });

  it('badge label shows 9+ when count > 9', () => {
    const hints = Array.from({ length: 10 }, (_, i) => makeHint(`h${i}`));
    const { badge } = viewOf(hints, EMPTY);
    expect(badge.label).toBe('9+');
  });

  it('badge label shows count as string when <= 9', () => {
    const { badge } = viewOf([h1, h2], EMPTY);
    expect(badge.label).toBe('2');
  });

  it('dot is true when count=0 and hidden>0', () => {
    const state = hide(EMPTY, h1, 'src');
    const { badge } = viewOf([h1], state);
    expect(badge.count).toBe(0);
    expect(badge.dot).toBe(true);
  });

  it('dot is false when active hints remain', () => {
    const { badge } = viewOf([h1, h2], EMPTY);
    expect(badge.dot).toBe(false);
  });
});

describe('sortHints', () => {
  it('places warnings before info', () => {
    const sorted = sortHints([h2, h1, h3]);
    expect(sorted[0].severity).toBe('warning');
    expect(sorted[1].severity).toBe('warning');
    expect(sorted[2].severity).toBe('info');
  });
});
