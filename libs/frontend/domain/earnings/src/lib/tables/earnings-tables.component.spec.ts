import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import type { EarningsTables } from '@vaultfolio/api-contract';
import { EarningsFilterStore } from '../earnings-area/earnings-filter.store';
import { fakeFilterStore } from '../../testing/fake-filter-store';
import { EarningsTablesComponent, gridRows, sortTaxRows } from './earnings-tables.component';

const TABLES: EarningsTables = {
  monthGrid: {
    years: [2025],
    metrics: {
      gross: { '2025-01': '5000.00', '2025-02': '5000.00', '2025-04': '8000.00' },
      regular: { '2025-01': '5000.00', '2025-02': '5000.00', '2025-04': '5000.00' },
      bonus: { '2025-04': '3000.00' },
      net: { '2025-01': '3100.10', '2025-02': '3100.10', '2025-04': '4700.01' },
      taxes: {},
      social: {},
      payout: {},
    },
    bonusPeriods: ['2025-04'],
    missingPeriods: ['2025-03'],
  },
  taxesPerYear: [
    {
      year: 2025,
      employerId: 'e1',
      employerLabel: 'Brightline Software GmbH',
      monthsEmployed: 3,
      gross: '18000.00',
      bonus: '3000.00',
      taxGross: '18000.00',
      wageTax: '3000.00',
      soli: '0.00',
      churchTax: '240.00',
      health: '1400.00',
      care: '300.00',
      pension: '1674.00',
      unemployment: '234.00',
      taxRatio: '0.1800',
      socialRatio: '0.2004',
    },
  ],
  certificates: [
    {
      id: 'c1',
      year: 2025,
      employerId: 'e1',
      employerLabel: 'Brightline Software GmbH',
      fileName: '2025_Lohnsteuerbescheinigung.pdf',
      amounts: {
        grossWage: '55000.00',
        wageTax: '8800.00',
        soli: '0.00',
        churchTax: '704.00',
        multiYearComp: '0.00',
        multiYearWageTax: '0.00',
        multiYearSoli: '0.00',
        multiYearChurchTax: '0.00',
        pensionEmployer: '5115.00',
        pensionEmployee: '5115.00',
        employerSubsidyHealth: '0.00',
        employerSubsidyCare: '0.00',
        health: '4400.00',
        care: '990.00',
        unemployment: '715.00',
      },
    },
  ],
};

describe('gridRows', () => {
  it('builds 12 month cells per year with bonus/missing flags and an exact row sum', () => {
    const [row] = gridRows(TABLES, 'net');

    expect(row.cells).toHaveLength(12);
    expect(row.cells[0]).toEqual({
      period: '2025-01',
      value: '3100.10',
      bonus: false,
      missing: false,
    });
    expect(row.cells[2]).toMatchObject({ value: null, missing: true });
    expect(row.cells[3]).toMatchObject({ bonus: true });
    expect(row.sum).toBe('10900.21');
  });
});

describe('EarningsTablesComponent', () => {
  let http: HttpTestingController;
  const store = fakeFilterStore();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: EarningsFilterStore, useValue: store },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  it('renders the grid, taxes per year and certificates with a sum row; cells open the month detail', async () => {
    const fixture = TestBed.createComponent(EarningsTablesComponent);
    fixture.detectChanges();
    http.expectOne('/api/earnings/tables').flush(TABLES);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const cell = (id: string) => root.querySelector(`[data-testid="earnings-grid-cell-${id}"]`);

    expect(cell('2025-01')?.textContent).toContain('€5,000');
    expect(cell('2025-03')?.textContent).toContain('!');
    expect(cell('2025-04')?.querySelector('.dot')).not.toBeNull();
    expect(cell('2025-05')?.textContent).toContain('–');
    expect(root.querySelector('[data-testid="earnings-taxes-row-2025-e1"]')?.textContent).toContain(
      '18.0%',
    );
    expect(root.querySelector('[data-testid="earnings-certificates-sum"]')?.textContent).toContain(
      '€55,000.00',
    );

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    (cell('2025-04')?.querySelector('button') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith(
      ['../overview'],
      expect.objectContaining({ queryParams: { month: '2025-04' } }),
    );
  });

  it('reloads with the selected employer', () => {
    const fixture = TestBed.createComponent(EarningsTablesComponent);
    fixture.detectChanges();
    http.expectOne('/api/earnings/tables').flush(TABLES);

    store.employerId.set('e1');
    fixture.detectChanges();
    const filtered = http.expectOne('/api/earnings/tables?employer=e1');
    expect(filtered.request.params.get('employer')).toBe('e1');
    filtered.flush(TABLES);
    store.employerId.set(null);
  });
});

