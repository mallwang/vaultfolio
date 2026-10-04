import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, type Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { WealthSnapshot } from '@vaultfolio/api-contract';
import { SnapshotFormComponent } from './snapshot-form.component';

const routes: Routes = [
  { path: 'app/historic-wealth-development/new', component: SnapshotFormComponent },
  { path: 'app/historic-wealth-development/:id/edit', component: SnapshotFormComponent },
  { path: 'app/historic-wealth-development', component: SnapshotFormComponent },
];

const existing: WealthSnapshot = {
  id: 's-old',
  snapshotDate: '2020-01-31',
  entries: [
    { side: 'ASSET', class: { standard: 'cash' }, name: 'Bar', amount: '100.00' },
    { side: 'LIABILITY', class: { custom: 'Privat' }, name: 'Onkel', amount: '40.00' },
  ],
  createdAt: '2020-01-31T00:00:00Z',
  updatedAt: '2020-01-31T00:00:00Z',
};

describe('SnapshotFormComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  const byId = (el: HTMLElement, id: string) =>
    el.querySelector(`[data-testid="${id}"]`) as HTMLInputElement | null;

  function type(el: HTMLElement, id: string, value: string): void {
    const input = byId(el, id) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function flushLoad(snapshots: WealthSnapshot[] = []): void {
    http.expectOne('/api/wealth/snapshots').flush(snapshots);
    http.expectOne('/api/wealth/settings').flush({ classGroups: [] });
  }

  async function open(url: string, snapshots: WealthSnapshot[] = []) {
    const harness = await RouterTestingHarness.create(url);
    flushLoad(snapshots);
    harness.detectChanges();
    await harness.fixture.whenStable();
    return { harness, el: harness.routeNativeElement as HTMLElement };
  }

  it('names the offending field and sends nothing when a value is invalid', async () => {
    const { harness, el } = await open('/app/historic-wealth-development/new');
    type(el, 'wealth-form-name-1', 'Girokonto');
    type(el, 'wealth-form-class-1', 'Bankguthaben');
    type(el, 'wealth-form-amount-1', '-5');
    harness.detectChanges();
    byId(el, 'wealth-form-save')?.click();
    harness.detectChanges();
    expect(http.match('/api/wealth/snapshots')).toHaveLength(0);
    expect(el.querySelector('[data-testid="wealth-form-row-1"] .error')).not.toBeNull();
  });

  it('parses 12.000,50, stores a matching label as a standard class and updates the sum box', async () => {
    const { harness, el } = await open('/app/historic-wealth-development/new');
    type(el, 'wealth-form-name-1', 'Girokonto');
    type(el, 'wealth-form-class-1', 'bank balances');
    type(el, 'wealth-form-amount-1', '12.000,50');
    harness.detectChanges();
    expect(byId(el, 'wealth-form-sum-assets')?.textContent).toContain('12,000.50');
    byId(el, 'wealth-form-save')?.click();
    const req = http.expectOne('/api/wealth/snapshots');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.entries).toEqual([
      { side: 'ASSET', class: { standard: 'bankBalances' }, name: 'Girokonto', amount: '12000.50' },
    ]);
  });

  it('accepts a free-text class as custom and offers it as a suggestion later', async () => {
    const withCustom: WealthSnapshot = {
      ...existing,
      entries: [{ side: 'ASSET', class: { custom: 'Whisky' }, name: 'Fass', amount: '1.00' }],
    };
    const { el } = await open('/app/historic-wealth-development/new', [withCustom]);
    const chips = Array.from(el.querySelectorAll('.suggestions .chip')).map((c) =>
      c.textContent?.trim(),
    );
    expect(chips).toContain('Whisky');
    expect(chips).toContain('Cash');
  });

  it('updates the sum box when a row is added and removed', async () => {
    const { harness, el } = await open('/app/historic-wealth-development/new');
    byId(el, 'wealth-form-add-liability')?.click();
    harness.detectChanges();
    type(el, 'wealth-form-amount-1', '100');
    type(el, 'wealth-form-amount-3', '30');
    harness.detectChanges();
    expect(byId(el, 'wealth-form-sum-net')?.textContent).toContain('70.00');
    byId(el, 'wealth-form-remove-3')?.click();
    harness.detectChanges();
    expect(byId(el, 'wealth-form-sum-net')?.textContent).toContain('100.00');
  });

  it('notes a taken date and offers to open the existing snapshot', async () => {
    const { harness, el } = await open('/app/historic-wealth-development/new', [existing]);
    type(el, 'wealth-form-date', '2020-01-31');
    harness.detectChanges();
    expect(byId(el, 'wealth-form-date-taken')).not.toBeNull();
    const link = byId(el, 'wealth-form-open-existing') as unknown as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/app/historic-wealth-development/s-old/edit');
    expect((byId(el, 'wealth-form-save') as unknown as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the existing-snapshot note from a server 409', async () => {
    const { harness, el } = await open('/app/historic-wealth-development/new');
    type(el, 'wealth-form-name-1', 'Bar');
    type(el, 'wealth-form-class-1', 'Cash');
    type(el, 'wealth-form-amount-1', '5');
    harness.detectChanges();
    byId(el, 'wealth-form-save')?.click();
    http
      .expectOne('/api/wealth/snapshots')
      .flush(
        { error: 'WEALTH_SNAPSHOT_DATE_EXISTS', existingId: 'zzz' },
        { status: 409, statusText: 'Conflict' },
      );
    harness.detectChanges();
    const link = byId(el, 'wealth-form-open-existing') as unknown as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/app/historic-wealth-development/zzz/edit');
  });

  it('loads a snapshot for editing and puts changes back', async () => {
    const harness = await RouterTestingHarness.create(
      '/app/historic-wealth-development/s-old/edit',
    );
    http.expectOne('/api/wealth/snapshots/s-old').flush(existing);
    flushLoad([existing]);
    harness.detectChanges();
    await harness.fixture.whenStable();
    const el = harness.routeNativeElement as HTMLElement;
    expect(byId(el, 'wealth-form-title')?.textContent).toContain('Edit');
    expect(byId(el, 'wealth-form-name-1')?.value).toBe('Bar');
    expect(byId(el, 'wealth-form-class-1')?.value).toBe('Cash');
    byId(el, 'wealth-form-save')?.click();
    const req = http.expectOne('/api/wealth/snapshots/s-old');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.entries).toHaveLength(2);
  });

  it('prefills names and classes with blank amounts when copying from a snapshot', async () => {
    const { harness, el } = await open('/app/historic-wealth-development/new', [existing]);
    const component = harness.routeDebugElement?.componentInstance as unknown as {
      copyFromSnapshot(id: string | null): void;
    };
    component.copyFromSnapshot('s-old');
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(byId(el, 'wealth-form-name-3')?.value).toBe('Bar');
    expect(byId(el, 'wealth-form-amount-3')?.value).toBe('');
    expect(byId(el, 'wealth-form-name-4')?.value).toBe('Onkel');
    // Blank amount blocks saving with a field message.
    byId(el, 'wealth-form-save')?.click();
    harness.detectChanges();
    expect(http.match('/api/wealth/snapshots')).toHaveLength(0);
    expect(el.querySelector('[data-testid="wealth-form-row-3"] .error')).not.toBeNull();
    // Removing a copied entry drops it from the sum.
    byId(el, 'wealth-form-remove-4')?.click();
    harness.detectChanges();
    expect(el.querySelector('[data-testid="wealth-form-row-4"]')).toBeNull();
  });
});
