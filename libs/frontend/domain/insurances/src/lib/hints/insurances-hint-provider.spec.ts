import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { InsurancesStore } from '../insurances-store';
import { InsurancesHintProvider } from './insurances-hint-provider';

describe('InsurancesHintProvider', () => {
  const loaded = signal(false);
  const loadFailed = signal(false);
  const redundant = signal<{ contractId: string; otherContractId: string }[]>([]);
  const contracts = signal<{ id: string; name: string }[]>([]);
  const store = {
    loaded,
    loadFailed,
    contracts,
    gaps: () => ({ redundant: redundant() }),
    ensureLoaded: vi.fn(),
    refresh: vi.fn(),
  };
  let provider: InsurancesHintProvider;

  beforeEach(() => {
    loaded.set(false);
    loadFailed.set(false);
    redundant.set([{ contractId: 'a', otherContractId: 'b' }]);
    contracts.set([{ id: 'a', name: 'Haftpflicht' }]);
    store.ensureLoaded.mockReset();
    store.refresh.mockReset();
    TestBed.configureTestingModule({ providers: [{ provide: InsurancesStore, useValue: store }] });
    provider = TestBed.inject(InsurancesHintProvider);
  });

  it('yields nothing before the store has loaded', () => {
    expect(provider.hints()).toEqual([]);
    expect(provider.ready()).toBe(false);
  });

  it('names the overlapping contracts and falls back to the id for unknown ones', () => {
    loaded.set(true);

    const [hint] = provider.hints();
    expect(hint.id).toBe('insurances.redundant.a.b');
    expect(hint.params).toEqual({ contractName: 'Haftpflicht', otherContractName: 'b' });
    expect(hint.target.commands).toEqual(['/app', 'insurances', 'gap-check']);
  });

  it('is ready once loading settled, also when it failed', () => {
    loadFailed.set(true);
    expect(provider.ready()).toBe(true);
  });

  it('delegates load and refresh to the store', () => {
    provider.load();
    provider.refresh();

    expect(store.ensureLoaded).toHaveBeenCalledOnce();
    expect(store.refresh).toHaveBeenCalledOnce();
  });
});
