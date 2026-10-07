import {
  parseDashboardLayout,
  reorderVisible,
  resolveTiles,
  type DashboardTileDefinition,
} from './dashboard-layout';

const tile = (id: string): DashboardTileDefinition => ({
  id,
  titleKey: `t.${id}`,
  domainId: 'd',
  widget: { id, domainId: 'd', titleKey: `t.${id}`, loadComponent: () => Promise.reject() },
});

const catalog = [tile('a'), tile('b'), tile('c')];
const ids = (tiles: { id: string }[]) => tiles.map((t) => t.id);

describe('resolveTiles', () => {
  it('keeps catalog order for an empty layout', () => {
    expect(ids(resolveTiles(catalog, { order: [], hidden: [] }))).toEqual(['a', 'b', 'c']);
  });

  it('applies the saved order and appends tiles the layout does not know yet', () => {
    expect(ids(resolveTiles(catalog, { order: ['c', 'a'], hidden: [] }))).toEqual(['c', 'a', 'b']);
  });

  it('ignores saved ids that are no longer in the catalog', () => {
    expect(ids(resolveTiles(catalog, { order: ['gone', 'b'], hidden: [] }))).toEqual([
      'b',
      'a',
      'c',
    ]);
  });

  it('flags hidden tiles', () => {
    const tiles = resolveTiles([tile('a'), tile('b')], { order: [], hidden: ['a'] });
    expect(tiles.map((t) => t.hidden)).toEqual([true, false]);
  });
});

describe('reorderVisible', () => {
  it('moves a visible tile and leaves hidden tiles in their slots', () => {
    const tiles = resolveTiles(catalog, { order: [], hidden: ['b'] });
    // visible: a, c -> move a behind c; b keeps slot 1
    expect(reorderVisible(tiles, 0, 1)).toEqual(['c', 'b', 'a']);
  });

  it('returns the current order for out-of-range moves', () => {
    const tiles = resolveTiles(catalog, { order: [], hidden: [] });
    expect(reorderVisible(tiles, 0, 3)).toEqual(['a', 'b', 'c']);
    expect(reorderVisible(tiles, 0, -1)).toEqual(['a', 'b', 'c']);
  });
});

describe('parseDashboardLayout', () => {
  it('falls back to an empty layout for missing or broken input', () => {
    for (const raw of [null, '', 'not json', '42', 'null']) {
      expect(parseDashboardLayout(raw)).toEqual({ order: [], hidden: [], expanded: [] });
    }
  });

  it('keeps only string entries', () => {
    expect(parseDashboardLayout('{"order":["a",1],"hidden":"x"}')).toEqual({
      order: ['a'],
      hidden: [],
      expanded: [],
    });
  });

  it('reads the expanded tiles, dropping duplicates and non-strings', () => {
    expect(parseDashboardLayout('{"expanded":["a",2,"a","b"]}').expanded).toEqual(['a', 'b']);
  });

  it('accepts layouts stored before details could be expanded', () => {
    expect(parseDashboardLayout('{"order":["a"],"hidden":["b"]}')).toEqual({
      order: ['a'],
      hidden: ['b'],
      expanded: [],
    });
  });
});
