import { Component, computed, inject, input, signal } from '@angular/core';
import type { EarningsRecordDetail } from '@vaultfolio/api-contract';
import { TagModule } from 'primeng/tag';
import { I18nService, IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { fill, formatMoney, formatMonth } from '../../earnings-format';

export interface StatementLine {
  label: string;
  /** Individual amount (secondary column). */
  detail?: string;
  /** Subtotal (main column). */
  amount?: string;
  kind: 'item' | 'subtotal' | 'group' | 'note' | 'total';
  /** Expandable group id and its members. */
  group?: 'taxes' | 'social';
  children?: StatementLine[];
  /** The user corrected this figure in the import preview (FR-012a). */
  corrected?: boolean;
}

export interface Statement {
  id: string;
  employer: string;
  kindLabel: string;
  kind: EarningsRecordDetail['kind'];
  issuedNote: string | null;
  fileName: string;
  checksPassed: boolean;
  lines: StatementLine[];
}

const n = Number;

/**
 * Month detail (FR-029): one statement per payslip section of the selected month — Regular pay /
 * Back pay → Gross → Taxes (expandable) → Social insurance (expandable) → Statutory net → Other →
 * Payout. Deductions are shown negative; a non-itemized difference gets its own line.
 */
@Component({
  selector: 'app-earnings-month-detail',
  imports: [TagModule, IconComponent, TranslatePipe],
  template: `
    <section class="detail" data-testid="earnings-month-detail">
      @if (period(); as month) {
        <h2>{{ heading() }}</h2>
        <p class="muted">{{ subline() }}</p>
        @if (loading()) {
          <p class="muted">…</p>
        }
        @for (statement of statements(); track statement.id) {
          <article class="statement" [attr.data-testid]="'earnings-statement-' + statement.id">
            <header>
              <strong>{{ statement.employer }}</strong>
              <p-tag
                [severity]="statement.kind === 'CORRECTION' ? 'warn' : 'secondary'"
                [value]="statement.kindLabel"
              />
              @if (statement.issuedNote) {
                <span class="muted">{{ statement.issuedNote }}</span>
              }
            </header>
            <p class="muted source">
              {{ statement.fileName }} ·
              <span [class]="statement.checksPassed ? 'ok' : 'fail'">
                <app-icon [name]="statement.checksPassed ? 'check-circle' : 'warning'" />
                {{
                  (statement.checksPassed
                    ? 'earnings.detail.checksPassed'
                    : 'earnings.detail.checksFailed'
                  ) | translate
                }}
              </span>
            </p>
            <div class="scroll">
              <table>
                <tbody>
                  @for (line of statement.lines; track $index) {
                    <tr [class]="'line line--' + line.kind">
                      <th scope="row">
                        @if (line.group) {
                          <button
                            type="button"
                            class="toggle"
                            [attr.aria-expanded]="isOpen(statement.id, line.group)"
                            [attr.data-testid]="
                              'earnings-statement-' + statement.id + '-' + line.group
                            "
                            (click)="toggle(statement.id, line.group)"
                          >
                            <app-icon
                              [name]="
                                isOpen(statement.id, line.group) ? 'chevron-down' : 'chevron-right'
                              "
                            />
                            {{ line.label }}
                          </button>
                        } @else {
                          {{ line.label }}
                        }
                        @if (line.corrected) {
                          <p-tag
                            severity="success"
                            [value]="'earnings.detail.corrected' | translate"
                            [attr.data-testid]="'earnings-statement-corrected-' + statement.id"
                          />
                        }
                      </th>
                      <td class="num detail-col">{{ line.detail ?? '' }}</td>
                      <td class="num">{{ line.amount ?? '' }}</td>
                    </tr>
                    @if (line.group && isOpen(statement.id, line.group)) {
                      @for (child of line.children; track child.label) {
                        <tr class="line line--child">
                          <th scope="row">
                            {{ child.label }}
                            @if (child.corrected) {
                              <p-tag
                                severity="success"
                                [value]="'earnings.detail.corrected' | translate"
                              />
                            }
                          </th>
                          <td class="num detail-col">{{ child.detail }}</td>
                          <td></td>
                        </tr>
                      }
                    }
                  }
                </tbody>
              </table>
            </div>
          </article>
        }
      } @else {
        <h2>{{ 'earnings.detail.title' | translate }}</h2>
        <p class="muted">{{ 'earnings.detail.pick' | translate }}</p>
      }
    </section>
  `,
  styles: `
    h2 {
      margin: 0;
      font-size: 1.1rem;
    }
    .muted {
      margin: 0.25rem 0 0;
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
    }
    .statement {
      margin-top: 1rem;
      padding-top: 0.75rem;
      border-top: 1px solid var(--p-content-border-color);
    }
    .statement header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }
    .source {
      overflow-wrap: anywhere;
    }
    .ok {
      color: var(--p-green-700);
    }
    .fail {
      color: var(--p-red-700);
    }
    :host-context(.app-dark) .ok {
      color: var(--p-green-400);
    }
    :host-context(.app-dark) .fail {
      color: var(--p-red-400);
    }
    .scroll {
      overflow-x: auto;
    }
    table {
      width: 100%;
      min-width: 20rem;
      margin-top: 0.5rem;
      border-collapse: collapse;
      font-size: 0.875rem;
    }
    th {
      text-align: left;
      font-weight: 400;
      padding: 0.25rem 0.5rem 0.25rem 0;
    }
    td {
      padding: 0.25rem 0 0.25rem 0.75rem;
    }
    .num {
      text-align: right;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .detail-col {
      color: var(--p-text-muted-color);
    }
    .line--subtotal th,
    .line--subtotal td,
    .line--total th,
    .line--total td {
      font-weight: 600;
    }
    .line--subtotal,
    .line--total {
      border-top: 1px solid var(--p-content-border-color);
    }
    .line--child th {
      padding-left: 1.75rem;
      color: var(--p-text-muted-color);
    }
    .line--note th {
      color: var(--p-text-muted-color);
      font-style: italic;
    }
    .toggle {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0;
      border: none;
      background: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
  `,
})
export class MonthDetailComponent {
  readonly period = input<string | null>(null);
  readonly records = input<EarningsRecordDetail[]>([]);
  readonly loading = input(false);
  private readonly i18n = inject(I18nService);
  private readonly open = signal<ReadonlySet<string>>(new Set());

  protected readonly heading = computed(() => {
    const period = this.period();
    return period ? formatMonth(period, this.i18n.language(), 'long') : '';
  });

  protected readonly subline = computed(() => {
    const records = this.records();
    const lang = this.i18n.language();
    const sum = (key: 'gross' | 'net') =>
      records.reduce((total, r) => total + n(r.amounts[key]), 0).toFixed(2);
    const sections =
      records.length === 1
        ? this.i18n.translate('earnings.detail.sectionsOne')
        : fill(this.i18n.translate('earnings.detail.sections'), { count: records.length });
    return [
      sections,
      `${this.i18n.translate('earnings.terms.gross')} ${formatMoney(sum('gross'), lang)}`,
      `${this.i18n.translate('earnings.terms.net')} ${formatMoney(sum('net'), lang)}`,
    ].join(' · ');
  });

  protected readonly statements = computed(() =>
    this.records().map((r) =>
      buildStatement(r, this.i18n.language(), (k) => this.i18n.translate(k)),
    ),
  );

  protected isOpen(id: string, group: string): boolean {
    return this.open().has(`${id}:${group}`);
  }

  protected toggle(id: string, group: string): void {
    const key = `${id}:${group}`;
    this.open.update((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
}

/** Builds one section's statement; exported for exact-value tests. */
export function buildStatement(
  record: EarningsRecordDetail,
  lang: string,
  translate: (key: string) => string,
): Statement {
  const a = record.amounts;
  const t = (key: string) => translate(`earnings.terms.${key}`);
  const money = (value: number | string) =>
    formatMoney(typeof value === 'number' ? value.toFixed(2) : value, lang);
  const neg = (value: string) => money(-n(value));
  const bonus = n(a.oneOff.gross ?? '0');
  const taxes = n(a.wageTax) + n(a.soli) + n(a.churchTax);
  const social = n(a.health) + n(a.care) + n(a.pension) + n(a.unemployment);
  const residual = Math.round((n(a.gross) - taxes - social - n(a.net)) * 100) / 100;
  const lines: StatementLine[] = [];
  const edited = new Set<string>(a.corrected ?? []);
  const mark = (...keys: string[]): { corrected?: true } =>
    keys.some((k) => edited.has(k)) ? { corrected: true } : {};

  if (record.kind === 'CORRECTION') {
    lines.push({ label: t('backPay'), detail: money(a.gross), kind: 'item' });
  } else if (record.kind === 'REGULAR') {
    lines.push({ label: t('regular'), detail: money(n(a.gross) - bonus), kind: 'item' });
    if (bonus !== 0) lines.push({ label: t('bonusOneOff'), detail: money(bonus), kind: 'item' });
  }
  if (record.kind !== 'PAYOUT_ONLY') {
    lines.push(
      { label: t('grossTotal'), amount: money(a.gross), kind: 'subtotal', ...mark('gross') },
      {
        label: t('taxes'),
        amount: money(-taxes),
        kind: 'group',
        group: 'taxes',
        ...mark('wageTax', 'soli', 'churchTax'),
        children: [
          { label: t('wageTax'), detail: neg(a.wageTax), kind: 'item', ...mark('wageTax') },
          { label: t('soli'), detail: neg(a.soli), kind: 'item', ...mark('soli') },
          { label: t('churchTax'), detail: neg(a.churchTax), kind: 'item', ...mark('churchTax') },
        ],
      },
      {
        label: t('social'),
        amount: money(-social),
        kind: 'group',
        group: 'social',
        ...mark('health', 'care', 'pension', 'unemployment'),
        children: [
          { label: t('health'), detail: neg(a.health), kind: 'item', ...mark('health') },
          { label: t('care'), detail: neg(a.care), kind: 'item', ...mark('care') },
          { label: t('pension'), detail: neg(a.pension), kind: 'item', ...mark('pension') },
          {
            label: t('unemployment'),
            detail: neg(a.unemployment),
            kind: 'item',
            ...mark('unemployment'),
          },
        ],
      },
    );
    if (a.employerSubsidy) {
      const subsidy = n(a.employerSubsidy.health) + n(a.employerSubsidy.care);
      lines.push({
        label: fill(translate('earnings.detail.subsidyNote'), { amount: money(subsidy) }),
        kind: 'note',
      });
    }
    if (residual !== 0)
      lines.push({
        label: translate('earnings.detail.residual'),
        amount: money(-residual),
        kind: 'item',
      });
    lines.push({
      label: t('statutoryNet'),
      amount: money(a.net),
      kind: 'subtotal',
      ...mark('net'),
    });
  }
  lines.push({ label: t('other'), amount: money(a.other), kind: 'item' });
  if (record.kind === 'CORRECTION') {
    lines.push({
      label: fill(translate('earnings.detail.paidWith'), {
        month: formatMonth(record.issued, lang),
      }),
      kind: 'note',
    });
  }
  if (a.payout !== null) {
    lines.push({ label: t('payout'), amount: money(a.payout), kind: 'total', ...mark('payout') });
  }

  return {
    id: record.id,
    employer: record.employerLabel,
    kind: record.kind,
    kindLabel: translate(`earnings.kind.${record.kind}`),
    issuedNote:
      record.kind === 'CORRECTION'
        ? fill(translate('earnings.detail.issuedIn'), { month: formatMonth(record.issued, lang) })
        : null,
    fileName: record.import.fileName,
    checksPassed: a.checks.every((c) => c.passed),
    lines,
  };
}
