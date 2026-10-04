import { CURRENT_USER_SOURCE } from '@vaultfolio/frontend-domain-access';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { WealthSettings, WealthSnapshot } from '@vaultfolio/api-contract';
import { WealthStore } from '../wealth-store';
import { BalanceSheetComponent } from './balance-sheet.component';

const snap = (id: string, date: string, extra: WealthSnapshot['entries'] = []): WealthSnapshot => ({
  id,
  snapshotDate: date,
  entries: [
    { side: 'ASSET', class: { standard: 'cash' }, name: 'Giro', amount: '1000.00' },
    { side: 'ASSET', class: { custom: 'Whisky' }, name: 'Fass', amount: '300.00' },
    { side: 'LIABILITY', class: { standard: 'mortgage' }, name: 'Haus', amount: '500.00' },
    ...extra,
  ],
  createdAt: '',
  updatedAt: '',
});

describe('BalanceSheetComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CURRENT_USER_SOURCE, useValue: { current: () => ({ id: 'user-1' }) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  async function render(
    snapshots: WealthSnapshot[],
    settings: WealthSettings = { classGroups: [] },
  ) {
    const store = TestBed.inject(WealthStore);
    store.refresh();
    http.expectOne('/api/wealth/snapshots').flush(snapshots);
    http.expectOne('/api/wealth/settings').flush(settings);
    const fixture = TestBed.createComponent(BalanceSheetComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, store, el: fixture.nativeElement as HTMLElement };
  }

  const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`);
  const txt = (el: HTMLElement, id: string) =>
    q(el, id)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  it('groups Aktiva and Passiva with sub-totals, equity first and identical sums', async () => {
    const { el } = await render([snap('a', '2025-06-30')]);
    expect(txt(el, 'wealth-balance-group-LIQUID')).toContain('1,000.00');
    expect(txt(el, 'wealth-balance-group-OTHER_ASSET')).toContain('Whisky');
    expect(txt(el, 'wealth-balance-group-LONG_TERM')).toContain('500.00');
    expect(txt(el, 'wealth-balance-group-TANGIBLE')).toContain('No positions');
    expect(txt(el, 'wealth-balance-equity')).toContain('800.00');
    const passiva = q(el, 'wealth-balance-passiva') as HTMLElement;
    expect(passiva.querySelector('h3')?.textContent).toContain('Equity');
    expect(txt(el, 'wealth-balance-sum-assets')).toContain('1,300.00');
    expect(txt(el, 'wealth-balance-sum-passiva')).toContain('1,300.00');
  });

  it('shows negative equity', async () => {
    const { el } = await render([
      {
        ...snap('a', '2025-06-30'),
        entries: [
          { side: 'ASSET', class: { standard: 'cash' }, name: 'Giro', amount: '100.00' },
          { side: 'LIABILITY', class: { standard: 'loan' }, name: 'K', amount: '400.00' },
        ],
      },
    ]);
    expect(txt(el, 'wealth-balance-equity')).toContain('-€300.00');
    expect(txt(el, 'wealth-balance-sum-passiva')).toBe(
      txt(el, 'wealth-balance-sum-assets').replace('Total', 'Total'),
    );
  });

  it('defaults to the latest snapshot and switches with the reference date', async () => {
    const { fixture, el } = await render([
      snap('a', '2024-06-30'),
      snap('b', '2025-06-30', [
        { side: 'ASSET', class: { standard: 'crypto' }, name: 'BTC', amount: '50.00' },
      ]),
    ]);
    expect(txt(el, 'wealth-balance-group-SECURITIES')).toContain('BTC');
    const component = fixture.componentInstance as unknown as {
      selected: { set(v: string): void };
    };
    component.selected.set('a');
    fixture.detectChanges();
    expect(txt(el, 'wealth-balance-group-SECURITIES')).not.toContain('BTC');
  });

  it('applies a stored group assignment to the shown snapshot', async () => {
    const { el } = await render([snap('a', '2025-06-30')], {
      classGroups: [{ side: 'ASSET', class: { custom: 'whisky' }, group: 'TANGIBLE' }],
    });
    expect(txt(el, 'wealth-balance-group-TANGIBLE')).toContain('Whisky');
    expect(txt(el, 'wealth-balance-group-OTHER_ASSET')).toContain('No positions');
  });

  it('saves a new group for a class through the selector and re-groups everywhere', async () => {
    const { fixture, el } = await render([snap('a', '2025-06-30')]);
    const component = fixture.componentInstance as unknown as {
      chooseClass(v: string): void;
      groupChoice: { set(v: string): void };
      apply(): void;
    };
    component.chooseClass('ASSET:custom:whisky');
    component.groupChoice.set('TANGIBLE');
    component.apply();
    const req = http.expectOne('/api/wealth/settings/class-groups');
    expect(req.request.body).toEqual({
      side: 'ASSET',
      class: { custom: 'Whisky' },
      group: 'TANGIBLE',
    });
    req.flush({ classGroups: [req.request.body] });
    fixture.detectChanges();
    expect(txt(el, 'wealth-balance-group-TANGIBLE')).toContain('Whisky');
  });

  it('shows the ratios warning and no ratio figures', async () => {
    const { el } = await render([snap('a', '2025-06-30')]);
    expect(txt(el, 'wealth-balance-warning')).toContain('No ratios');
    expect(el.textContent).not.toMatch(/ratio:|quote/i);
  });

  it('shows the empty state without snapshots', async () => {
    const { el } = await render([]);
    expect(q(el, 'wealth-empty')).not.toBeNull();
  });
});
