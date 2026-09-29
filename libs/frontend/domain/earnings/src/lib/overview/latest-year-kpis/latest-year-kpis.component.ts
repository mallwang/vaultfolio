import { Component, computed, inject, input } from '@angular/core';
import type { LatestYear, LatestYearFigures } from '@vaultfolio/api-contract';
import { I18nService, IconComponent } from '@vaultfolio/frontend-shared-ui';
import { fill, formatMoney, formatPercent, monthName } from '../../earnings-format';

type KpiKey = 'gross' | 'net' | 'taxes' | 'social' | 'bonus' | 'netRatio';

export interface KpiTile {
  key: KpiKey;
  label: string;
  value: string;
  /** Formatted signed change, `null` without a previous-year value. */
  delta: string | null;
  previous: string | null;
  direction: 'up' | 'down' | 'flat';
  /** Good/bad coloring per design.md: more taxes/social is bad, more gross/net/bonus/net ratio is good. */
  tone: 'good' | 'bad' | 'neutral';
}

const HIGHER_IS_BAD: ReadonlySet<KpiKey> = new Set(['taxes', 'social']);

/**
 * Latest-year KPIs (FR-025): the latest year so far compared with the same months of the previous
 * year — an incomplete year is never compared with a full previous year.
 */
@Component({
  selector: 'app-earnings-latest-year-kpis',
  imports: [IconComponent],
  template: `
    @if (latest(); as year) {
      <section data-testid="earnings-latest-year">
        <h2>{{ heading() }}</h2>
        <p class="muted">{{ subline() }}</p>
        <div class="tiles">
          @for (tile of tiles(); track tile.key) {
            <div class="tile" [attr.data-testid]="'earnings-kpi-' + tile.key">
              <span class="tile__label">{{ tile.label }}</span>
              <span class="tile__value">{{ tile.value }}</span>
              @if (tile.delta) {
                <span class="delta" [class]="'delta delta--' + tile.tone">
                  <app-icon [name]="tile.direction === 'down' ? 'sort-down' : 'sort-up'" />
                  {{ tile.delta }}
                  <span class="muted">{{ vs() }} {{ tile.previous }}</span>
                </span>
              }
            </div>
          }
        </div>
      </section>
    }
  `,
  styles: `
    h2 {
      margin: 0;
      font-size: 1.1rem;
    }
    .muted {
      color: var(--p-text-muted-color);
      font-size: 0.8125rem;
    }
    section > .muted {
      display: block;
      margin: 0.25rem 0 0.75rem;
      font-size: 0.875rem;
    }
    .tiles {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
      gap: 0.75rem;
    }
    .tile {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 0.875rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
      background: var(--p-content-background);
    }
    .tile__label {
      font-size: 0.8125rem;
      color: var(--p-text-muted-color);
    }
    .tile__value {
      font-size: 1.25rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .delta {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.8125rem;
      font-variant-numeric: tabular-nums;
    }
    .delta--good {
      color: var(--p-green-700);
    }
    .delta--bad {
      color: var(--p-red-700);
    }
    :host-context(.app-dark) .delta--good {
      color: var(--p-green-400);
    }
    :host-context(.app-dark) .delta--bad {
      color: var(--p-red-400);
    }
    @media (max-width: 640px) {
      .tiles {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `,
})
export class LatestYearKpisComponent {
  readonly latest = input<LatestYear | null>(null);
  private readonly i18n = inject(I18nService);

  protected readonly heading = computed(() => {
    const year = this.latest();
    return year
      ? fill(this.i18n.translate('earnings.overview.latestTitle'), {
          year: year.year,
          months: year.months,
        })
      : '';
  });

  protected readonly subline = computed(() => {
    const year = this.latest();
    if (!year) return '';
    const lang = this.i18n.language();
    const [from, to] = year.comparedMonths;
    const range =
      from === to ? monthName(from, lang) : `${monthName(from, lang)}–${monthName(to, lang)}`;
    const key = year.previous
      ? 'earnings.overview.latestSub'
      : 'earnings.overview.latestNoPrevious';
    return fill(this.i18n.translate(key), { previousYear: year.year - 1, range });
  });

  protected readonly vs = computed(() => {
    this.i18n.language();
    return this.i18n.translate('earnings.overview.vs');
  });

  protected readonly tiles = computed(() => {
    const year = this.latest();
    return year
      ? kpiTiles(year.current, year.previous, this.i18n.language(), (k) => this.i18n.translate(k))
      : [];
  });
}

/** Builds the six KPI tiles; exported for exact-value tests. */
export function kpiTiles(
  current: LatestYearFigures,
  previous: LatestYearFigures | null,
  lang: string,
  translate: (key: string) => string,
): KpiTile[] {
  const keys: KpiKey[] = ['gross', 'net', 'taxes', 'social', 'bonus', 'netRatio'];
  return keys.map((key) => {
    const isRatio = key === 'netRatio';
    const show = (value: string) =>
      isRatio ? formatPercent(value, lang) : formatMoney(value, lang, { whole: true });
    const change = previous ? changeOf(current[key], previous[key], isRatio) : null;
    const direction = directionOf(change);
    return {
      key,
      label: translate(`earnings.terms.${key}`),
      value: show(current[key]),
      delta: change === null ? null : deltaText(change, isRatio, lang, translate),
      previous: previous ? show(previous[key]) : null,
      direction,
      tone: toneOf(direction, key),
    };
  });
}

/** Rounded change: cents for amounts, 4 dp for the ratio. */
function changeOf(now: string, before: string, isRatio: boolean): number {
  const scale = isRatio ? 10000 : 100;
  return Math.round((Number(now) - Number(before)) * scale) / scale;
}

function directionOf(change: number | null): KpiTile['direction'] {
  if (change === null || change === 0) return 'flat';
  return change > 0 ? 'up' : 'down';
}

function toneOf(direction: KpiTile['direction'], key: KpiKey): KpiTile['tone'] {
  if (direction === 'flat') return 'neutral';
  return (direction === 'up') === HIGHER_IS_BAD.has(key) ? 'bad' : 'good';
}

/** Amount change as signed money; net-ratio change in percentage points. */
function deltaText(
  change: number,
  isRatio: boolean,
  lang: string,
  translate: (key: string) => string,
): string {
  if (!isRatio) return formatMoney(change.toFixed(2), lang, { signed: true, whole: true });
  const points = new Intl.NumberFormat(lang, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  });
  return `${points.format(change * 100)} ${translate('earnings.overview.percentagePoints')}`;
}
