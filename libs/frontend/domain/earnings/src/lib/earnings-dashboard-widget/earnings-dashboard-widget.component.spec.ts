import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import type { EarningsOverview, LatestYearFigures, YearlyPoint } from '@vaultfolio/api-contract';
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

function yearly(year: number, gross: string): YearlyPoint {
  return {
    year,
    monthsEmployed: 12,
    gross,
    regular: gross,
    bonus: '0.00',
    net: '0.00',
    taxes: '0.00',
    social: '0.00',
    taxRatio: '0',
    socialRatio: '0',
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
    expand = false,
  ): HTMLElement {
    const fixture = TestBed.createComponent(EarningsDashboardWidgetComponent);
    fixture.detectChanges();
    flush(http.expectOne('/api/earnings/overview'));
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    if (expand) {
      root.querySelector<HTMLElement>('[data-testid="earnings-widget-toggle"]')?.click();
      fixture.detectChanges();
    }
    return root;
  }

  it('shows gross, net with its change and the net ratio of the latest year', () => {
    const root = render((req) => req.flush(OVERVIEW), true);

    expect(root.textContent).toContain('2026 · Jan–Sep');
    expect(root.querySelector('[data-testid="earnings-widget-gross"]')?.textContent).toContain(
      '€45,000',
    );
    expect(root.querySelector('[data-testid="earnings-widget-net"]')?.textContent).toContain(
      '+€1,000',
    );
    expect(root.querySelector('[data-testid="earnings-widget-netRatio"]')?.textContent).toContain(
      '61.6%',
    );
    expect(root.querySelector('[data-testid="earnings-widget-open"]')?.getAttribute('href')).toBe(
      '/app/earnings',
    );
  });

  it('shows the yearly gross bars, the growth between complete years and the monthly average', () => {
    const root = render(
      (req) =>
        req.flush({
          ...OVERVIEW,
          yearly: [yearly(2024, '80000.00'), yearly(2025, '86400.00'), yearly(2026, '45000.00')],
          dataCheckIssues: 2,
        }),
      true,
    );

    expect(root.querySelectorAll('[data-testid^="earnings-widget-bar-"]')).toHaveLength(3);
    // The running year is the default readout and flagged as partial.
    expect(root.querySelector('[data-testid="earnings-widget-readout"]')?.textContent).toContain(
      '2026 · Gross €45,000 (Jan–Sep)',
    );
    expect(root.querySelector('[data-testid="earnings-widget-growth"]')?.textContent).toContain(
      'Growth 2024→2025',
    );
    expect(root.querySelector('[data-testid="earnings-widget-growth"]')?.textContent).toContain(
      '+8.0%',
    );
    expect(root.querySelector('[data-testid="earnings-widget-permonth"]')?.textContent).toContain(
      '€5,000',
    );
    expect(root.querySelector('[data-testid="earnings-widget-issues"]')?.getAttribute('href')).toBe(
      '/app/earnings/check',
    );
  });

  it('shows the stats without a details toggle', () => {
    const root = render((req) => req.flush(OVERVIEW));
    expect(root.querySelector('[data-testid="earnings-widget-netRatio"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="earnings-widget-toggle"]')).toBeNull();
  });

  it('updates the readout for the hovered bar', () => {
    const fixture = TestBed.createComponent(EarningsDashboardWidgetComponent);
    fixture.detectChanges();
    http
      .expectOne('/api/earnings/overview')
      .flush({ ...OVERVIEW, yearly: [yearly(2025, '86400.00'), yearly(2026, '45000.00')] });
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    root
      .querySelector('[data-testid="earnings-widget-bar-2025"]')
      ?.dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();
    expect(root.querySelector('[data-testid="earnings-widget-readout"]')?.textContent).toContain(
      '2025 · Gross €86,400',
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
