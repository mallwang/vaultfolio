import { CURRENT_USER_SOURCE } from '@vaultfolio/frontend-domain-access';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { WealthSnapshot } from '@vaultfolio/api-contract';
import { WealthDashboardWidgetComponent } from './wealth-dashboard-widget.component';

const snap = (id: string, date: string, assets: string, liabilities = '0.00'): WealthSnapshot => ({
  id,
  snapshotDate: date,
  entries: [
    { side: 'ASSET', class: { standard: 'cash' }, name: 'x', amount: assets },
    { side: 'LIABILITY', class: { standard: 'loan' }, name: 'y', amount: liabilities },
  ],
  createdAt: '',
  updatedAt: '',
});

describe('WealthDashboardWidgetComponent', () => {
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

  async function render(snapshots: WealthSnapshot[] | 503) {
    const fixture = TestBed.createComponent(WealthDashboardWidgetComponent);
    fixture.detectChanges();
    const list = http.expectOne('/api/wealth/snapshots');
    const settings = http.expectOne('/api/wealth/settings');
    if (snapshots === 503) {
      list.flush({ error: 'WEALTH_UNAVAILABLE' }, { status: 503, statusText: 'x' });
      // forkJoin cancels the settings request after the first failure.
    } else {
      list.flush(snapshots);
      settings.flush({ classGroups: [] });
    }
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`);
  const txt = (el: HTMLElement, id: string) => q(el, id)?.textContent?.replace(/\s+/g, ' ').trim();

  it('shows the latest net worth, change with percent, reference date, composition bar and rows', async () => {
    const el = await render([
      snap('a', '2025-01-15', '1000.00'),
      snap('b', '2025-06-15', '1200.00', '100.00'),
    ]);
    expect(txt(el, 'wealth-widget-net')).toContain('1,100.00');
    expect(txt(el, 'wealth-widget-change')).toContain('+€100.00');
    expect(txt(el, 'wealth-widget-change')).toContain('+10.0%');
    expect(txt(el, 'wealth-widget-change')).toContain('January 15, 2025');
    expect(txt(el, 'wealth-widget-date')).toBe('As of June 15, 2025');
    expect(q(el, 'wealth-widget-composition')?.children.length).toBe(1);
    expect(txt(el, 'wealth-widget-assets')).toContain('1,200.00');
    expect(txt(el, 'wealth-widget-liabilities')).toContain('100.00');
    expect(q(el, 'wealth-widget-link')?.getAttribute('href')).toBe(
      '/app/historic-wealth-development',
    );
  });

  it('shows a hint for one snapshot', async () => {
    const el = await render([snap('a', '2025-01-15', '1000.00')]);
    expect(q(el, 'wealth-widget-hint')).not.toBeNull();
  });

  it('shows the empty state linking to the page', async () => {
    const el = await render([]);
    expect(q(el, 'wealth-widget-empty')?.getAttribute('href')).toBe(
      '/app/historic-wealth-development',
    );
  });

  it('shows n/a-safe change for negative net worth and degrades on 503', async () => {
    const neg = await render([
      snap('a', '2025-01-15', '10.00', '50.00'),
      snap('b', '2025-02-15', '10.00', '30.00'),
    ]);
    expect(txt(neg, 'wealth-widget-net')).toContain('20.00');
    expect(txt(neg, 'wealth-widget-change')).toContain('n/a');
  });

  it('shows a short note when the domain is unavailable', async () => {
    const el = await render(503);
    expect(q(el, 'wealth-widget-unavailable')).not.toBeNull();
  });
});
