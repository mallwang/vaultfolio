import { TestBed } from '@angular/core/testing';
import type { SessionUser } from '@vaultfolio/api-contract';
import { CurrentUserStore } from '../auth/current-user.store';
import { DashboardLayoutStore } from './dashboard-layout.store';

const user = (id: string, domainScopes: string[]): SessionUser => ({
  id,
  email: `${id}@example.com`,
  displayName: id,
  role: 'MEMBER',
  domainScopes,
});

describe('DashboardLayoutStore', () => {
  let currentUser: CurrentUserStore;
  let store: DashboardLayoutStore;

  beforeEach(() => {
    localStorage.clear();
    currentUser = TestBed.inject(CurrentUserStore);
    currentUser.setAuthenticated(user('u1', ['holdings']));
    store = TestBed.inject(DashboardLayoutStore);
  });

  const ids = () => store.visibleTiles().map((t) => t.id);

  it('shows only the tiles of domains the account has, in default order', () => {
    expect(ids()).toEqual(['holdings-distribution']);
    currentUser.setAuthenticated(user('u3', ['holdings', 'earnings']));
    TestBed.tick();
    expect(ids()).toEqual(['holdings-distribution', 'earnings']);
    currentUser.setAuthenticated(user('u4', []));
    TestBed.tick();
    expect(ids()).toEqual([]);
  });

  it('persists order and hidden tiles per user in localStorage', () => {
    store.setTileVisible('holdings-distribution', false);

    expect(ids()).toEqual([]);
    expect(JSON.parse(localStorage.getItem('vaultfolio.dashboard-layout.u1') ?? '')).toEqual({
      order: ['holdings-distribution'],
      hidden: ['holdings-distribution'],
      expanded: [],
    });

    currentUser.setAuthenticated(user('u2', ['holdings']));
    TestBed.tick();
    expect(ids()).toContain('holdings-distribution');
  });

  it('restores the saved layout in a fresh store and resets to defaults', () => {
    store.setTileVisible('holdings-distribution', false);
    TestBed.resetTestingModule();
    TestBed.inject(CurrentUserStore).setAuthenticated(user('u1', ['holdings']));
    const fresh = TestBed.inject(DashboardLayoutStore);
    expect(fresh.visibleTiles().map((t) => t.id)).not.toContain('holdings-distribution');

    fresh.reset();
    expect(fresh.visibleTiles().map((t) => t.id)).toContain('holdings-distribution');
    expect(fresh.isCustomized()).toBe(false);
  });

  describe('expanded tiles', () => {
    it('collapses every tile by default', () => {
      expect(store.isExpanded('holdings-distribution')).toBe(false);
    });

    it('expands and collapses a tile and persists it per user', () => {
      store.setExpanded('holdings-distribution', true);
      expect(store.isExpanded('holdings-distribution')).toBe(true);
      expect(
        JSON.parse(localStorage.getItem('vaultfolio.dashboard-layout.u1') ?? '').expanded,
      ).toEqual(['holdings-distribution']);

      store.setExpanded('holdings-distribution', false);
      expect(store.isExpanded('holdings-distribution')).toBe(false);
    });

    it('restores the expanded state in a fresh store', () => {
      store.setExpanded('holdings-distribution', true);
      TestBed.resetTestingModule();
      TestBed.inject(CurrentUserStore).setAuthenticated(user('u1', ['holdings']));
      expect(TestBed.inject(DashboardLayoutStore).isExpanded('holdings-distribution')).toBe(true);
    });

    it('keeps the expanded state when tiles are reordered or hidden and shown', () => {
      store.setExpanded('holdings-distribution', true);
      store.moveVisible(0, 1);
      store.setTileVisible('holdings-distribution', false);
      store.setTileVisible('holdings-distribution', true);
      expect(store.isExpanded('holdings-distribution')).toBe(true);
    });

    it('does not count as a customization and is cleared by reset', () => {
      store.setExpanded('holdings-distribution', true);
      expect(store.isCustomized()).toBe(false);
      store.reset();
      expect(store.isExpanded('holdings-distribution')).toBe(false);
    });

    it('does not share the state between users', () => {
      store.setExpanded('holdings-distribution', true);
      currentUser.setAuthenticated(user('u2', ['holdings']));
      TestBed.tick();
      expect(store.isExpanded('holdings-distribution')).toBe(false);
    });
  });
});
