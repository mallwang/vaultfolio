import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  type EarningsTables,
  MONTH_GRID_METRICS,
  type MonthGridMetric,
  type TaxYearRow,
} from '@vaultfolio/api-contract';
import { SelectModule } from 'primeng/select';
import { I18nService, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { EarningsFilterStore } from '../earnings-area/earnings-filter.store';
import { EarningsService } from '../earnings.service';
import { formatMoney, formatPercent, monthName } from '../earnings-format';

const METRIC_LABEL: Record<MonthGridMetric, string> = {
  gross: 'earnings.terms.gross',
  regular: 'earnings.terms.regular',
  bonus: 'earnings.terms.bonusOneOff',
  net: 'earnings.terms.net',
  taxes: 'earnings.terms.taxes',
  social: 'earnings.terms.social',
  payout: 'earnings.terms.payout',
};

/** Columns of the taxes-per-year table that can be sorted (not employer or months). */
export type TaxSortKey = Exclude<
  keyof TaxYearRow,
  'employerId' | 'employerLabel' | 'monthsEmployed'
>;
export interface TaxSort {
  key: TaxSortKey;
  direction: 'asc' | 'desc';
}

const TAX_COLUMNS: { key: TaxSortKey; labelKey: string }[] = [
  { key: 'gross', labelKey: 'earnings.terms.gross' },
  { key: 'bonus', labelKey: 'earnings.tables.ofWhichBonus' },
  { key: 'taxGross', labelKey: 'earnings.terms.taxGross' },
  { key: 'wageTax', labelKey: 'earnings.terms.wageTax' },
  { key: 'soli', labelKey: 'earnings.tables.soliShort' },
  { key: 'churchTax', labelKey: 'earnings.terms.churchTax' },
  { key: 'health', labelKey: 'earnings.tables.healthShort' },
  { key: 'care', labelKey: 'earnings.tables.careShort' },
  { key: 'pension', labelKey: 'earnings.tables.pensionShort' },
  { key: 'unemployment', labelKey: 'earnings.tables.unemploymentShort' },
  { key: 'taxRatio', labelKey: 'earnings.tables.taxesPct' },
  { key: 'socialRatio', labelKey: 'earnings.tables.socialPct' },
];

/**
 * Rows ordered by the chosen column (amounts and ratios compare numerically, the year as a number);
 * without a sort the API order (newest year first) is kept. Ties keep that order.
 */
export function sortTaxRows(rows: readonly TaxYearRow[], sort: TaxSort | null): TaxYearRow[] {
  if (!sort) return [...rows];
  const factor = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => factor * (Number(a[sort.key]) - Number(b[sort.key])));
}

export interface GridCell {
  period: string;
  value: string | null;
  bonus: boolean;
  missing: boolean;
}

export interface GridRow {
  year: number;
  cells: GridCell[];
  sum: string;
}

/** Year × month rows of one metric; exported for exact-value tests. */
export function gridRows(tables: EarningsTables, metric: MonthGridMetric): GridRow[] {
  const values = tables.monthGrid.metrics[metric] ?? {};
  const bonus = new Set(tables.monthGrid.bonusPeriods);
  const missing = new Set(tables.monthGrid.missingPeriods);
  return tables.monthGrid.years.map((year) => {
    const cells = Array.from({ length: 12 }, (_, i) => {
      const period = `${year}-${String(i + 1).padStart(2, '0')}`;
      return {
        period,
        value: values[period] ?? null,
        bonus: bonus.has(period),
        missing: missing.has(period),
      };
    });
    // Integer cents keep the row sum exact.
    const cents = cells.reduce(
      (total, c) => total + (c.value ? Math.round(Number(c.value) * 100) : 0),
      0,
    );
    return { year, cells, sum: (cents / 100).toFixed(2) };
  });
}

/**
 * Tables tab (FR-030–FR-032): the year × month grid (cells open the month detail), all taxes and
 * contributions per year, and the wage-tax certificates with a sum row. Wide tables scroll inside
 * their own container, never the page.
 */
