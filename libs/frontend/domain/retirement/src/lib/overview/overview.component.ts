import { Component, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import type {
  RetirementPillarSummary,
  RetirementSummary,
  RetirementSummaryItem,
} from '@vaultfolio/api-contract';
import { I18nService, IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { PrivacyInfoComponent } from '../privacy-note/privacy-info.component';
import { fill, formatDate, formatMoney } from '../retirement-format';
import { RetirementService } from '../retirement.service';

type PillarKey = 'statutory' | 'occupational' | 'private';

/**
 * Overview tab (design.md "Übersicht"): four KPI tiles, the guaranteed-vs-expected bar with the
 * difference, a card per pillar with its sub-total and entry rows, and the hints for outdated or
 * incomplete entries. Figures come from `GET /retirement/summary` and reload after every write.
 * Guaranteed amounts are bold with a "garantiert" tag; projections are italic with "≈".
 */
@Component({
  selector: 'app-retirement-overview',
  imports: [
    RouterLink,
    ButtonModule,
    MessageModule,
    IconComponent,
    TranslatePipe,
    EmptyStateComponent,
    PrivacyInfoComponent,
  ],
  template: `
    @if (loadFailed()) {
      <p-message severity="error" data-testid="retirement-overview-error">{{
        'retirement.errors.loadFailed' | translate
      }}</p-message>
    }
    @if (summary(); as s) {
      @if (isEmpty()) {
        <app-retirement-empty-state
          testId="retirement-overview-empty"
          titleKey="retirement.overview.empty.title"
          bodyKey="retirement.overview.empty.body"
        />
        <app-retirement-privacy-info />
      } @else {
        <div class="kpis">
          <div class="tile tile--hero" data-testid="retirement-kpi-expected">
            <span class="tile__label">{{ 'retirement.overview.kpi.expected' | translate }}</span>
            <span class="tile__value projection">≈ {{ money(s.expectedMonthly) }}</span>
            <span class="tile__hint">
              <span class="tag tag--projection">{{
                'retirement.labels.projection' | translate
              }}</span>
              {{ 'retirement.overview.kpi.expectedHint' | translate }}
            </span>
          </div>
          <div class="tile" data-testid="retirement-kpi-guaranteed">
            <span class="tile__label">{{ 'retirement.overview.kpi.guaranteed' | translate }}</span>
            <span class="tile__value guaranteed">{{ money(s.guaranteedMonthly) }}</span>
            <span class="tile__hint">
              <span class="tag tag--guaranteed">{{
                'retirement.labels.guaranteed' | translate
              }}</span>
              {{ 'retirement.overview.kpi.guaranteedHint' | translate }}
            </span>
          </div>
          <div class="tile" data-testid="retirement-kpi-savings">
            <span class="tile__label">{{ 'retirement.overview.kpi.savings' | translate }}</span>
            <span class="tile__value">{{ money(s.monthlySavings) }}</span>
            <span class="tile__hint">{{ 'retirement.overview.kpi.savingsHint' | translate }}</span>
          </div>
          <div class="tile" data-testid="retirement-kpi-start">
            <span class="tile__label">{{ 'retirement.overview.kpi.start' | translate }}</span>
            <span class="tile__value">{{ s.pensionStart ? date(s.pensionStart.date) : '–' }}</span>
            @if (s.pensionStart; as start) {
              <span class="tile__hint">
                {{
                  (start.source === 'STATUTORY'
                    ? 'retirement.overview.kpi.startStatutory'
                    : 'retirement.overview.kpi.startEarliest'
                  ) | translate
                }}
              </span>
            }
            @if (earlierCount() > 0) {
              <span class="tile__hint" data-testid="retirement-kpi-start-earlier">{{
                startNote('startEarlier', earlierCount())
              }}</span>
            }
            @if (laterCount() > 0) {
              <span class="tile__hint" data-testid="retirement-kpi-start-later">{{
                startNote('startLater', laterCount())
              }}</span>
            }
          </div>
        </div>

        @if (hasProjection()) {
          <section class="panel" data-testid="retirement-overview-bar">
            <header class="panel__head">
              <h3>{{ 'retirement.overview.bar.title' | translate }}</h3>
              <span class="badge" data-testid="retirement-overview-difference">{{
                differenceLabel()
              }}</span>
            </header>
            <div
              class="bar"
              role="img"
              [attr.aria-label]="money(s.guaranteedMonthly) + ' / ' + money(s.expectedMonthly)"
            >
              <div class="bar__guaranteed" [style.width.%]="guaranteedShare()"></div>
              <div class="bar__additional"></div>
            </div>
            <div class="legend">
              <span
                ><i class="swatch swatch--guaranteed"></i
                >{{ 'retirement.overview.bar.guaranteed' | translate }}</span
              >
              <span
                ><i class="swatch swatch--additional"></i
                >{{ 'retirement.overview.bar.additional' | translate }}</span
              >
            </div>
          </section>
        }

        <div class="pillars">
          @for (p of pillarList(); track p.key) {
            <section class="panel" [attr.data-testid]="'retirement-overview-pillar-' + p.key">
              <header class="panel__head">
                <h3>{{ 'retirement.pillars.' + p.key | translate }}</h3>
                <span class="muted">{{ entriesLabel(p.summary.count) }}</span>
              </header>
              @if (p.summary.count === 0) {
                <p class="muted" [attr.data-testid]="'retirement-overview-pillar-empty-' + p.key">
                  {{ 'retirement.overview.pillar.empty' + p.emptyKey | translate }}
                </p>
              } @else {
                <dl class="subtotals">
                  <div>
                    <dt>{{ 'retirement.overview.pillar.guaranteed' | translate }}</dt>
                    <dd class="guaranteed">{{ money(p.summary.guaranteedMonthly) }}</dd>
                  </div>
                  <div>
                    <dt>{{ 'retirement.overview.pillar.expected' | translate }}</dt>
                    <dd class="projection">≈ {{ money(p.summary.expectedMonthly) }}</dd>
                  </div>
                </dl>
                <ul class="rows">
                  @for (item of p.summary.items; track item.id) {
                    <li [attr.data-testid]="'retirement-overview-row-' + item.id">
                      <span class="row__name">
                        {{
                          item.providerLabel ??
                            ('retirement.types.' + item.contractType | translate)
                        }}
                        <span class="badge badge--muted">{{
                          (item.origin === 'IMPORTED'
                            ? 'retirement.badges.imported'
                            : 'retirement.badges.manual'
                          ) | translate
                        }}</span>
                        @if (item.outdated) {
                          <span class="badge badge--warn" data-testid="retirement-badge-outdated">{{
                            'retirement.badges.outdated' | translate
                          }}</span>
                        }
                        @if (item.incomplete) {
                          <span
                            class="badge badge--warn"
                            data-testid="retirement-badge-incomplete"
                            >{{ 'retirement.badges.incomplete' | translate }}</span
                          >
                        }
                      </span>
                      <span class="row__amount">{{ rowAmount(item) }}</span>
                    </li>
                  }
                </ul>
              }
              <a
                pButton
                severity="secondary"
                [text]="true"
                [routerLink]="['..', p.key]"
                [attr.data-testid]="'retirement-overview-details-' + p.key"
              >
                {{ 'retirement.overview.pillar.details' | translate }}
              </a>
            </section>
          }
        </div>

        @if (s.flags.outdatedCount > 0) {
          <p-message severity="warn" data-testid="retirement-overview-outdated">{{
            note('outdated', s.flags.outdatedCount)
          }}</p-message>
        }
        @if (s.flags.incompleteCount > 0) {
          <p-message severity="warn" data-testid="retirement-overview-incomplete">{{
            note('incomplete', s.flags.incompleteCount)
          }}</p-message>
        }
        <p-message severity="info" data-testid="retirement-overview-capital-note">{{
          'retirement.overview.notes.capital' | translate
        }}</p-message>
      }
    } @else if (!loadFailed()) {
      <p class="muted" data-testid="retirement-overview-loading">
        {{ 'retirement.overview.loading' | translate }}
      </p>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(14rem, 100%), 1fr));
      gap: 0.75rem;
    }
    .tile,
    .panel {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      padding: 1rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
      background: var(--p-content-background);
    }
    .tile--hero {
      border-color: var(--p-primary-color);
    }
    .tile__label,
    .muted,
    .tile__hint {
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
    }
    .tile__value {
      font-size: 1.5rem;
      font-weight: 600;
    }
    .guaranteed {
      font-weight: 700;
      color: var(--p-green-600);
    }
    .projection {
      font-style: italic;
    }
    .tag,
    .badge {
      display: inline-block;
      padding: 0.0625rem 0.5rem;
      border-radius: 999px;
      font-size: 0.75rem;
      background: color-mix(in srgb, var(--p-text-muted-color) 14%, transparent);
      color: var(--p-text-color);
    }
    .tag--guaranteed {
      background: color-mix(in srgb, var(--p-green-500) 18%, transparent);
    }
    .tag--projection {
      font-style: italic;
    }
    .badge--muted {
      color: var(--p-text-muted-color);
    }
    .badge--warn {
      background: color-mix(in srgb, var(--p-orange-500) 18%, transparent);
    }
    .panel__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }
    h3 {
      margin: 0;
      font-size: 1rem;
    }
    .bar {
      display: flex;
      height: 1.25rem;
      border-radius: 0.375rem;
      overflow: hidden;
    }
    .bar__guaranteed {
      background: var(--p-green-500);
    }
    .bar__additional {
      flex: 1;
      background: repeating-linear-gradient(
        45deg,
        var(--p-primary-color),
        var(--p-primary-color) 4px,
        transparent 4px,
        transparent 8px
      );
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      font-size: 0.875rem;
    }
    .swatch {
      display: inline-block;
      width: 0.75rem;
      height: 0.75rem;
      margin-inline-end: 0.375rem;
      border-radius: 2px;
    }
    .swatch--guaranteed {
      background: var(--p-green-500);
    }
    .swatch--additional {
      background: var(--p-primary-color);
      opacity: 0.6;
    }
    .pillars {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(20rem, 100%), 1fr));
      gap: 0.75rem;
    }
    .subtotals {
      display: flex;
      gap: 1.5rem;
      margin: 0;
    }
    .subtotals dt {
      color: var(--p-text-muted-color);
      font-size: 0.8125rem;
    }
    .subtotals dd {
      margin: 0;
    }
    .rows {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .rows li {
      display: flex;
      justify-content: space-between;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .row__name {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.375rem;
    }
    a.p-button {
      align-self: flex-start;
      text-decoration: none;
    }
  `,
})
export class OverviewComponent {
  private readonly service = inject(RetirementService);
  private readonly i18n = inject(I18nService);

  protected readonly summary = signal<RetirementSummary | null>(null);
  protected readonly loadFailed = signal(false);

  protected readonly isEmpty = computed(() => (this.summary()?.items.length ?? 0) === 0);
  protected readonly hasProjection = computed(
    () => Number(this.summary()?.expectedMonthly ?? 0) > 0,
  );
  protected readonly earlierCount = computed(() => this.countRelation('EARLIER'));
  protected readonly laterCount = computed(() => this.countRelation('LATER'));

  /** Guaranteed share of the expected total (display only), clamped to 0–100. */
  protected readonly guaranteedShare = computed(() => {
    const s = this.summary();
    const expected = Number(s?.expectedMonthly ?? 0);
    if (!s || expected <= 0) return 0;
    return Math.min(100, (Number(s.guaranteedMonthly) / expected) * 100);
  });

  protected readonly pillarList = computed(() => {
    const s = this.summary();
    if (!s) return [];
    const list: { key: PillarKey; emptyKey: string; summary: RetirementPillarSummary }[] = [
      { key: 'statutory', emptyKey: 'Statutory', summary: s.pillars.statutory },
      { key: 'occupational', emptyKey: 'Occupational', summary: s.pillars.occupational },
      { key: 'private', emptyKey: 'Private', summary: s.pillars.private },
    ];
    return list;
  });

  constructor() {
    toObservable(this.service.changes)
      .pipe(
        switchMap(() =>
          this.service.summary().pipe(
            catchError(() => {
              this.loadFailed.set(true);
              return of(null);
            }),
          ),
        ),
      )
      .subscribe((s) => {
        if (s) {
          this.loadFailed.set(false);
          this.summary.set(s);
        }
      });
  }

  protected money(value: string): string {
    return formatMoney(value, this.i18n.language());
  }

  protected date(value: string): string {
    return formatDate(value, this.i18n.language());
  }

  protected entriesLabel(n: number): string {
    return fill(this.i18n.translate('retirement.overview.pillar.entries'), { n });
  }

  protected note(key: 'outdated' | 'incomplete', n: number): string {
    return fill(this.i18n.translate(`retirement.overview.notes.${key}`), { n });
  }

  protected startNote(key: 'startEarlier' | 'startLater', n: number): string {
    return fill(this.i18n.translate(`retirement.overview.kpi.${key}`), { n });
  }

  protected differenceLabel(): string {
    const s = this.summary();
    return fill(this.i18n.translate('retirement.overview.bar.difference'), {
      amount: this.money(s?.differenceMonthly ?? '0'),
    });
  }

  /** Guaranteed amount when there is one, else the projection, else the capital figure. */
  protected rowAmount(item: RetirementSummaryItem): string {
    if (Number(item.guaranteedMonthly) > 0) return this.money(item.guaranteedMonthly);
    if (Number(item.expectedMonthly) > 0) return `≈ ${this.money(item.expectedMonthly)}`;
    if (item.capital !== null)
      return `${this.i18n.translate('retirement.overview.pillar.capital')} ${this.money(item.capital)}`;
    return this.i18n.translate('retirement.overview.pillar.noGuarantee');
  }

  private countRelation(relation: 'EARLIER' | 'LATER'): number {
    return this.summary()?.items.filter((i) => i.startRelation === relation).length ?? 0;
  }
}
