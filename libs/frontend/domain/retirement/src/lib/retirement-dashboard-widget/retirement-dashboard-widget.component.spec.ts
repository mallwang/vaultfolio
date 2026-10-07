import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { summarize } from '@vaultfolio/retirement';
import { buildRecord } from '@vaultfolio/retirement/testing';
import { RetirementDashboardWidgetComponent } from './retirement-dashboard-widget.component';

const NOW = new Date('2026-06-15T12:00:00Z');

describe('RetirementDashboardWidgetComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  const byTestId = (el: HTMLElement, id: string): HTMLElement | null =>
    el.querySelector(`[data-testid="${id}"]`);

  function render(
    respond: (req: ReturnType<HttpTestingController['expectOne']>) => void,
    expand = false,
  ) {
    const fixture = TestBed.createComponent(RetirementDashboardWidgetComponent);
    fixture.detectChanges();
    respond(http.expectOne('/api/retirement/summary'));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    if (expand) {
      byTestId(el, 'retirement-widget-toggle')?.click();
      fixture.detectChanges();
    }
    return el;
  }

  it('shows the same figures as the service summary', () => {
    const records = [
      buildRecord({
        id: 'sv',
        contractType: 'STATUTORY_PENSION',
        figures: { projectedMonthly: '2200.00' },
        payoutStart: '2056-03-01',
      }),
      buildRecord({
        id: 'ri',
        figures: {
          guaranteedMonthly: '100.00',
          expectedMonthly: '150.00',
          contributionMonthly: '60.00',
        },
      }),
    ];
    const summary = summarize(records, NOW);
    const el = render((req) => req.flush(summary), true);
    expect(byTestId(el, 'retirement-widget-toggle')).not.toBeNull();
    expect(byTestId(el, 'retirement-widget-expected')?.textContent).toMatch(/2[.,]?350/);
    expect(byTestId(el, 'retirement-widget-guaranteed')?.textContent).toMatch(/100/);
    expect(byTestId(el, 'retirement-widget-savings')?.textContent).toMatch(/60/);
    expect(byTestId(el, 'retirement-widget-start')?.textContent).toMatch(/2056/);
    expect(byTestId(el, 'retirement-widget-open')?.getAttribute('href')).toBe('/app/retirement');
  });

  it('shows an "n outdated" badge', () => {
    const el = render(
      (req) => req.flush(summarize([buildRecord({ statementDate: '2024-01-01' })], NOW)),
      true,
    );
    expect(byTestId(el, 'retirement-widget-outdated')?.textContent).toContain('1');
  });

  it('shows the empty variant linking to the area', () => {
    const el = render((req) => req.flush(summarize([], NOW)));
    expect(byTestId(el, 'retirement-widget-empty')?.getAttribute('href')).toBe('/app/retirement');
    expect(byTestId(el, 'retirement-widget-expected')).toBeNull();
  });

  it('degrades gracefully on 503 RETIREMENT_UNAVAILABLE', () => {
    const el = render((req) =>
      req.flush({ error: 'RETIREMENT_UNAVAILABLE' }, { status: 503, statusText: 'Unavailable' }),
    );
    expect(byTestId(el, 'retirement-widget-unavailable')).not.toBeNull();
    expect(byTestId(el, 'retirement-widget-open')).toBeNull();
  });
});