@Component({
  selector: 'app-earnings-tables',
  imports: [FormsModule, SelectModule, TranslatePipe],
  template: `
    <section class="panel">
      <div class="head">
        <div>
          <h2>{{ 'earnings.tables.gridTitle' | translate }}</h2>
          <p class="muted">{{ 'earnings.tables.gridSub' | translate }}</p>
        </div>
        <label class="metric">
          <span class="muted">{{ 'earnings.tables.show' | translate }}</span>
          <p-select
            [options]="metricOptions()"
            optionLabel="label"
            optionValue="value"
            [ngModel]="metric()"
            (ngModelChange)="metric.set($event)"
            data-testid="earnings-grid-metric"
          />
        </label>
      </div>
      <div class="scroll">
        <table class="grid" data-testid="earnings-month-grid">
          <thead>
            <tr>
              <th scope="col">{{ 'earnings.tables.year' | translate }}</th>
              @for (m of monthHeaders(); track $index) {
                <th scope="col" class="num">{{ m }}</th>
              }
              <th scope="col" class="num">{{ 'earnings.tables.sum' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of grid(); track row.year) {
              <tr>
                <th scope="row">{{ row.year }}</th>
                @for (cell of row.cells; track cell.period) {
                  <td class="num" [attr.data-testid]="'earnings-grid-cell-' + cell.period">
                    @if (cell.value !== null) {
                      <button type="button" class="cell" (click)="openMonth(cell.period)">
                        {{ whole(cell.value) }}
                        @if (cell.bonus) {
                          <span class="dot" aria-hidden="true"></span>
                        }
                      </button>
                    } @else if (cell.missing) {
                      <span class="missing" [attr.title]="'earnings.tables.missing' | translate"
                        >!</span
                      >
                    } @else {
                      <span class="muted">–</span>
                    }
                  </td>
                }
                <td class="num strong">{{ whole(row.sum) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2>{{ 'earnings.tables.taxTitle' | translate }}</h2>
      <p class="muted">{{ 'earnings.tables.taxSub' | translate }}</p>
      <div class="scroll">
        <table data-testid="earnings-taxes-table">
          <thead>
            <tr>
              <th scope="col" [attr.aria-sort]="ariaSort('year')">
                <button
                  type="button"
                  class="sort"
                  data-testid="earnings-taxes-sort-year"
                  (click)="sortBy('year')"
                >
                  {{ 'earnings.tables.year' | translate
                  }}<span aria-hidden="true">{{ arrow('year') }}</span>
                </button>
              </th>
              <th scope="col">{{ 'earnings.tables.employer' | translate }}</th>
              <th scope="col" class="num">{{ 'earnings.tables.months' | translate }}</th>
              @for (column of taxColumns; track column.key) {
                <th scope="col" class="num" [attr.aria-sort]="ariaSort(column.key)">
                  <button
                    type="button"
                    class="sort"
                    [attr.data-testid]="'earnings-taxes-sort-' + column.key"
                    (click)="sortBy(column.key)"
                  >
                    {{ column.labelKey | translate
                    }}<span aria-hidden="true">{{ arrow(column.key) }}</span>
                  </button>
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of taxRows(); track row.year + row.employerId) {
              <tr [attr.data-testid]="'earnings-taxes-row-' + row.year + '-' + row.employerId">
                <th scope="row">{{ row.year }}</th>
                <td>{{ row.employerLabel }}</td>
                <td class="num">{{ row.monthsEmployed }}</td>
                <td class="num">{{ money(row.gross) }}</td>
                <td class="num">{{ money(row.bonus) }}</td>
                <td class="num">{{ money(row.taxGross) }}</td>
                <td class="num">{{ money(row.wageTax) }}</td>
                <td class="num">{{ money(row.soli) }}</td>
                <td class="num">{{ money(row.churchTax) }}</td>
                <td class="num">{{ money(row.health) }}</td>
                <td class="num">{{ money(row.care) }}</td>
                <td class="num">{{ money(row.pension) }}</td>
                <td class="num">{{ money(row.unemployment) }}</td>
                <td class="num">{{ percent(row.taxRatio) }}</td>
                <td class="num">{{ percent(row.socialRatio) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2>{{ 'earnings.tables.certsTitle' | translate }}</h2>
      <p class="muted">{{ 'earnings.tables.certsSub' | translate }}</p>
      @if ((tables()?.certificates ?? []).length === 0) {
        <p class="muted" data-testid="earnings-certificates-empty">
          {{ 'earnings.tables.noCerts' | translate }}
        </p>
      } @else {
        <div class="scroll">
          <table data-testid="earnings-certificates-table">
            <thead>
              <tr>
                <th scope="col">{{ 'earnings.tables.year' | translate }}</th>
                <th scope="col">{{ 'earnings.tables.employer' | translate }}</th>
                <th scope="col" class="num">{{ 'earnings.tables.certGross' | translate }}</th>
                <th scope="col" class="num">{{ 'earnings.terms.wageTax' | translate }}</th>
                <th scope="col" class="num">{{ 'earnings.tables.soliShort' | translate }}</th>
                <th scope="col" class="num">{{ 'earnings.terms.churchTax' | translate }}</th>
                <th scope="col">{{ 'earnings.tables.source' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (cert of tables()?.certificates ?? []; track cert.id) {
                <tr [attr.data-testid]="'earnings-certificate-row-' + cert.id">
                  <th scope="row">{{ cert.year }}</th>
                  <td>{{ cert.employerLabel }}</td>
                  <td class="num">{{ money(cert.amounts.grossWage) }}</td>
                  <td class="num">{{ money(cert.amounts.wageTax) }}</td>
                  <td class="num">{{ money(cert.amounts.soli) }}</td>
                  <td class="num">{{ money(cert.amounts.churchTax) }}</td>
                  <td class="file">{{ cert.fileName }}</td>
                </tr>
              }
              <tr class="sum" data-testid="earnings-certificates-sum">
                <th scope="row" colspan="2">{{ 'earnings.tables.sum' | translate }}</th>
                <td class="num">{{ money(certificateSums().grossWage) }}</td>
                <td class="num">{{ money(certificateSums().wageTax) }}</td>
                <td class="num">{{ money(certificateSums().soli) }}</td>
                <td class="num">{{ money(certificateSums().churchTax) }}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .panel {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      min-width: 0;
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: 0.75rem;
    }
    h2 {
      margin: 0;
      font-size: 1.1rem;
    }
    .muted {
      margin: 0;
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
    }
    .metric {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .scroll {
      overflow-x: auto;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
      background: var(--p-content-background);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8125rem;
    }
    th,
    td {
      padding: 0.4rem 0.6rem;
      text-align: left;
      white-space: nowrap;
      border-bottom: 1px solid var(--p-content-border-color);
    }
    thead th {
      font-weight: 600;
    }
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .sort {
      padding: 0;
      border: none;
      background: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .sort:hover {
      color: var(--p-primary-color);
    }
    .strong,
    .sum th,
    .sum td {
      font-weight: 600;
    }
    .file {
      white-space: normal;
      overflow-wrap: anywhere;
    }
    .cell {
      position: relative;
      padding: 0 0.5rem 0 0;
      border: none;
      background: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .cell:hover {
      color: var(--p-primary-color);
      text-decoration: underline;
    }
    .dot {
      position: absolute;
      top: 0;
      right: 0;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--p-red-600);
    }
    .missing {
      color: var(--p-red-600);
      font-weight: 700;
    }
  `,
})
export class EarningsTablesComponent {
  private readonly api = inject(EarningsService);
  private readonly store = inject(EarningsFilterStore);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly tables = signal<EarningsTables | null>(null);
  protected readonly metric = signal<MonthGridMetric>('gross');
  protected readonly taxColumns = TAX_COLUMNS;
  protected readonly taxSort = signal<TaxSort | null>(null);

