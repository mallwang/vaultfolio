import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, type Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { summarize } from '@vaultfolio/retirement';
import { buildRecord } from '@vaultfolio/retirement/testing';
import { OverviewComponent } from './overview.component';

const routes: Routes = [
  { path: 'overview', component: OverviewComponent },
  { path: 'statutory', component: OverviewComponent },
];

const NOW = new Date('2026-06-15T12:00:00Z');

describe('OverviewComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  const byTestId = (el: HTMLElement, id: string): HTMLElement | null =>
    el.querySelector(`[data-testid="${id}"]`);

  async function open(records: ReturnType<typeof buildRecord>[]): Promise<HTMLElement> {
    const harness = await RouterTestingHarness.create('/overview');
    http.expectOne('/api/retirement/summary').flush(summarize(records, NOW));
    await harness.fixture.whenStable();
    harness.detectChanges();
    return harness.routeNativeElement as HTMLElement;
  }

  it('shows the totals of the summary in the KPI tiles', async () => {
    const el = await open([
      buildRecord({
        id: 'sv',
        contractType: 'STATUTORY_PENSION',
        figures: { projectedMonthly: '2200.00' },
      }),
      buildRecord({
        id: 'ri',
        figures: {
          guaranteedMonthly: '100.00',
          expectedMonthly: '150.00',
          contributionMonthly: '60.00',
        },
      }),
    ]);
    expect(byTestId(el, 'retirement-kpi-expected')?.textContent).toMatch(/2[.,\s]?350/);
    expect(byTestId(el, 'retirement-kpi-guaranteed')?.textContent).toMatch(/100/);
    expect(byTestId(el, 'retirement-kpi-savings')?.textContent).toMatch(/60/);
    expect(byTestId(el, 'retirement-overview-difference')?.textContent).toMatch(/2[.,\s]?250/);
    expect(byTestId(el, 'retirement-overview-empty')).toBeNull();
  });

  it('lists entry rows per pillar and hints for empty pillars', async () => {
    const el = await open([buildRecord({ id: 'ri' })]);
    expect(byTestId(el, 'retirement-overview-row-ri')).not.toBeNull();
    expect(byTestId(el, 'retirement-overview-pillar-empty-statutory')).not.toBeNull();
    expect(byTestId(el, 'retirement-overview-pillar-empty-occupational')).not.toBeNull();
    expect(byTestId(el, 'retirement-overview-pillar-empty-private')).toBeNull();
  });

  it('shows the empty state without records', async () => {
    const el = await open([]);
    expect(byTestId(el, 'retirement-overview-empty')).not.toBeNull();
    for (const id of [
      'retirement-kpi-expected',
      'retirement-kpi-guaranteed',
      'retirement-kpi-savings',
      'retirement-kpi-start',
      'retirement-overview-bar',
      'retirement-overview-pillar-statutory',
      'retirement-overview-capital-note',
    ]) {
      expect(byTestId(el, id)).toBeNull();
    }
  });

  it('flags outdated and incomplete entries', async () => {
    const el = await open([
      buildRecord({ id: 'old', statementDate: '2024-01-01' }),
      buildRecord({ id: 'inc', figures: { currentValue: '1000.00' } }),
    ]);
    expect(byTestId(el, 'retirement-overview-outdated')).not.toBeNull();
    expect(byTestId(el, 'retirement-overview-incomplete')).not.toBeNull();
    expect(
      byTestId(el, 'retirement-overview-row-old')?.querySelector(
        '[data-testid="retirement-badge-outdated"]',
      ),
    ).not.toBeNull();
  });

  it('notes contracts that start earlier than the statutory pension', async () => {
    const el = await open([
      buildRecord({ id: 'sv', contractType: 'STATUTORY_PENSION', payoutStart: '2056-03-01' }),
      buildRecord({ id: 'ri', payoutStart: '2050-01-01' }),
    ]);
    expect(byTestId(el, 'retirement-kpi-start-earlier')).not.toBeNull();
  });

  it('shows an error when loading fails', async () => {
    const harness = await RouterTestingHarness.create('/overview');
    http.expectOne('/api/retirement/summary').flush('x', { status: 500, statusText: 'err' });
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(
      byTestId(harness.routeNativeElement as HTMLElement, 'retirement-overview-error'),
    ).not.toBeNull();
  });
});
