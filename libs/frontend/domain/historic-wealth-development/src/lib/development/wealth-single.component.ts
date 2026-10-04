import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { WealthSnapshot } from '@vaultfolio/api-contract';
import {
  I18nService,
  IconComponent,
  ThemeService,
  TranslatePipe,
} from '@vaultfolio/frontend-shared-ui';
import { seriesOf } from '@vaultfolio/wealth';
import { classLabels, wealthChartColors } from '../charts/wealth-charts';
import { formatMoney, formatShare } from '../wealth-format';

/** Single-snapshot state (design.md "Ein Stichtag"): hint for a second snapshot + composition bar. */
@Component({
  selector: 'app-wealth-single',
  imports: [RouterLink, IconComponent, TranslatePipe],
  template: `
    <div class="note" data-testid="wealth-single-note">
      <app-icon name="info" />
      <span>{{ 'wealth.single.note' | translate }}</span>
      <a
        routerLink="/app/historic-wealth-development/new"
        data-testid="wealth-single-add-earlier"
        >{{ 'wealth.single.addEarlier' | translate }}</a
      >
    </div>
    <section class="panel" data-testid="wealth-composition">
      <h2>{{ 'wealth.single.composition' | translate }}</h2>
      <div class="bar" role="img" [attr.aria-label]="'wealth.single.composition' | translate">
        @for (part of parts(); track part.key) {
          <span
            class="bar__part"
            [style.flex-grow]="part.weight"
            [style.background]="part.color"
          ></span>
        }
      </div>
      <ul class="legend">
        @for (part of parts(); track part.key) {
          <li [attr.data-testid]="'wealth-composition-' + $index">
            <span class="swatch" [style.background]="part.color"></span>
            <span class="name">{{ part.label }}</span>
            <span class="amount">{{ part.amount }}</span>
            <span class="share">{{ part.share }}</span>
          </li>
        }
      </ul>
    </section>
  `,
  styles: `
    .note {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
      border-radius: var(--p-content-border-radius, 0.5rem);
      background: color-mix(in srgb, var(--p-primary-color) 10%, transparent);
    }
    .note a {
      color: var(--p-primary-color);
    }
    .panel {
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius, 0.5rem);
      background: var(--p-content-background);
      padding: 1rem;
    }
    h2 {
      margin: 0 0 0.75rem;
      font-size: 1rem;
    }
    .bar {
      display: flex;
      height: 1.25rem;
      border-radius: 0.375rem;
      overflow: hidden;
    }
    .bar__part {
      flex-basis: 0;
    }
    .legend {
      list-style: none;
      margin: 0.75rem 0 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }
    .legend li {
      display: grid;
      grid-template-columns: 0.75rem minmax(0, 1fr) auto 4rem;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
    }
    .swatch {
      width: 0.75rem;
      height: 0.75rem;
      border-radius: 0.2rem;
    }
    .amount,
    .share {
      text-align: end;
      font-variant-numeric: tabular-nums;
    }
    .share {
      color: var(--p-text-muted-color);
    }
  `,
})
export class WealthSingleComponent {
  private readonly i18n = inject(I18nService);
  private readonly theme = inject(ThemeService);

  readonly snapshot = input.required<WealthSnapshot>();

  protected readonly parts = computed(() => {
    const lang = this.i18n.language();
    const snapshot = this.snapshot();
    const series = seriesOf([snapshot]);
    const labelOf = classLabels([snapshot], (id) => this.i18n.translate(`wealth.classes.${id}`));
    const colors = wealthChartColors(this.theme.theme()).classes;
    const keys = Object.keys(series.byClass).filter((key) => key.startsWith('ASSET:'));
    const total = series.assets[0];
    return keys
      .map((key, index) => {
        const amount = series.byClass[key][0];
        return {
          key,
          label: labelOf.get(key) ?? key,
          amount: formatMoney(amount, lang),
          share: formatShare(amount, total, lang),
          weight: Number(amount),
          color: colors[index % colors.length],
        };
      })
      .filter((part) => part.weight > 0);
  });
}
