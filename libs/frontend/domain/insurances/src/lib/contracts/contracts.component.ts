import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { I18nService, IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import type { Classification, InsuranceGroup } from '@vaultfolio/insurances';
import { fill, formatMoney } from '../insurances-format';
import { InsurancesStore } from '../insurances-store';
import { InsurancesService } from '../insurances.service';
import { type ContractRow, buildRows, cancellationLabel, daysLeftLabel } from '../insurances-view';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type SortKey = 'GROUP' | 'NAME' | 'CLASS' | 'PREMIUM' | 'MONTHLY' | 'DEADLINE';
type SortDir = 'asc' | 'desc';

const GROUPS: readonly InsuranceGroup[] = [
  'PERSONS',
  'LIABILITY',
  'PROPERTY',
  'MOBILITY',
  'LEGAL',
  'OTHER',
];
const CLASSES: readonly Classification[] = ['ESSENTIAL', 'RECOMMENDED', 'SITUATIONAL', 'OPTIONAL'];

/**
 * Contracts tab (design.md "Verträge", Stories 1, 3 and 5): filterable and sortable list with
 * monthly equivalent, next cancellation date (highlighted inside the warning window), reminder state
 * and edit/delete. Statutory lines linked from Earnings are green-tinted and read-only; "manuell
 * erfassen" opens the form prefilled so no value is counted twice.
 */
@Component({
  selector: 'app-insurances-contracts',
  imports: [
    FormsModule,
    RouterLink,
    ButtonModule,
    DialogModule,
    MessageModule,
    SelectModule,
    IconComponent,
    TranslatePipe,
  ],
  template: `
    <div class="filters" data-testid="insurances-filters">
      <p-select
        [options]="groupOptions()"
        optionLabel="label"
        optionValue="value"
        [ngModel]="group()"
        (ngModelChange)="group.set($event)"
        [attr.aria-label]="'insurances.list.filterGroup' | translate"
        data-testid="insurances-filter-group"
      />
      <p-select
        [options]="statusOptions()"
        optionLabel="label"
        optionValue="value"
        [ngModel]="status()"
        (ngModelChange)="status.set($event)"
        [attr.aria-label]="'insurances.list.filterStatus' | translate"
        data-testid="insurances-filter-status"
      />
      <p-select
        [options]="classOptions()"
        optionLabel="label"
        optionValue="value"
        [ngModel]="classification()"
        (ngModelChange)="classification.set($event)"
        [attr.aria-label]="'insurances.list.filterClass' | translate"
        data-testid="insurances-filter-class"
      />
    </div>

    <p-message severity="info" data-testid="insurances-social-note">
      {{
        (store.linkedSocial().length > 0
          ? 'insurances.social.note'
          : 'insurances.social.noteManualOnly'
        ) | translate
      }}
    </p-message>

    @if (rows().length === 0) {
      <p class="muted" data-testid="insurances-list-empty">
        {{ 'insurances.list.empty' | translate }}
      </p>
    } @else {
      <div class="scroll">
        <table data-testid="insurances-table">
          <thead>
            <tr>
              <th [attr.aria-sort]="ariaSort('GROUP')">
                <button
                  type="button"
                  class="sort"
                  (click)="sortBy('GROUP')"
                  data-testid="insurances-sort-GROUP"
                >
                  {{ 'insurances.list.group' | translate }} {{ arrow('GROUP') }}
                </button>
              </th>
              <th [attr.aria-sort]="ariaSort('NAME')">
                <button
                  type="button"
                  class="sort"
                  (click)="sortBy('NAME')"
                  data-testid="insurances-sort-NAME"
                >
                  {{ 'insurances.list.insurance' | translate }} {{ arrow('NAME') }}
                </button>
              </th>
              <th [attr.aria-sort]="ariaSort('CLASS')">
                <button
                  type="button"
                  class="sort"
                  (click)="sortBy('CLASS')"
                  data-testid="insurances-sort-CLASS"
                >
                  {{ 'insurances.list.classification' | translate }} {{ arrow('CLASS') }}
                </button>
              </th>
              <th class="num" [attr.aria-sort]="ariaSort('PREMIUM')">
                <button
                  type="button"
                  class="sort"
                  (click)="sortBy('PREMIUM')"
                  data-testid="insurances-sort-PREMIUM"
                >
                  {{ 'insurances.list.premium' | translate }} {{ arrow('PREMIUM') }}
                </button>
              </th>
              <th class="num" [attr.aria-sort]="ariaSort('MONTHLY')">
                <button
                  type="button"
                  class="sort"
                  (click)="sortBy('MONTHLY')"
                  data-testid="insurances-sort-MONTHLY"
                >
                  {{ 'insurances.list.monthly' | translate }} {{ arrow('MONTHLY') }}
                </button>
              </th>
              <th [attr.aria-sort]="ariaSort('DEADLINE')">
                <button
                  type="button"
                  class="sort"
                  (click)="sortBy('DEADLINE')"
                  data-testid="insurances-sort-DEADLINE"
                >
                  {{ 'insurances.list.next' | translate }} {{ arrow('DEADLINE') }}
                </button>
              </th>
              <th>{{ 'insurances.list.reminder' | translate }}</th>
              <th class="actions">{{ 'insurances.list.actions' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.id) {
              <tr
                [class.linked]="row.kind === 'LINKED'"
                [class.inactive]="!row.active"
                [class.deadline]="row.withinWindow"
                [attr.data-testid]="'insurances-row-' + row.id"
              >
                <td>{{ groupLabel(row.group) }}</td>
                <td>
                  <div class="name">{{ row.name }}</div>
                  <div class="muted">
                    {{ typeLabel(row.typeId) }}
                    @if (row.insurer) {
                      · {{ row.insurer }}
                    }
                    @if (row.detail) {
                      · {{ row.detail }}
                    }
                  </div>
                  @if (row.kind === 'LINKED' && row.linked) {
                    <span
                      class="tag tag--source"
                      [attr.data-testid]="'insurances-source-' + row.id"
                      >{{
                        t('insurances.social.fromEarnings', { period: period(row.linked.period) })
                      }}</span
                    >
                  }
                  @if (row.overlap) {
                    <span class="tag tag--overlap" data-testid="insurances-overlap">{{
                      'insurances.list.overlap' | translate
                    }}</span>
                  }
                  @if (!row.active) {
                    <span class="tag">{{ 'insurances.status.inactive' | translate }}</span>
                  }
                </td>
                <td>
                  <span class="tag">{{ classLabel(row.classification) }}</span>
                </td>
                <td class="num">
                  {{ money(row.premium) }}
                  <div class="muted">{{ intervalLabel(row.interval) }}</div>
                </td>
                <td class="num" [attr.data-testid]="'insurances-monthly-' + row.id">
                  {{ money(row.monthly) }}
                </td>
                <td
                  [class.warn]="row.withinWindow"
                  [attr.data-testid]="'insurances-next-' + row.id"
                >
                  {{ nextLabel(row) }}
                  @if (row.daysLeft !== null) {
                    <div class="muted">{{ daysLeft(row.daysLeft) }}</div>
                  }
                </td>
                <td>{{ reminderLabel(row) }}</td>
                <td class="actions">
                  @if (row.kind === 'CONTRACT') {
                    <a
                      pButton
                      [text]="true"
                      severity="secondary"
                      [routerLink]="['/app/insurances', row.id, 'edit']"
                      [attr.aria-label]="'insurances.list.edit' | translate"
                      [attr.data-testid]="'insurances-edit-' + row.id"
                    >
                      <app-icon name="pencil" />
                    </a>
                    <button
                      type="button"
                      pButton
                      [text]="true"
                      severity="danger"
                      [attr.aria-label]="'insurances.list.delete' | translate"
                      [attr.data-testid]="'insurances-delete-' + row.id"
                      (click)="ask(row)"
                    >
                      <app-icon name="trash" />
                    </button>
                  } @else if (row.linked) {
                    <a
                      pButton
                      [outlined]="true"
                      severity="secondary"
                      size="small"
                      routerLink="/app/insurances/new"
                      [queryParams]="{ type: row.typeId, premium: row.linked.monthly }"
                      [attr.data-testid]="'insurances-make-manual-' + row.id"
                    >
                      {{ 'insurances.social.makeManual' | translate }}
                    </a>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    <p-dialog
      [visible]="pending() !== null"
      (visibleChange)="$event || cancel()"
      [modal]="true"
      [header]="'insurances.list.deleteTitle' | translate"
      [style]="{ width: '28rem' }"
    >
      <p data-testid="insurances-delete-body">
        {{ t('insurances.list.deleteBody', { name: pending()?.name ?? '' }) }}
      </p>
      @if (failed()) {
        <p-message severity="error" data-testid="insurances-delete-error">{{
          'insurances.list.deleteFailed' | translate
        }}</p-message>
      }
      <ng-template #footer>
        <button
          type="button"
          pButton
          severity="secondary"
          [outlined]="true"
          data-testid="insurances-delete-cancel"
          (click)="cancel()"
        >
          {{ 'insurances.list.deleteCancel' | translate }}
        </button>
        <button
          type="button"
          pButton
          severity="danger"
          data-testid="insurances-delete-confirm"
          (click)="confirm()"
        >
          {{ 'insurances.list.deleteConfirm' | translate }}
        </button>
      </ng-template>
    </p-dialog>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1rem;
    }
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    .scroll {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th,
    td {
      padding: 0.6rem 0.75rem;
      text-align: left;
      border-bottom: 1px solid var(--p-content-border-color);
      vertical-align: top;
    }
    th {
      font-size: 0.8rem;
      color: var(--p-text-muted-color);
      font-weight: 600;
    }
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .actions {
      white-space: nowrap;
      text-align: right;
    }
    .name {
      font-weight: 600;
    }
    .muted {
      color: var(--p-text-muted-color);
      font-size: 0.85rem;
    }
    .tag {
      display: inline-block;
      margin: 0.25rem 0.25rem 0 0;
      padding: 0.05rem 0.5rem;
      border-radius: 1rem;
      background: color-mix(in srgb, var(--p-text-color) 12%, var(--p-content-background));
      border: 1px solid color-mix(in srgb, var(--p-text-color) 20%, transparent);
      font-size: 0.75rem;
    }
    .sort {
      all: unset;
      cursor: pointer;
      font: inherit;
      white-space: nowrap;
    }
    .sort:focus-visible {
      outline: 2px solid var(--p-primary-color);
    }
    .tag--source {
      background: color-mix(in srgb, var(--p-green-500) 20%, var(--p-content-background));
    }
    .tag--overlap {
      background: color-mix(in srgb, var(--p-orange-500) 20%, var(--p-content-background));
    }
    tr.linked {
      background: color-mix(in srgb, var(--p-green-500) 8%, transparent);
    }
    tr.inactive {
      background: color-mix(in srgb, var(--p-text-color) 7%, transparent);
    }
    tr.deadline {
      background: color-mix(in srgb, var(--p-orange-500) 10%, transparent);
    }
    tr.inactive .name {
      text-decoration: line-through;
      color: var(--p-text-muted-color);
    }
    td.warn {
      color: var(--p-orange-600);
      font-weight: 600;
    }
    a.p-button {
      text-decoration: none;
    }
  `,
})
export class InsurancesContractsComponent {
  protected readonly store = inject(InsurancesStore);
  private readonly service = inject(InsurancesService);
  private readonly i18n = inject(I18nService);

  protected readonly group = signal<InsuranceGroup | 'ALL'>('ALL');
  protected readonly status = signal<StatusFilter>('ALL');
  protected readonly classification = signal<Classification | 'ALL'>('ALL');
  protected readonly sort = signal<SortKey>('MONTHLY');
  protected readonly dir = signal<SortDir>('desc');
  protected readonly pending = signal<ContractRow | null>(null);
  protected readonly failed = signal(false);

  protected readonly rows = computed<ContractRow[]>(() => {
    this.i18n.language();
    const all = buildRows({
      contracts: this.store.contracts(),
      linked: this.store.settings().includeSocial ? this.store.linkedSocial() : [],
      gaps: this.store.gaps(),
      today: this.store.today(),
      warnDays: this.store.warnDays(),
      t: (key, params) => this.t(key, params),
    });
    const group = this.group();
    const status = this.status();
    const classification = this.classification();
    const filtered = all.filter(
      (r) =>
        (group === 'ALL' || r.group === group) &&
        (classification === 'ALL' || r.classification === classification) &&
        (status === 'ALL' || (status === 'ACTIVE' ? r.active : !r.active)),
    );
    const key = this.sort();
    const sign = this.dir() === 'asc' ? 1 : -1;
    const text = (a: string, b: string) => a.localeCompare(b, this.i18n.language());
    return [...filtered].sort((a, b) => {
      switch (key) {
        case 'GROUP':
          return sign * text(this.groupLabel(a.group), this.groupLabel(b.group));
        case 'NAME':
          return sign * text(a.name, b.name);
        case 'CLASS':
          return sign * (CLASSES.indexOf(a.classification) - CLASSES.indexOf(b.classification));
        case 'PREMIUM':
          return sign * (Number(a.premium) - Number(b.premium));
        case 'DEADLINE':
          // Rows without a deadline stay last in both directions.
          if (!a.deadline && !b.deadline) return 0;
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return sign * a.deadline.localeCompare(b.deadline);
        default:
          return sign * (Number(a.monthly) - Number(b.monthly));
      }
    });
  });

  protected groupOptions() {
    return [
      { label: this.i18n.translate('insurances.list.all'), value: 'ALL' },
      ...GROUPS.map((g) => ({ label: this.i18n.translate(`insurances.groups.${g}`), value: g })),
    ];
  }

  protected statusOptions() {
    return [
      { label: this.i18n.translate('insurances.list.all'), value: 'ALL' },
      { label: this.i18n.translate('insurances.status.ACTIVE'), value: 'ACTIVE' },
      { label: this.i18n.translate('insurances.status.inactive'), value: 'INACTIVE' },
    ];
  }

  protected classOptions() {
    return [
      { label: this.i18n.translate('insurances.list.all'), value: 'ALL' },
      ...CLASSES.map((c) => ({ label: this.i18n.translate(`insurances.classes.${c}`), value: c })),
    ];
  }

  protected sortBy(key: SortKey): void {
    if (this.sort() === key) {
      this.dir.set(this.dir() === 'asc' ? 'desc' : 'asc');
      return;
    }
    this.sort.set(key);
    this.dir.set(key === 'PREMIUM' || key === 'MONTHLY' ? 'desc' : 'asc');
  }

  protected arrow(key: SortKey): string {
    if (this.sort() !== key) return '';
    return this.dir() === 'asc' ? '▲' : '▼';
  }

  protected ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
    if (this.sort() !== key) return 'none';
    return this.dir() === 'asc' ? 'ascending' : 'descending';
  }

  protected groupLabel(group: InsuranceGroup): string {
    return this.i18n.translate(`insurances.groups.${group}`);
  }

  protected t(key: string, params?: Record<string, string | number>): string {
    return fill(this.i18n.translate(key), params);
  }

  protected money(value: string): string {
    return formatMoney(value, this.i18n.language());
  }

  protected typeLabel(id: string): string {
    return this.i18n.translate(`insurances.types.${id}`);
  }

  protected classLabel(c: Classification): string {
    return this.i18n.translate(`insurances.classes.${c}`);
  }

  protected intervalLabel(interval: string): string {
    return this.i18n.translate(`insurances.intervals.${interval}`);
  }

  protected period(period: string): string {
    const [y, m] = period.split('-');
    return `${m}/${y}`;
  }

  protected nextLabel(row: ContractRow): string {
    return cancellationLabel(row.info, (key, params) => this.t(key, params), this.i18n.language());
  }

  protected daysLeft(days: number): string {
    return daysLeftLabel(days, (key, params) => this.t(key, params));
  }

  protected reminderLabel(row: ContractRow): string {
    const reminders = this.store.settings().reminders;
    if (row.kind !== 'CONTRACT' || row.info.kind !== 'DEADLINE') return '–';
    return reminders.enabled && row.contract?.reminderEnabled
      ? this.t('insurances.list.reminderDays', { days: reminders.leadDays })
      : this.i18n.translate('insurances.list.reminderMuted');
  }

  protected ask(row: ContractRow): void {
    this.failed.set(false);
    this.pending.set(row);
  }

  protected cancel(): void {
    this.pending.set(null);
    this.failed.set(false);
  }

  protected confirm(): void {
    const row = this.pending();
    if (!row) return;
    this.service.delete(row.id).subscribe({
      next: () => {
        this.cancel();
        this.store.refresh();
      },
      error: () => this.failed.set(true),
    });
  }
}
