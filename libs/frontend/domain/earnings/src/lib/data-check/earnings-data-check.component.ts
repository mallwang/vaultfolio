import { Component, computed, effect, inject, signal } from '@angular/core';
import type { DataCheckComparison, DataCheckRow } from '@vaultfolio/api-contract';
import { MessageModule } from 'primeng/message';
import { I18nService, IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { EarningsFilterStore } from '../earnings-area/earnings-filter.store';
import { EarningsService } from '../earnings.service';
import { fill, formatMonth, formatMoney } from '../earnings-format';

interface CheckCell {
  ok: boolean | null;
  text: string;
  note?: string;
  /** Differing values, one line each (field, expected, actual, difference). */
  details?: string[];
}

interface EmployerGroup {
  employerId: string;
  label: string;
  rows: { year: number; ytd: CheckCell; certificate: CheckCell; complete: CheckCell }[];
}

/**
 * Data check tab (FR-033): per employer and year — year-to-date totals of the last payslip,
 * the wage-tax certificate and completeness of the months — with actionable hints.
 */
@Component({
  selector: 'app-earnings-data-check',
  imports: [MessageModule, IconComponent, TranslatePipe],
  template: `
    <section class="panel">
      <h2>{{ 'earnings.dataCheck.title' | translate }}</h2>
      <p class="muted">{{ 'earnings.dataCheck.sub' | translate }}</p>

      @if (hints().length > 0) {
        <p-message severity="warn" data-testid="earnings-data-check-hints">
          <ul class="hints">
            @for (hint of hints(); track hint) {
              <li>{{ hint }}</li>
            }
          </ul>
        </p-message>
      }
      @if (notes().length > 0) {
        <p-message severity="info" data-testid="earnings-data-check-notes">
          <ul class="hints">
            @for (note of notes(); track note) {
              <li>{{ note }}</li>
            }
          </ul>
        </p-message>
      }
      @if (hints().length === 0 && notes().length === 0 && rows().length > 0) {
        <p-message severity="success" data-testid="earnings-data-check-ok">{{
          'earnings.dataCheck.allGood' | translate
        }}</p-message>
      }

      @if (!loading() && rows().length === 0) {
        <p class="muted">{{ 'earnings.dataCheck.empty' | translate }}</p>
      }

      @for (group of groups(); track group.employerId) {
        <h3>{{ group.label }}</h3>
        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">{{ 'earnings.dataCheck.year' | translate }}</th>
                <th scope="col">{{ 'earnings.dataCheck.ytd' | translate }}</th>
                <th scope="col">{{ 'earnings.dataCheck.certificate' | translate }}</th>
                <th scope="col">{{ 'earnings.dataCheck.complete' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of group.rows; track row.year) {
                <tr
                  [attr.data-testid]="
                    'earnings-data-check-row-' + group.employerId + '-' + row.year
                  "
                >
                  <th scope="row">{{ row.year }}</th>
                  @for (cell of [row.ytd, row.certificate, row.complete]; track $index) {
                    <td [class]="cell.ok === null ? 'na' : cell.ok ? 'ok' : 'fail'">
                      <span class="cell">
                        <app-icon
                          [name]="cell.ok === null ? 'info' : cell.ok ? 'check-circle' : 'close'"
                        />
                        {{ cell.text }}
                      </span>
                      @if (cell.details) {
                        <ul class="details" [attr.data-testid]="'earnings-data-check-differences'">
                          @for (detail of cell.details; track detail) {
                            <li>{{ detail }}</li>
                          }
                        </ul>
                      }
                      @if (cell.note) {
                        <span class="note">{{ cell.note }}</span>
                      }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      max-width: 1100px;
      margin: 0 auto;
    }
    .panel {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    h2 {
      margin: 0;
      font-size: 1.1rem;
    }
    h3 {
      margin: 0.75rem 0 0;
      font-size: 1rem;
    }
    .muted {
      margin: 0;
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
    }
    .hints {
      margin: 0;
      padding-left: 1.25rem;
    }
    .scroll {
      overflow-x: auto;
    }
    table {
      width: 100%;
      min-width: 36rem;
      border-collapse: collapse;
      font-size: 0.875rem;
    }
    th,
    td {
      padding: 0.5rem 0.75rem;
      text-align: left;
      border-bottom: 1px solid var(--p-content-border-color);
      vertical-align: top;
    }
    .cell {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }
    .details {
      margin: 0.25rem 0 0;
      padding-left: 1.25rem;
      color: var(--p-text-muted-color);
      font-size: 0.8125rem;
    }
    .note {
      display: block;
      margin-top: 0.25rem;
      color: var(--p-text-muted-color);
      font-size: 0.8125rem;
    }
    .ok .cell {
      color: var(--p-green-700);
    }
    .fail .cell {
      color: var(--p-red-700);
    }
    .na .cell {
      color: var(--p-text-muted-color);
    }
    :host-context(.app-dark) .ok .cell {
      color: var(--p-green-400);
    }
    :host-context(.app-dark) .fail .cell {
      color: var(--p-red-400);
    }
  `,
})
export class EarningsDataCheckComponent {
  private readonly api = inject(EarningsService);
  private readonly store = inject(EarningsFilterStore);
  private readonly i18n = inject(I18nService);

  protected readonly rows = signal<DataCheckRow[]>([]);
  protected readonly loading = signal(true);

  protected readonly groups = computed<EmployerGroup[]>(() => {
    const lang = this.i18n.language();
    const groups = new Map<string, EmployerGroup>();
    for (const row of this.rows()) {
      const group = groups.get(row.employerId) ?? {
        employerId: row.employerId,
        label: row.employerLabel,
        rows: [],
      };
      groups.set(row.employerId, group);
      group.rows.push({
        year: row.year,
        ytd: {
          ...this.comparison(row.ytd, lang),
          note: row.lateCorrections.length > 0 ? this.lateNote(row, lang) : undefined,
        },
        certificate: this.comparison(row.certificate, lang),
        complete: this.completeness(row, lang),
      });
    }
    return [...groups.values()];
  });

  /** Informational, not an issue: years with no payslips to check (e.g. only a certificate). */
  protected readonly notes = computed(() => {
    this.i18n.language();
    return this.rows()
      .filter((row) => row.completeness.status === 'NO_PAYSLIPS')
      .map((row) => fill(this.t('earnings.dataCheck.noPayslipsHint'), { year: row.year }));
  });

  protected readonly hints = computed(() => {
    const lang = this.i18n.language();
    const hints: string[] = [];
    for (const row of this.rows()) {
      if (row.completeness.status === 'MISSING') {
        hints.push(
          fill(this.t('earnings.dataCheck.missingHint'), {
            months: this.months(row.completeness.missingPeriods, lang),
          }),
        );
      }
      const differing = [
        ...new Set([
          ...row.ytd.differences.map((d) => d.field),
          ...row.certificate.differences.map((d) => d.field),
        ]),
      ];
      if (differing.length > 0) {
        hints.push(
          fill(this.t('earnings.dataCheck.differHint'), {
            year: row.year,
            fields: differing.map((f) => this.fieldLabel(f)).join(', '),
          }),
        );
      }
    }
    return hints;
  });

  constructor() {
    effect((onCleanup) => {
      const { employerId } = this.store.query();
      this.loading.set(true);
      const subscription = this.api.dataCheck(employerId).subscribe({
        next: (rows) => {
          this.rows.set(rows);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  private completeness(row: DataCheckRow, lang: string): CheckCell {
    switch (row.completeness.status) {
      case 'COMPLETE':
        return { ok: true, text: this.t('earnings.dataCheck.completeOk') };
      case 'NO_PAYSLIPS':
        return { ok: null, text: this.t('earnings.dataCheck.noPayslips') };
      default:
        return {
          ok: false,
          text: fill(this.t('earnings.dataCheck.missing'), {
            months: this.months(row.completeness.missingPeriods, lang),
          }),
        };
    }
  }

  private comparison(c: DataCheckComparison, lang: string): CheckCell {
    if (c.status === 'NOT_AVAILABLE')
      return { ok: null, text: this.t('earnings.dataCheck.notAvailable') };
    if (c.status === 'NOT_COMPARABLE')
      return { ok: null, text: this.t('earnings.dataCheck.notComparable') };
    return c.status === 'MATCH'
      ? { ok: true, text: fill(this.t('earnings.dataCheck.valuesMatch'), { count: c.compared }) }
      : {
          ok: false,
          text: fill(this.t('earnings.dataCheck.valuesDiffer'), { count: c.differences.length }),
          details: c.differences.map((d) =>
            fill(this.t('earnings.dataCheck.differenceLine'), {
              field: this.fieldLabel(d.field),
              expected: formatMoney(d.expected, lang),
              actual: formatMoney(d.actual, lang),
              difference: formatMoney(d.difference, lang, { signed: true }),
            }),
          ),
        };
  }

  private lateNote(row: DataCheckRow, lang: string): string {
    const months = this.months(
      row.lateCorrections.map((c) => c.period),
      lang,
    );
    return row.lateCorrections.length === 1
      ? fill(this.t('earnings.dataCheck.lateExcludedOne'), { months })
      : fill(this.t('earnings.dataCheck.lateExcludedMany'), {
          count: row.lateCorrections.length,
          months,
        });
  }

  private months(periods: readonly string[], lang: string): string {
    return periods.map((p) => formatMonth(p, lang)).join(', ');
  }

  private fieldLabel(field: string): string {
    for (const key of [`earnings.fields.${field}`, `earnings.terms.${field}`]) {
      const text = this.t(key);
      if (text !== key) return text;
    }
    return field;
  }

  private t(key: string): string {
    return this.i18n.translate(key);
  }
}