describe('taxes per year sorting', () => {
  const base = TABLES.taxesPerYear[0];
  const row = (year: number, employerId: string, gross: string, taxRatio: string) => ({
    ...base,
    year,
    employerId,
    gross,
    taxRatio,
  });
  const rows = [
    row(2026, 'a', '900.00', '0.2500'),
    row(2025, 'b', '10000.00', '0.1000'),
    row(2024, 'c', '2000.00', '0.2500'),
  ];

  it('keeps the API order without a sort', () => {
    expect(sortTaxRows(rows, null).map((r) => r.employerId)).toEqual(['a', 'b', 'c']);
  });

  it('compares amounts numerically, not as text', () => {
    expect(sortTaxRows(rows, { key: 'gross', direction: 'desc' }).map((r) => r.gross)).toEqual([
      '10000.00',
      '2000.00',
      '900.00',
    ]);
    expect(sortTaxRows(rows, { key: 'gross', direction: 'asc' }).map((r) => r.gross)).toEqual([
      '900.00',
      '2000.00',
      '10000.00',
    ]);
  });

  it('sorts by year and keeps the original order for ties', () => {
    expect(sortTaxRows(rows, { key: 'year', direction: 'asc' }).map((r) => r.year)).toEqual([
      2024, 2025, 2026,
    ]);
    expect(
      sortTaxRows(rows, { key: 'taxRatio', direction: 'desc' }).map((r) => r.employerId),
    ).toEqual(['a', 'c', 'b']);
  });

  it('does not mutate its input', () => {
    const copy = JSON.stringify(rows);
    sortTaxRows(rows, { key: 'gross', direction: 'asc' });
    expect(JSON.stringify(rows)).toBe(copy);
  });
});

describe('taxes per year table headers', () => {
  it('sorts by a clicked value column (desc, asc, reset) and offers no sort for employer or months', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: EarningsFilterStore, useValue: fakeFilterStore() },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(EarningsTablesComponent);
    fixture.detectChanges();
    const base = TABLES.taxesPerYear[0];
    http.expectOne('/api/earnings/tables').flush({
      ...TABLES,
      taxesPerYear: [
        { ...base, year: 2026, employerId: 'a', gross: '900.00' },
        { ...base, year: 2025, employerId: 'b', gross: '10000.00' },
        { ...base, year: 2024, employerId: 'c', gross: '2000.00' },
      ],
    });
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const order = () =>
      [...root.querySelectorAll('[data-testid^="earnings-taxes-row-"]')].map((r) =>
        r.getAttribute('data-testid')?.replace('earnings-taxes-row-', ''),
      );
    const sort = (key: string) =>
      root.querySelector(`[data-testid="earnings-taxes-sort-${key}"]`) as HTMLButtonElement;
    const th = (key: string) => sort(key).closest('th') as HTMLElement;

    expect(order()).toEqual(['2026-a', '2025-b', '2024-c']);
    expect(th('gross').getAttribute('aria-sort')).toBe('none');

    sort('gross').click();
    fixture.detectChanges();
    expect(order()).toEqual(['2025-b', '2024-c', '2026-a']);
    expect(th('gross').getAttribute('aria-sort')).toBe('descending');

    sort('gross').click();
    fixture.detectChanges();
    expect(order()).toEqual(['2026-a', '2024-c', '2025-b']);
    expect(th('gross').getAttribute('aria-sort')).toBe('ascending');

    sort('gross').click();
    fixture.detectChanges();
    expect(order()).toEqual(['2026-a', '2025-b', '2024-c']);

    const sortable = [...root.querySelectorAll('[data-testid^="earnings-taxes-sort-"]')].map((b) =>
      b.getAttribute('data-testid')?.replace('earnings-taxes-sort-', ''),
    );
    expect(sortable).toHaveLength(13);
    expect(sortable).not.toContain('employerLabel');
    expect(sortable).not.toContain('monthsEmployed');
    const taxTable = root.querySelector('[data-testid="earnings-taxes-table"]') as HTMLElement;
    const headers = [...taxTable.querySelectorAll('thead th')];
    expect(headers[1].querySelector('button')).toBeNull();
    expect(headers[2].querySelector('button')).toBeNull();
  });
});
