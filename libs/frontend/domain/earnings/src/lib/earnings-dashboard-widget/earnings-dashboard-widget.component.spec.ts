import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import type { EarningsOverview, LatestYearFigures } from '@vaultfolio/api-contract';
import { EarningsDashboardWidgetComponent } from './earnings-dashboard-widget.component';

function figures(partial: Partial<LatestYearFigures> = {}): LatestYearFigures {
  return {
    gross: '45000.00',
    net: '27720.00',
    taxes: '8280.00',
    social: '9000.00',
    bonus: '0.00',
    netRatio: '0.6160',
    ...partial,
  };
}

const OVERVIEW: EarningsOverview = {
  hasData: true,
  career: [],
  latestYear: {
    year: 2026,
    months: 9,
    comparedMonths: [1, 9],
    current: figures(),
    previous: figures({ net: '26720.00' }),
  },
  yearly: [],
  monthly: [],
  employerChanges: [],
  dataCheckIssues: 0,
};

describe('EarningsDashboardWidgetComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  function render(
    flush: (req: ReturnType<HttpTestingController['expectOne']>) => void,
  ): HTMLElement {
    const fixture = TestBed.createComponent(EarningsDashboardWidgetComponent);
    fixture.detectChanges();
    flush(http.expectOne('/api/earnings/overview'));
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows gross, net with its change and the net ratio of the latest year', () => {
    const root = render((req) => req.flush(OVERVIEW));

    expect(root.textContent).toContain('Earnings 2026');
    expect(root.querySelector('[data-testid="earnings-widget-gross"]')?.textContent).toContain(
      '€45,000',
    );
    expect(root.querySelector('[data-testid="earnings-widget-net"]')?.textContent).toContain(
      '+€1,000',
    );
    expect(root.querySelector('[data-testid="earnings-widget-netRatio"]')?.textContent).toContain(
      'Jan–Sep',
    );
    expect(root.querySelector('[data-testid="earnings-widget-open"]')?.getAttribute('href')).toBe(
      '/app/earnings',
    );
  });

  it('renders the empty state compactly', () => {
    const root = render((req) => req.flush({ ...OVERVIEW, hasData: false, latestYear: null }));
    expect(root.querySelector('[data-testid="earnings-widget-empty"]')).not.toBeNull();
  });

  it('renders the unavailable state compactly', () => {
    const root = render((req) =>
      req.flush(
        { error: 'EARNINGS_UNAVAILABLE' },
        { status: 503, statusText: 'Service Unavailable' },
      ),
    );
    expect(root.querySelector('[data-testid="earnings-widget-unavailable"]')).not.toBeNull();
  });
});
