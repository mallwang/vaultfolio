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
    expect(ids()).toEqual(['holdings-total-value', 'holdings-distribution']);
    currentUser.setAuthenticated(user('u3', ['holdings', 'earnings']));
    TestBed.tick();
    expect(ids()).toEqual(['holdings-total-value', 'holdings-distribution', 'earnings']);
    currentUser.setAuthenticated(user('u4', []));
    TestBed.tick();
    expect(ids()).toEqual([]);
  });

  it('persists order and hidden tiles per user in localStorage', () => {
    store.moveVisible(0, 1);
    store.setTileVisible('holdings-distribution', false);

    expect(ids()).toEqual(['holdings-total-value']);
    expect(JSON.parse(localStorage.getItem('vaultfolio.dashboard-layout.u1') ?? '')).toEqual({
      order: ['holdings-distribution', 'holdings-total-value'],
      hidden: ['holdings-distribution'],
    });

    currentUser.setAuthenticated(user('u2', ['holdings']));
    TestBed.tick();
    expect(ids()).toContain('holdings-distribution');
  });

  it('restores the saved layout in a fresh store and resets to defaults', () => {
    store.setTileVisible('holdings-total-value', false);
    TestBed.resetTestingModule();
    TestBed.inject(CurrentUserStore).setAuthenticated(user('u1', ['holdings']));
    const fresh = TestBed.inject(DashboardLayoutStore);
    expect(fresh.visibleTiles().map((t) => t.id)).not.toContain('holdings-total-value');

    fresh.reset();
    expect(fresh.visibleTiles().map((t) => t.id)).toContain('holdings-total-value');
    expect(fresh.isCustomized()).toBe(false);
  });
});
