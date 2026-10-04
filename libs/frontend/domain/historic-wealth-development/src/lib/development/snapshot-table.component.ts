import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import type { WealthSnapshot } from '@vaultfolio/api-contract';
import { I18nService, IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { changesOf, totalsOf } from '@vaultfolio/wealth';
import { changeTone, formatDate, formatMoney, formatPct } from '../wealth-format';

const AREA_PATH = '/app/historic-wealth-development';

/**
 * Snapshot table (design.md "Entwicklung"): newest first, change versus the previous snapshot
 * within the period (the oldest shows "–"), the newest row highlighted, liabilities shown with a
 * minus sign and their own color so they differ without relying on color alone (FR-022). Row
 * actions: edit, copy as template, delete (the parent confirms and deletes).
 *
 * Inline template/styles: see `IconComponent`'s note in `@vaultfolio/frontend-shared-ui`.
 */
@Component({
  selector: 'app-wealth-snapshot-table',
  imports: [RouterLink, ButtonModule, IconComponent, TranslatePipe],
  template: `
    <div class="scroll">
      <table data-testid="wealth-table">
        <caption class="sr-only">
          {{
            'wealth.table.title' | translate
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">{{ 'wealth.table.date' | translate }}</th>
            <th scope="col" class="num">{{ 'wealth.table.assets' | translate }}</th>
            <th scope="col" class="num">{{ 'wealth.table.liabilities' | translate }}</th>
            <th scope="col" class="num">{{ 'wealth.table.net' | translate }}</th>
            <th scope="col" class="num">{{ 'wealth.table.change' | translate }}</th>
            <th scope="col" class="num">{{ 'wealth.table.percent' | translate }}</th>
            <th scope="col" class="num">{{ 'wealth.table.perYear' | translate }}</th>
            <th scope="col" class="actions">
              <span class="sr-only">{{ 'wealth.table.actions' | translate }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.snapshot.id) {
            <tr [class.latest]="row.latest" [attr.data-testid]="'wealth-row-' + row.snapshot.id">
              <th scope="row" class="date">{{ row.date }}</th>
              <td class="num">{{ row.assets }}</td>
              <td class="num liability">{{ row.liabilities }}</td>
              <td class="num strong">{{ row.net }}</td>
              <td class="num" [class]="'num ' + row.tone">{{ row.delta }}</td>
              <td class="num" [class]="'num ' + row.tone">{{ row.pct }}</td>
              <td class="num" [class]="'num ' + row.toneYear">{{ row.pctPerYear }}</td>
              <td class="actions">
                <a
                  pButton
                  severity="secondary"
                  [text]="true"
                  size="small"
                  [routerLink]="[areaPath, row.snapshot.id, 'edit']"
                  [attr.aria-label]="'wealth.table.edit' | translate"
                  [attr.data-testid]="'wealth-edit-' + row.snapshot.id"
                >
                  <app-icon name="pencil" />
                </a>
                <a
                  pButton
                  severity="secondary"
                  [text]="true"
                  size="small"
                  [routerLink]="[areaPath, 'new']"
                  [queryParams]="{ copyFrom: row.snapshot.id }"
                  [attr.aria-label]="'wealth.table.copy' | translate"
                  [attr.data-testid]="'wealth-copy-' + row.snapshot.id"
                >
                  <app-icon name="content-copy" />
                </a>
                <button
                  type="button"
                  pButton
                  severity="danger"
                  [text]="true"
                  size="small"
                  [attr.aria-label]="'wealth.table.delete' | translate"
                  [attr.data-testid]="'wealth-delete-' + row.snapshot.id"
                  (click)="remove.emit(row.snapshot)"
                >
                  <app-icon name="trash" />
                </button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    .scroll {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    th,
    td {
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid var(--p-content-border-color);
      white-space: nowrap;
      text-align: start;
    }
    thead th {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--p-text-muted-color);
    }
    .num {
      text-align: end;
      font-variant-numeric: tabular-nums;
    }
    .date {
      font-weight: 500;
    }
    .strong {
      font-weight: 600;
    }
    .liability {
      color: var(--p-red-600);
    }
    .down {
      color: var(--p-red-600);
    }
    .up {
      color: var(--p-green-600);
    }
    .flat {
      color: var(--p-text-muted-color);
    }
    tr.latest {
      background: color-mix(in srgb, var(--p-primary-color) 8%, transparent);
    }
    .actions {
      text-align: end;
    }
    a.p-button {
      text-decoration: none;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
  `,
})
export class SnapshotTableComponent {
  private readonly i18n = inject(I18nService);

  /** Snapshots of the chosen period, any order. */
  readonly snapshots = input.required<readonly WealthSnapshot[]>();
  readonly remove = output<WealthSnapshot>();

  protected readonly areaPath = AREA_PATH;

  protected readonly rows = computed(() => {
    const lang = this.i18n.language();
    const none = this.i18n.translate('wealth.kpi.none');
    const na = this.i18n.translate('wealth.kpi.notAvailable');
    const snapshots = this.snapshots();
    const changes = new Map(changesOf(snapshots).map((c) => [c.id, c]));
    const newest = snapshots.reduce<string | null>(
      (best, s) => (best === null || s.snapshotDate > best ? s.snapshotDate : best),
      null,
    );
    return [...snapshots]
      .sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate))
      .map((snapshot) => {
        const totals = totalsOf(snapshot);
        const change = changes.get(snapshot.id);
        return {
          snapshot,
          latest: snapshot.snapshotDate === newest,
          date: formatDate(snapshot.snapshotDate, lang),
          assets: formatMoney(totals.assets, lang),
          liabilities: formatLiability(totals.liabilities, lang),
          net: formatMoney(totals.net, lang),
          delta: change?.delta == null ? none : formatMoney(change.delta, lang, { signed: true }),
          pct: change?.delta == null ? none : formatPct(change.pct, lang, na),
          pctPerYear: change?.delta == null ? none : formatPct(change.pctPerYear, lang, na),
          tone: changeTone(change?.delta),
          toneYear: changeTone(change?.pctPerYear),
        };
      });
  });
}

/** Liabilities carry a minus sign so they read differently from assets even without color. */
function formatLiability(amount: string, lang: string): string {
  return Number(amount) === 0 ? formatMoney(amount, lang) : `−${formatMoney(amount, lang)}`;
}
