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

  it('shows every tile in default order, with a placeholder for a missing entitlement', () => {
    expect(ids()).toEqual([
      'totalValue',
      'todaysChange',
      'holdings',
      'earnings',
      'retirement',
      'insurances',
      'historic-wealth-development',
      'account-overview',
    ]);
    expect(store.visibleTiles().find((t) => t.id === 'earnings')?.entitled).toBe(false);
  });

  it('persists order and hidden tiles per user in localStorage', () => {
    store.moveVisible(0, 2);
    store.setTileVisible('todaysChange', false);

    expect(ids()).toEqual([
      'holdings',
      'totalValue',
      'earnings',
      'retirement',
      'insurances',
      'historic-wealth-development',
      'account-overview',
    ]);
    expect(JSON.parse(localStorage.getItem('vaultfolio.dashboard-layout.u1') ?? '')).toEqual({
      order: [
        'todaysChange',
        'holdings',
        'totalValue',
        'earnings',
        'retirement',
        'insurances',
        'historic-wealth-development',
        'account-overview',
      ],
      hidden: ['todaysChange'],
    });

    currentUser.setAuthenticated(user('u2', []));
    TestBed.tick();
    expect(ids()).toContain('todaysChange');
  });

  it('restores the saved layout in a fresh store and resets to defaults', () => {
    store.setTileVisible('totalValue', false);
    TestBed.resetTestingModule();
    TestBed.inject(CurrentUserStore).setAuthenticated(user('u1', ['holdings']));
    const fresh = TestBed.inject(DashboardLayoutStore);
    expect(fresh.visibleTiles().map((t) => t.id)).not.toContain('totalValue');

    fresh.reset();
    expect(fresh.visibleTiles().map((t) => t.id)).toContain('totalValue');
    expect(fresh.isCustomized()).toBe(false);
  });
});
