import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { DataCheckRow } from '@vaultfolio/api-contract';
import { EarningsFilterStore } from '../earnings-area/earnings-filter.store';
import { fakeFilterStore } from '../../testing/fake-filter-store';
import { EarningsDataCheckComponent } from './earnings-data-check.component';

const ROWS: DataCheckRow[] = [
  {
    year: 2019,
    employerId: 'e1',
    employerLabel: 'Brightline Software GmbH',
    ytd: {
      status: 'DIFFERS',
      compared: 9,
      differences: [
        { field: 'wageTax', expected: '1200.00', actual: '1150.00', difference: '-50.00' },
        { field: 'health', expected: '800.00', actual: '812.50', difference: '12.50' },
      ],
    },
    certificate: { status: 'NOT_AVAILABLE', compared: 0, differences: [] },
    completeness: { status: 'MISSING', missingPeriods: ['2019-03'] },
    lateCorrections: [],
  },
  {
    year: 2022,
    employerId: 'e1',
    employerLabel: 'Brightline Software GmbH',
    ytd: { status: 'MATCH', compared: 9, differences: [] },
    certificate: { status: 'MATCH', compared: 8, differences: [] },
    completeness: { status: 'COMPLETE', missingPeriods: [] },
    lateCorrections: [{ period: '2022-04', issued: '2023-02' }],
  },
];

describe('EarningsDataCheckComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: EarningsFilterStore, useValue: fakeFilterStore() },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  it('shows actionable hints and a row per employer and year', () => {
    const fixture = TestBed.createComponent(EarningsDataCheckComponent);
    fixture.detectChanges();
    http.expectOne('/api/earnings/data-check').flush(ROWS);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    const hints =
      root.querySelector('[data-testid="earnings-data-check-hints"]')?.textContent ?? '';
    expect(hints).toContain('Import the missing payslips for Mar 2019 to resolve this.');
    expect(hints).toContain('Values differ for 2019: Wage tax, Health insurance.');

    const bad =
      root.querySelector('[data-testid="earnings-data-check-row-e1-2019"]')?.textContent ?? '';
    expect(bad).toContain('2 values differ');
    expect(bad).toContain('Wage tax: expected');
    expect(bad).toContain('difference -€50.00');
    expect(bad).toContain('+€12.50');
    expect(bad).toContain('not available');
    expect(bad).toContain('Mar 2019 missing');

    const good =
      root.querySelector('[data-testid="earnings-data-check-row-e1-2022"]')?.textContent ?? '';
    expect(good).toContain('9 values match');
    expect(good).toContain('8 values match');
    expect(good).toContain('complete');
    expect(good).toContain('1 correction issued after the last payslip excluded (Apr 2022)');
  });

  it('shows a year with only a certificate as a note, not as an issue', () => {
    const fixture = TestBed.createComponent(EarningsDataCheckComponent);
    fixture.detectChanges();
    http.expectOne('/api/earnings/data-check').flush([
      {
        year: 2025,
        employerId: 'e1',
        employerLabel: 'Brightline Software GmbH',
        ytd: { status: 'NOT_AVAILABLE', compared: 0, differences: [] },
        certificate: { status: 'NOT_COMPARABLE', compared: 0, differences: [] },
        completeness: { status: 'NO_PAYSLIPS', missingPeriods: [] },
        lateCorrections: [],
      } satisfies DataCheckRow,
    ]);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="earnings-data-check-hints"]')).toBeNull();
    expect(root.querySelector('[data-testid="earnings-data-check-ok"]')).toBeNull();
    expect(root.querySelector('[data-testid="earnings-data-check-notes"]')?.textContent).toContain(
      'No payslips imported for 2025. Import the payslips to check the values.',
    );
    const row =
      root.querySelector('[data-testid="earnings-data-check-row-e1-2025"]')?.textContent ?? '';
    expect(row).toContain('available, nothing to compare');
    expect(row).toContain('no payslips');
  });

  it('confirms when all checks pass', () => {
    const fixture = TestBed.createComponent(EarningsDataCheckComponent);
    fixture.detectChanges();
    http.expectOne('/api/earnings/data-check').flush([ROWS[1]]);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="earnings-data-check-ok"]'),
    ).not.toBeNull();
  });
});
