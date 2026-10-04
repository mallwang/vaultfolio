import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { I18nService, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import {
  type BalanceGroup,
  type ClassRef,
  type Side,
  balanceSheetOf,
  classKey,
  effectiveGroup,
  groupsOf,
  sortedByDate,
} from '@vaultfolio/wealth';
import { labelOfClass } from '../charts/wealth-charts';
import { formatDate, formatMoney } from '../wealth-format';
import { WealthStore } from '../wealth-store';
import { WealthService } from '../wealth.service';
import { WealthEmptyStateComponent } from '../development/wealth-empty-state.component';

interface ClassOption {
  value: string;
  label: string;
  side: Side;
  class: ClassRef;
}

/**
 * "Bilanz" tab (design.md "Bilanz", FR-023–FR-027): Aktiva on the left, Passiva on the right,
 * grouped by balance group with sub-totals, equity (the net worth) as the balancing figure first
 * in Passiva, and an identical "Summe" on both sides. A reference-date select defaults to the
 * latest snapshot; the group selector reassigns a class for all snapshots. Liabilities sit in the
 * Passiva column under their own group headings, so they are distinct without relying on color
 * (FR-022). No
 * ratios are shown (FR-027).
 */
@Component({
  selector: 'app-wealth-balance',
  imports: [
    FormsModule,
    ButtonModule,
    MessageModule,
    SelectModule,
    TranslatePipe,
    WealthEmptyStateComponent,
  ],
  template: `
    @if (store.loaded()) {
      @if (store.snapshots().length === 0) {
        <app-wealth-empty-state />
      } @else {
        <div class="header">
          <label class="field">
            <span>{{ 'wealth.balance.referenceDate' | translate }}</span>
            <p-select
              [options]="dateOptions()"
              optionLabel="label"
              optionValue="value"
              [ngModel]="selectedId()"
              (ngModelChange)="selected.set($event)"
              data-testid="wealth-balance-date"
            />
          </label>
        </div>

        @if (sheet(); as s) {
          <div class="sheet" data-testid="wealth-balance">
            <section class="column" data-testid="wealth-balance-assets">
              <h2>{{ 'wealth.balance.assets' | translate }}</h2>
              @for (group of s.assets; track group.group) {
                <div class="group" [attr.data-testid]="'wealth-balance-group-' + group.group">
                  <h3>
                    <span>{{ 'wealth.groups.' + group.group | translate }}</span>
                    <span class="amount">{{ money(group.subtotal) }}</span>
                  </h3>
                  @for (entry of group.entries; track $index) {
                    <div class="row">
                      <span class="name">{{ entry.name }}</span>
                      <span class="class">{{ classLabel(entry.class) }}</span>
                      <span class="amount">{{ money(entry.amount) }}</span>
                    </div>
                  } @empty {
                    <p class="muted">{{ 'wealth.balance.noPositions' | translate }}</p>
                  }
                </div>
              }
              <div class="total" data-testid="wealth-balance-sum-assets">
                <span>{{ 'wealth.balance.total' | translate }}</span>
                <span class="amount">{{ money(s.sumAssets) }}</span>
              </div>
            </section>

            <section class="column" data-testid="wealth-balance-passiva">
              <h2>{{ 'wealth.balance.passiva' | translate }}</h2>
              <div class="group group--equity" data-testid="wealth-balance-equity">
                <h3>
                  <span>{{ 'wealth.balance.equity' | translate }}</span>
                  <span class="amount" [class.negative]="negativeEquity()">{{
                    money(s.equity)
                  }}</span>
                </h3>
              </div>
              @for (group of liabilityGroups(); track group.group) {
                <div class="group" [attr.data-testid]="'wealth-balance-group-' + group.group">
                  <h3>
                    <span>{{ 'wealth.groups.' + group.group | translate }}</span>
                    <span class="amount liability">{{ money(group.subtotal) }}</span>
                  </h3>
                  @for (entry of group.entries; track $index) {
                    <div class="row">
                      <span class="name">{{ entry.name }}</span>
                      <span class="class">{{ classLabel(entry.class) }}</span>
                      <span class="amount liability">{{ money(entry.amount) }}</span>
                    </div>
                  } @empty {
                    <p class="muted">{{ 'wealth.balance.noPositions' | translate }}</p>
                  }
                </div>
              }
              <div class="total" data-testid="wealth-balance-sum-passiva">
                <span>{{ 'wealth.balance.total' | translate }}</span>
                <span class="amount">{{ money(s.sumPassiva) }}</span>
              </div>
            </section>
          </div>
        }

        <div class="notes">
          <p-message severity="info" data-testid="wealth-balance-group-note">
            <div class="group-form">
              <span>{{ 'wealth.balance.groupNote' | translate }}</span>
              <p-select
                [options]="classOptions()"
                optionLabel="label"
                optionValue="value"
                [ngModel]="classChoice()"
                (ngModelChange)="chooseClass($event)"
                [placeholder]="'wealth.balance.groupClass' | translate"
                data-testid="wealth-balance-class"
              />
              <p-select
                [options]="groupOptions()"
                optionLabel="label"
                optionValue="value"
                [ngModel]="groupChoice()"
                (ngModelChange)="groupChoice.set($event)"
                [placeholder]="'wealth.balance.groupTarget' | translate"
                [disabled]="!classChoice()"
                data-testid="wealth-balance-group-select"
              />
              <button
                type="button"
                pButton
                size="small"
                [disabled]="!classChoice() || !groupChoice()"
                data-testid="wealth-balance-group-apply"
                (click)="apply()"
              >
                {{ 'wealth.balance.groupApply' | translate }}
              </button>
            </div>
          </p-message>
          @if (failed()) {
            <p-message severity="error" data-testid="wealth-balance-error">{{
              'wealth.errors.generic' | translate
            }}</p-message>
          }
          <p-message severity="warn" data-testid="wealth-balance-warning">{{
            'wealth.balance.ratiosWarning' | translate
          }}</p-message>
        </div>
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .header {
      display: flex;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.875rem;
    }
    .sheet {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
      align-items: start;
    }
    .column {
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius, 0.5rem);
      background: var(--p-content-background);
      padding: 1rem;
    }
    h2 {
      margin: 0 0 0.75rem;
      font-size: 1rem;
    }
    h3 {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      margin: 0.75rem 0 0.25rem;
      font-size: 0.9rem;
      font-weight: 600;
    }
    .row {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) auto;
      gap: 0.5rem;
      font-size: 0.875rem;
      padding: 0.125rem 0;
    }
    .class,
    .muted {
      color: var(--p-text-muted-color);
    }
    .muted {
      margin: 0;
      font-size: 0.8rem;
    }
    .amount {
      text-align: end;
      font-variant-numeric: tabular-nums;
    }
    .liability,
    .negative {
      color: var(--p-red-600);
    }
    .group--equity h3 {
      margin-top: 0;
    }
    .total {
      display: flex;
      justify-content: space-between;
      margin-top: 1rem;
      padding-top: 0.5rem;
      border-top: 2px solid var(--p-content-border-color);
      font-weight: 700;
    }
    .notes {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .group-form {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }
    @media (max-width: 760px) {
      .sheet {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class BalanceSheetComponent {
  protected readonly store = inject(WealthStore);
  private readonly service = inject(WealthService);
  private readonly i18n = inject(I18nService);

  protected readonly selected = signal<string | null>(null);
  protected readonly classChoice = signal<string | null>(null);
  protected readonly groupChoice = signal<BalanceGroup | null>(null);
  protected readonly failed = signal(false);

  private readonly ordered = computed(() => sortedByDate(this.store.snapshots()));

  /** The chosen snapshot's id; the latest when nothing (valid) is chosen. */
  protected readonly selectedId = computed(() => {
    const ordered = this.ordered();
    const chosen = this.selected();
    if (chosen && ordered.some((s) => s.id === chosen)) return chosen;
    return ordered.length > 0 ? ordered[ordered.length - 1].id : null;
  });

  protected readonly dateOptions = computed(() => {
    const lang = this.i18n.language();
    return [...this.ordered()]
      .reverse()
      .map((s) => ({ label: formatDate(s.snapshotDate, lang), value: s.id }));
  });

  protected readonly sheet = computed(() => {
    const snapshot = this.ordered().find((s) => s.id === this.selectedId());
    return snapshot ? balanceSheetOf(snapshot, this.store.settings().classGroups) : null;
  });

  /** Long-term first, then short-term and other (design.md). */
  protected readonly liabilityGroups = computed(() => {
    const order: BalanceGroup[] = ['LONG_TERM', 'SHORT_TERM', 'OTHER_LIABILITY'];
    const groups = this.sheet()?.liabilities ?? [];
    return order.flatMap((g) => groups.filter((x) => x.group === g));
  });

  protected readonly negativeEquity = computed(() => Number(this.sheet()?.equity ?? 0) < 0);

  protected readonly classOptions = computed<ClassOption[]>(() => {
    this.i18n.language();
    const options = new Map<string, ClassOption>();
    for (const snapshot of this.ordered()) {
      for (const entry of snapshot.entries) {
        const value = classKey(entry.side, entry.class);
        if (options.has(value)) continue;
        const side = this.i18n.translate(
          entry.side === 'ASSET' ? 'wealth.balance.assets' : 'wealth.table.liabilities',
        );
        options.set(value, {
          value,
          side: entry.side,
          class: entry.class,
          label: `${this.classLabel(entry.class)} (${side})`,
        });
      }
    }
    return [...options.values()];
  });

  protected readonly groupOptions = computed(() => {
    const option = this.classOptions().find((o) => o.value === this.classChoice());
    if (!option) return [];
    return groupsOf(option.side).map((value) => ({
      label: this.i18n.translate(`wealth.groups.${value}`),
      value,
    }));
  });

  protected money(amount: string): string {
    return formatMoney(amount, this.i18n.language());
  }

  protected classLabel(ref: ClassRef): string {
    return labelOfClass(ref, (id) => this.i18n.translate(`wealth.classes.${id}`));
  }

  protected chooseClass(value: string | null): void {
    this.classChoice.set(value);
    const option = this.classOptions().find((o) => o.value === value);
    this.groupChoice.set(
      option ? effectiveGroup(option.side, option.class, this.store.settings().classGroups) : null,
    );
  }

  protected apply(): void {
    const option = this.classOptions().find((o) => o.value === this.classChoice());
    const group = this.groupChoice();
    if (!option || !group) return;
    this.failed.set(false);
    this.service.upsertClassGroup({ side: option.side, class: option.class, group }).subscribe({
      next: (settings) => this.store.setSettings(settings),
      error: () => this.failed.set(true),
    });
  }
}