  protected readonly taxRows = computed(() =>
    sortTaxRows(this.tables()?.taxesPerYear ?? [], this.taxSort()),
  );

  protected readonly metricOptions = computed(() => {
    this.i18n.language();
    return MONTH_GRID_METRICS.map((value) => ({
      label: this.i18n.translate(METRIC_LABEL[value]),
      value,
    }));
  });

  protected readonly monthHeaders = computed(() => {
    const lang = this.i18n.language();
    return Array.from({ length: 12 }, (_, i) => monthName(i + 1, lang));
  });

  protected readonly grid = computed(() => {
    const tables = this.tables();
    return tables ? gridRows(tables, this.metric()) : [];
  });

  protected readonly certificateSums = computed(() => {
    const sums = { grossWage: 0, wageTax: 0, soli: 0, churchTax: 0 };
    for (const cert of this.tables()?.certificates ?? []) {
      for (const key of Object.keys(sums) as (keyof typeof sums)[])
        sums[key] += Math.round(Number(cert.amounts[key]) * 100);
    }
    return Object.fromEntries(
      Object.entries(sums).map(([k, v]) => [k, (v / 100).toFixed(2)]),
    ) as Record<keyof typeof sums, string>;
  });

  constructor() {
    effect((onCleanup) => {
      const { employerId } = this.store.query();
      const subscription = this.api
        .tables(employerId)
        .subscribe({ next: (tables) => this.tables.set(tables) });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  /** First click sorts descending (largest/newest first), the second ascending, the third resets. */
  protected sortBy(key: TaxSortKey): void {
    const current = this.taxSort();
    if (current?.key !== key) this.taxSort.set({ key, direction: 'desc' });
    else this.taxSort.set(current.direction === 'desc' ? { key, direction: 'asc' } : null);
  }

  protected ariaSort(key: TaxSortKey): 'ascending' | 'descending' | 'none' {
    const sort = this.taxSort();
    if (sort?.key !== key) return 'none';
    return sort.direction === 'asc' ? 'ascending' : 'descending';
  }

  protected arrow(key: TaxSortKey): string {
    const sort = this.taxSort();
    if (sort?.key !== key) return '';
    return sort.direction === 'asc' ? ' ▲' : ' ▼';
  }

  protected money(value: string): string {
    return formatMoney(value, this.i18n.language());
  }

  protected whole(value: string): string {
    return formatMoney(value, this.i18n.language(), { whole: true });
  }

  protected percent(ratio: string): string {
    return formatPercent(ratio, this.i18n.language());
  }

  protected openMonth(period: string): void {
    void this.router.navigate(['../overview'], {
      relativeTo: this.route,
      queryParams: { month: period },
    });
  }
}
