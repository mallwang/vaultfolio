import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { EarningsEmployer, EarningsOverview } from '@vaultfolio/api-contract';
import { of, throwError } from 'rxjs';
import { EarningsService } from '../earnings.service';
import { ALL_EMPLOYERS, EarningsFilterStore } from './earnings-filter.store';

function overview(partial: Partial<EarningsOverview> = {}): EarningsOverview {
  return {
    hasData: true,
    dataCheckIssues: 2,
    ...partial,
  } as EarningsOverview;
}

function employer(id: string, detectedName: string, displayName: string | null = null) {
  return { id, detectedName, displayName } as EarningsEmployer;
}

describe('EarningsFilterStore', () => {
  const unavailable = signal(false);
  let api: {
    unavailable: typeof unavailable;
    overview: ReturnType<typeof vi.fn>;
    employers: ReturnType<typeof vi.fn>;
  };

  function create(): EarningsFilterStore {
    TestBed.configureTestingModule({
      providers: [EarningsFilterStore, { provide: EarningsService, useValue: api }],
    });
    const store = TestBed.inject(EarningsFilterStore);
    TestBed.tick();
    return store;
  }

  beforeEach(() => {
    unavailable.set(false);
    api = {
      unavailable,
      overview: vi.fn(() => of(overview())),
      employers: vi.fn(() => of([employer('e1', 'Acme GmbH'), employer('e2', 'Globex AG')])),
    };
  });

  it('loads the overview for all employers and the employer list on creation', () => {
    const store = create();

    expect(api.overview).toHaveBeenCalledWith(null);
    expect(store.employerId()).toBeNull();
    expect(store.hasData()).toBe(true);
    expect(store.dataCheckIssues()).toBe(2);
    expect(store.employers().map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(store.loadError()).toBe(false);
  });

  it('reports hasData as null until an overview arrived and no issues without one', () => {
    api.overview.mockReturnValue(throwError(() => new Error('boom')));
    const store = create();

    expect(store.overview()).toBeNull();
    expect(store.hasData()).toBeNull();
    expect(store.dataCheckIssues()).toBe(0);
  });

  it('refetches the overview for the selected employer', () => {
    const store = create();

    store.select('e2');
    TestBed.tick();

    expect(store.employerId()).toBe('e2');
    expect(api.overview).toHaveBeenLastCalledWith('e2');
  });

  it('falls back to all employers for an empty or missing selection', () => {
    const store = create();
    store.select('e1');

    store.select('');
    expect(store.selection()).toBe(ALL_EMPLOYERS);
    store.select('e1');
    store.select(null);
    expect(store.selection()).toBe(ALL_EMPLOYERS);
    store.select('e1');
    store.select(undefined);
    expect(store.employerId()).toBeNull();
  });

  it('sets loadError when the overview fails and clears it after a successful reload', () => {
    api.overview.mockReturnValueOnce(throwError(() => new Error('boom')));
    const store = create();
    expect(store.loadError()).toBe(true);

    api.overview.mockReturnValue(of(overview({ hasData: false })));
    store.reload();
    TestBed.tick();

    expect(store.loadError()).toBe(false);
    expect(store.hasData()).toBe(false);
  });

  it('reload() refetches the overview and the employers and changes the query', () => {
    const store = create();
    const before = store.query();

    store.reload();
    TestBed.tick();

    expect(store.query()).not.toBe(before);
    expect(store.query().version).toBe(before.version + 1);
    expect(api.overview).toHaveBeenCalledTimes(2);
    expect(api.employers).toHaveBeenCalledTimes(2);
  });

  it('resets a selected employer that no longer exists after a reload', () => {
    const store = create();
    store.select('e2');
    TestBed.tick();

    api.employers.mockReturnValue(of([employer('e1', 'Acme GmbH')]));
    store.reload();

    expect(store.selection()).toBe(ALL_EMPLOYERS);
  });

  it('keeps the selection when the employer list cannot be loaded', () => {
    const store = create();
    store.select('e2');

    api.employers.mockReturnValue(throwError(() => new Error('boom')));
    store.reload();

    expect(store.employers()).toEqual([]);
    expect(store.selection()).toBe(ALL_EMPLOYERS);
  });

  it('labels an employer with its display name, falling back to the detected name', () => {
    const store = create();

    expect(store.labelOf(employer('e1', 'Acme GmbH', 'My job'))).toBe('My job');
    expect(store.labelOf(employer('e2', 'Globex AG'))).toBe('Globex AG');
  });

  it('exposes the service availability', () => {
    const store = create();
    expect(store.unavailable()).toBe(false);

    unavailable.set(true);
    expect(store.unavailable()).toBe(true);
  });
});
