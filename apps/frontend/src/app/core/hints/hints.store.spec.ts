import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Injectable, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { type Hint, type HiddenHintState, parseHiddenState } from '@vaultfolio/frontend-hints';
import { CurrentUserStore } from '../../auth/current-user.store';
import { FakeCurrentUserStore } from '../../auth/testing/current-user-store.testing';
import { HINT_PROVIDER_CONTRIBUTIONS } from './hint-providers.registry';
import { HintsStorage } from './hints-storage';
import { HintsStore } from './hints.store';

const SAMPLE_HINT: Hint = {
  id: 'test.hint.1',
  severity: 'warning',
  titleKey: 'test.title',
  descriptionKey: 'test.description',
  target: { commands: ['/test'] },
  linkLabelKey: 'test.link',
};

@Injectable()
class FakeProvider {
  private readonly _hints = signal<readonly Hint[]>([]);
  readonly hints = this._hints.asReadonly();
  readonly ready = signal(true);
  load(): void {
    /* noop */
  }
  setHints(hints: readonly Hint[]): void {
    this._hints.set(hints);
  }
}

describe('HintsStore', () => {
  let store: HintsStore;
  let fakeCurrentUser: FakeCurrentUserStore;
  let fakeStorage: {
    load: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    fakeStorage = { load: vi.fn(() => parseHiddenState(null)), save: vi.fn(), clear: vi.fn() };
    fakeCurrentUser = new FakeCurrentUserStore();
    fakeCurrentUser.setAuthenticated({ id: 'user-a' } as Parameters<
      typeof fakeCurrentUser.setAuthenticated
    >[0]);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        FakeProvider,
        { provide: CurrentUserStore, useValue: fakeCurrentUser },
        { provide: HintsStorage, useValue: fakeStorage },
        {
          provide: HINT_PROVIDER_CONTRIBUTIONS,
          useValue: [
            {
              sourceId: 'test',
              groupLabelKey: 'test.group',
              loadProvider: () => Promise.resolve(FakeProvider),
            },
          ],
        },
      ],
    });

    store = TestBed.inject(HintsStore);
  });

  it('hide() persists hidden entry to storage', async () => {
    TestBed.inject(FakeProvider).setHints([SAMPLE_HINT]);
    await store.load();

    store.hide(SAMPLE_HINT.id);

    expect(fakeStorage.save).toHaveBeenCalledOnce();
    const saved = fakeStorage.save.mock.calls[0][0] as HiddenHintState;
    expect(saved.entries[SAMPLE_HINT.id]).toBeDefined();
    expect(store.view().hidden).toHaveLength(1);
    expect(store.view().active).toHaveLength(0);
  });

  it('restore() removes the hint from hidden', async () => {
    TestBed.inject(FakeProvider).setHints([SAMPLE_HINT]);
    await store.load();
    store.hide(SAMPLE_HINT.id);

    store.restore(SAMPLE_HINT.id);

    expect(fakeStorage.save).toHaveBeenCalledTimes(2);
    const lastSaved = fakeStorage.save.mock.calls[1][0] as HiddenHintState;
    expect(lastSaved.entries[SAMPLE_HINT.id]).toBeUndefined();
    expect(store.view().active).toHaveLength(1);
    expect(store.view().hidden).toHaveLength(0);
  });

  it('hint reactivates when its content signature changes', async () => {
    const provider = TestBed.inject(FakeProvider);
    provider.setHints([SAMPLE_HINT]);
    await store.load();
    store.hide(SAMPLE_HINT.id);
    expect(store.view().hidden).toHaveLength(1);

    // Different titleKey → different signature → isHidden returns false
    provider.setHints([{ ...SAMPLE_HINT, titleKey: 'test.title.v2' }]);

    expect(store.view().active).toHaveLength(1);
    expect(store.view().hidden).toHaveLength(0);
  });

  it('different user sees different hidden state on load', async () => {
    const provider = TestBed.inject(FakeProvider);
    provider.setHints([SAMPLE_HINT]);
    await store.load();
    store.hide(SAMPLE_HINT.id);
    expect(store.view().hidden).toHaveLength(1);

    // User B has empty storage; load() resets hiddenState from storage
    fakeCurrentUser.setAuthenticated({ id: 'user-b' } as Parameters<
      typeof fakeCurrentUser.setAuthenticated
    >[0]);
    fakeStorage.load.mockReturnValue(parseHiddenState(null));
    await store.load();

    expect(store.view().hidden).toHaveLength(0);
    expect(store.view().active).toHaveLength(1);
  });
});
