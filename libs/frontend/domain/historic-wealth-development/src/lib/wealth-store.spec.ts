import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { CURRENT_USER_SOURCE } from '@vaultfolio/frontend-domain-access';
import type { SessionUser } from '@vaultfolio/api-contract';
import { WealthService } from './wealth.service';
import { WealthStore } from './wealth-store';

describe('WealthStore', () => {
  const user = signal<SessionUser | null>({ id: 'admin' } as SessionUser);
  const service = {
    snapshots: vi.fn(() => of([{ id: 's1', date: '2026-01-01' }])),
    settings: vi.fn(() => of({ classGroups: [] })),
  };

  beforeEach(() => {
    user.set({ id: 'admin' } as SessionUser);
    TestBed.configureTestingModule({
      providers: [
        { provide: WealthService, useValue: service },
        { provide: CURRENT_USER_SOURCE, useValue: { current: user } },
      ],
    });
  });

  it('drops the previous user’s data when the signed-in user changes', () => {
    const store = TestBed.inject(WealthStore);
    store.ensureLoaded();
    TestBed.tick();
    expect(store.snapshots()).toHaveLength(1);

    user.set(null);
    TestBed.tick();
    expect(store.snapshots()).toEqual([]);
    expect(store.loaded()).toBe(false);

    user.set({ id: 'member' } as SessionUser);
    TestBed.tick();
    store.ensureLoaded();
    expect(service.snapshots).toHaveBeenCalledTimes(2);
  });
});
