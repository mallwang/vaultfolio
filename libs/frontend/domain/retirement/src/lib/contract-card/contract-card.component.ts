import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import type { RetirementRecord } from '@vaultfolio/api-contract';
import { expectedMonthlyOf, isIncomplete, isOutdated } from '@vaultfolio/retirement';
import { I18nService, IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { type FigureKind, figureKind, sortFigureKeys } from '../retirement-fields';
import { displayFigure, formatDate, formatMoney } from '../retirement-format';

interface Entry {
  key: string;
  label: string;
  value: string;
  kind: FigureKind;
}

interface Tile {
  key: string;
  label: string;
  value: string;
  selected: boolean;
}

/** Figures shown as tiles or in the capital box, not in the key-figure grid. */
const NOT_IN_GRID = new Set([
  'scenarioMonthly',
  'projectedAt1Pct',
  'projectedAt2Pct',
  'accountBalance',
  'finalBonus',
]);

/**
 * One contract card (design.md "Gesetzlich / Betrieblich / Privat tabs"): origin and freshness
 * badges, copyable contract number, key figures with guaranteed (bold, tag) and projection
 * (italic "≈", tag) styling, scenario tiles for statements that print them and the capital box for
 * capital accounts. Imported cards are read-only: only "replace by a new document", "add
 * supplements" and "delete" are offered; manual cards offer "edit" and "delete".
 */
@Component({
  selector: 'app-retirement-contract-card',
  imports: [RouterLink, ButtonModule, IconComponent, TranslatePipe],
  template: `
    <article class="card" [attr.data-testid]="'retirement-card-' + record().id">
      <header class="head">
        <div>
          <h3 data-testid="retirement-card-title">{{ title() }}</h3>
          <p class="sub">
            {{ 'retirement.types.' + record().contractType | translate }}
            · {{ 'retirement.status.' + record().status | translate }}
          </p>
        </div>
        <div class="badges">
          @if (imported()) {
            <span class="badge badge--imported" data-testid="retirement-card-badge-imported">
              <app-icon name="lock" /> {{ 'retirement.badges.imported' | translate }}
            </span>
            @if (record().import?.ocrRead) {
              <span class="badge badge--warn" data-testid="retirement-card-badge-ocr">{{
                'retirement.badges.ocr' | translate
              }}</span>
            }
          } @else {
            <span class="badge" data-testid="retirement-card-badge-manual">{{
              'retirement.badges.manual' | translate
            }}</span>
          }
          @if (outdated()) {
            <span class="badge badge--warn" data-testid="retirement-card-badge-outdated">{{
              'retirement.badges.outdated' | translate
            }}</span>
          }
          @if (incomplete()) {
            <span class="badge badge--warn" data-testid="retirement-card-badge-incomplete">{{
              'retirement.badges.incomplete' | translate
            }}</span>
          }
        </div>
      </header>

      @if (record().identifier; as identifier) {
        <p class="identifier">
          <span class="muted">{{ 'retirement.fields.identifier' | translate }}</span>
          <span data-testid="retirement-card-identifier">{{ identifier }}</span>
          <button
            type="button"
            class="copy"
            [attr.aria-label]="'retirement.card.copy' | translate"
            data-testid="retirement-card-copy"
            (click)="copy(identifier)"
          >
            <app-icon [name]="copied() ? 'check-circle' : 'content-copy'" />
          </button>
        </p>
      }

      @if (capital(); as box) {
        <div class="capital" data-testid="retirement-card-capital">
          <span class="muted">{{ 'retirement.card.capital' | translate }}</span>
          <strong>{{ box.value }}</strong>
          <span class="muted">{{ 'retirement.card.noMonthlyPension' | translate }}</span>
          @if (!expected()) {
            <span class="muted" data-testid="retirement-card-expected-missing">{{
              'retirement.card.expectedMissing' | translate
            }}</span>
          }
        </div>
      }

      @if (record().contractType === 'ALTERSVORSORGEDEPOT') {
        <p class="muted" data-testid="retirement-card-no-guarantee">
          {{ 'retirement.labels.noGuarantee' | translate }}
        </p>
      }

      <dl class="figures">
        @for (entry of entries(); track entry.key) {
          <div class="figure" [attr.data-testid]="'retirement-card-figure-' + entry.key">
            <dt>
              {{ entry.label }}
              @switch (entry.kind) {
                @case ('guaranteed') {
                  <span class="tag tag--guaranteed">{{
                    'retirement.labels.guaranteed' | translate
                  }}</span>
                }
                @case ('projection') {
                  <span class="tag tag--projection">{{
                    'retirement.labels.projection' | translate
                  }}</span>
                }
              }
            </dt>
            <dd
              [class.value--guaranteed]="entry.kind === 'guaranteed'"
              [class.value--projection]="entry.kind === 'projection'"
            >
              @if (entry.kind === 'projection') {
                <span aria-hidden="true">≈ </span>
              }
              {{ entry.value }}
            </dd>
          </div>
        }
      </dl>

      @if (adjustments().length > 0) {
        <div class="tiles" data-testid="retirement-card-adjustments">
          @for (tile of adjustments(); track tile.key) {
            <div class="tile">
              <span class="muted">{{ tile.label }}</span>
              <em>≈ {{ tile.value }}</em>
            </div>
          }
        </div>
      }

      @if (scenarios().length > 0) {
        <div class="tiles" data-testid="retirement-card-scenarios">
          @for (tile of scenarios(); track tile.key) {
            <div
              class="tile"
              [class.tile--selected]="tile.selected"
              [attr.data-testid]="'retirement-card-scenario-' + tile.key"
            >
              <span class="muted">{{ tile.label }}</span>
              <em>≈ {{ tile.value }}</em>
            </div>
          }
        </div>
      }

      <footer class="foot">
        @if (imported()) {
          <span class="muted note" data-testid="retirement-card-readonly-note">{{
            'retirement.card.importedNote' | translate
          }}</span>
          <div class="actions">
            @if (hasSupplement()) {
              <a
                pButton
                size="small"
                severity="secondary"
                [outlined]="true"
                [routerLink]="['/app/retirement', record().id, 'edit']"
                [queryParams]="{ from: record().pillar.toLowerCase() }"
                data-testid="retirement-card-supplement"
              >
                {{ 'retirement.card.supplement' | translate }}
              </a>
            }
            <a
              pButton
              size="small"
              severity="secondary"
              [outlined]="true"
              routerLink="/app/retirement/import"
              [queryParams]="{ replaces: record().id, from: record().pillar.toLowerCase() }"
              data-testid="retirement-card-replace"
            >
              {{ 'retirement.card.replace' | translate }}
            </a>
            <button
              pButton
              type="button"
              size="small"
              severity="danger"
              [text]="true"
              data-testid="retirement-card-delete"
              (click)="remove.emit(record())"
            >
              {{ 'retirement.card.delete' | translate }}
            </button>
          </div>
        } @else {
          <div class="actions">
            <a
              pButton
              size="small"
              severity="secondary"
              [outlined]="true"
              [routerLink]="['/app/retirement', record().id, 'edit']"
              [queryParams]="{ from: record().pillar.toLowerCase() }"
              data-testid="retirement-card-edit"
            >
              {{ 'retirement.card.edit' | translate }}
            </a>
            <button
              pButton
              type="button"
              size="small"
              severity="danger"
              [text]="true"
              data-testid="retirement-card-delete"
              (click)="remove.emit(record())"
            >
              {{ 'retirement.card.delete' | translate }}
            </button>
          </div>
        }
      </footer>
    </article>
  `,
  styles: `
    .card {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
      background: var(--p-content-background);
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 0.5rem;
    }
    h3 {
      margin: 0;
      font-size: 1.05rem;
    }
    .sub,
    .muted {
      margin: 0;
      color: var(--p-text-muted-color);
      font-size: 0.8125rem;
    }
    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
      align-items: flex-start;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.125rem 0.5rem;
      border-radius: 999px;
      font-size: 0.75rem;
      line-height: 1.25rem;
      color: var(--p-text-muted-color);
      background: color-mix(in srgb, var(--p-text-muted-color) 14%, transparent);
    }
    /* The glyph lives in app-icon's own encapsulated template, so sizing it needs ng-deep. */
    .badge ::ng-deep .material-symbols-outlined {
      font-size: 0.875rem;
    }
    .badge--imported {
      color: var(--p-primary-color);
      background: color-mix(in srgb, var(--p-primary-color) 14%, transparent);
    }
    .badge--warn {
      color: var(--p-orange-700);
      background: color-mix(in srgb, var(--p-orange-500) 16%, transparent);
    }
    .identifier {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0;
      font-size: 0.875rem;
    }
    .copy {
      display: inline-flex;
      border: 0;
      padding: 0.125rem;
      background: none;
      color: var(--p-primary-color);
      font-size: 0.875rem;
      cursor: pointer;
    }
    .copy ::ng-deep .material-symbols-outlined {
      font-size: 1rem;
    }
    .capital {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      padding: 0.75rem;
      border-radius: var(--p-content-border-radius);
      background: color-mix(in srgb, var(--p-primary-color) 8%, transparent);
    }
    .capital strong {
      font-size: 1.4rem;
    }
    .figures {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(14rem, 100%), 1fr));
      gap: 0.5rem 1rem;
      margin: 0;
    }
    .figure {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }
    dt {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      color: var(--p-text-muted-color);
      font-size: 0.8125rem;
    }
    dd {
      margin: 0;
    }
    .value--guaranteed {
      font-weight: 700;
    }
    .value--projection {
      font-style: italic;
    }
    .tag {
      padding: 0 0.4rem;
      border-radius: 4px;
      font-size: 0.7rem;
    }
    .tag--guaranteed {
      color: var(--p-green-700);
      background: color-mix(in srgb, var(--p-green-500) 16%, transparent);
    }
    .tag--projection {
      font-style: italic;
      color: var(--p-text-muted-color);
      background: color-mix(in srgb, var(--p-text-muted-color) 14%, transparent);
    }
    .tiles {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
      gap: 0.5rem;
    }
    .tile {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
    }
    .tile--selected {
      border-color: var(--p-primary-color);
    }
    .foot {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding-top: 0.5rem;
      border-top: 1px solid var(--p-content-border-color);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    a.p-button {
      text-decoration: none;
    }
  `,
})
export class ContractCardComponent {
  private readonly i18n = inject(I18nService);

  readonly record = input.required<RetirementRecord>();
  /** Clock for the "outdated" badge; defaults to the current time. */
  readonly now = input<Date>(new Date());
  readonly remove = output<RetirementRecord>();

  protected readonly copied = signal(false);

  protected readonly imported = computed(() => this.record().origin === 'IMPORTED');
  protected readonly outdated = computed(() => isOutdated(this.record().statementDate, this.now()));
  protected readonly incomplete = computed(() => isIncomplete(this.record()));
  protected readonly expected = computed(() => expectedMonthlyOf(this.record()));
  protected readonly hasSupplement = computed(
    () =>
      this.imported() &&
      this.record().contractType !== 'STATUTORY_PENSION' &&
      this.record().contractType !== 'ALTERSVORSORGEDEPOT',
  );

  protected readonly title = computed(
    () =>
      this.record().providerLabel ??
      this.i18n.translate(`retirement.types.${this.record().contractType}`),
  );

  private get lang(): string {
    return this.i18n.language();
  }

  /** Figures of the record plus the supplement, as label/value pairs in display order. */
  protected readonly entries = computed<Entry[]>(() => {
    this.i18n.language();
    const r = this.record();
    const values: Record<string, unknown> = {
      ...(r.figures as unknown as Record<string, unknown>),
    };
    for (const [k, v] of Object.entries(r.supplement ?? {})) {
      if (k !== 'expectedScenario') values[k] = v;
    }
    const keys = sortFigureKeys(Object.keys(values).filter((k) => !NOT_IN_GRID.has(k)));
    const out: Entry[] = keys.map((key) => ({
      key,
      label: this.i18n.translate(`retirement.fields.${key}`),
      value: displayFigure(
        key,
        values[key],
        this.lang,
        this.i18n.translate('retirement.card.years'),
      ),
      kind: figureKind(key),
    }));
    if (r.payoutStart) {
      out.unshift({
        key: 'payoutStart',
        label: this.i18n.translate('retirement.fields.payoutStart'),
        value: formatDate(r.payoutStart, this.lang),
        kind: 'neutral',
      });
    }
    // The statutory projection is the headline figure of its card.
    if (r.contractType === 'STATUTORY_PENSION') {
      out.sort(
        (a, b) => Number(b.key === 'projectedMonthly') - Number(a.key === 'projectedMonthly'),
      );
    }
    out.push({
      key: 'statementDate',
      label: this.i18n.translate('retirement.fields.statementDate'),
      value: formatDate(r.statementDate, this.lang),
      kind: 'neutral',
    });
    return out;
  });

  protected readonly capital = computed(() => {
    const r = this.record();
    if (r.contractType !== 'CAPITAL_ACCOUNT') return null;
    const balance = (r.figures as { accountBalance?: string }).accountBalance;
    return balance === undefined ? null : { value: formatMoney(balance, this.lang) };
  });

  protected readonly adjustments = computed<Tile[]>(() => {
    this.i18n.language();
    const r = this.record();
    if (r.contractType !== 'STATUTORY_PENSION') return [];
    const f = r.figures as { projectedAt1Pct?: string; projectedAt2Pct?: string };
    return (['projectedAt1Pct', 'projectedAt2Pct'] as const)
      .filter((k) => f[k] !== undefined)
      .map((key) => ({
        key,
        label: this.i18n.translate(`retirement.fields.${key}`),
        value: formatMoney(f[key], this.lang),
        selected: false,
      }));
  });

  protected readonly scenarios = computed<Tile[]>(() => {
    const r = this.record();
    const scenarios = (r.figures as { scenarioMonthly?: Record<string, string> }).scenarioMonthly;
    if (!scenarios) return [];
    const chosen = r.supplement?.expectedScenario ?? '3';
    return Object.entries(scenarios).map(([key, value]) => ({
      key,
      label: `${key} %`,
      value: formatMoney(value, this.lang),
      selected: key === chosen,
    }));
  });

  protected copy(text: string): void {
    void navigator.clipboard?.writeText(text).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    });
  }
}
