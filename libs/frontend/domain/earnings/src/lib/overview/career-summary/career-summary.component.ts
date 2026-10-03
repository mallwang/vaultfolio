import { Component, computed, inject, input } from '@angular/core';
import type { CareerEntry } from '@vaultfolio/api-contract';
import { AccordionModule } from 'primeng/accordion';
import { I18nService, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import {
  fill,
  formatMoney,
  formatMonth,
  formatPercent,
  formatShareOfGross,
} from '../../earnings-format';

interface Tile {
  label: string;
  value: string;
  perMonth: string | null;
  /** "38.4 % of gross" for net, taxes, social and bonus. */
  share: string | null;
}

/**
 * Career summary (FR-024): an accordion with "Whole career" (only with more than one employer, open
 * by default) and one row per employer; each body shows six tiles with the Ø per month employed.
 */
@Component({
  selector: 'app-earnings-career-summary',
  imports: [AccordionModule, TranslatePipe],
  template: `
    <section class="career" data-testid="earnings-career-summary">
      <h2>{{ 'earnings.overview.careerTitle' | translate }}</h2>
      <p class="muted">{{ 'earnings.overview.careerSub' | translate }}</p>
      <p-accordion [value]="openByDefault()" [multiple]="true">
        @for (entry of entries(); track entry.key) {
          <p-accordion-panel
            [value]="entry.key"
            [attr.data-testid]="'earnings-career-' + testKey(entry.key)"
          >
            <p-accordion-header>
              <span class="summary">
                <strong class="name">{{
                  entry.key === 'ALL' ? ('earnings.overview.wholeCareer' | translate) : entry.label
                }}</strong>
                <span class="muted">{{ subline(entry) }}</span>
                <span class="total">{{ money(entry.totals.gross) }}</span>
              </span>
            </p-accordion-header>
            <p-accordion-content>
              <div class="tiles">
                @for (tile of tiles(entry); track tile.label) {
                  <div class="tile">
                    <span class="tile__label">{{ tile.label }}</span>
                    <span class="tile__value">{{ tile.value }}</span>
                    @if (tile.share) {
                      <span class="muted">{{ tile.share }}</span>
                    }
                    @if (tile.perMonth) {
                      <span class="muted"
                        >{{ 'earnings.overview.avgPerMonth' | translate }} {{ tile.perMonth }}</span
                      >
                    }
                  </div>
                }
              </div>
            </p-accordion-content>
          </p-accordion-panel>
        }
      </p-accordion>
    </section>
  `,
  styles: `
    h2 {
      margin: 0;
      font-size: 1.1rem;
    }
    .muted {
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
    }
    .career > .muted {
      display: block;
      margin: 0.25rem 0 0.75rem;
    }
    .summary {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.25rem 0.75rem;
      width: 100%;
      padding-inline-end: 0.75rem;
    }
    .name {
      max-width: 28rem;
      overflow-wrap: anywhere;
    }
    .total {
      margin-inline-start: auto;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .tiles {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
      gap: 0.75rem;
    }
    .tile {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      padding: 0.75rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
    }
    .tile__label {
      font-size: 0.8125rem;
      color: var(--p-text-muted-color);
    }
    .tile__value {
      font-size: 1.125rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    @media (max-width: 640px) {
      .tiles {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `,
})
export class CareerSummaryComponent {
  readonly entries = input.required<CareerEntry[]>();
  private readonly i18n = inject(I18nService);

  /** "Whole career" is open by default — it only exists with more than one employer. */
  protected readonly openByDefault = computed(() =>
    this.entries().some((e) => e.key === 'ALL') ? ['ALL'] : [],
  );

  protected money(value: string): string {
    return formatMoney(value, this.i18n.language(), { whole: true });
  }

  protected testKey(key: string): string {
    return key.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  }

  protected subline(entry: CareerEntry): string {
    const lang = this.i18n.language();
    const parts = [
      `${formatMonth(entry.firstPeriod, lang)} – ${formatMonth(entry.lastPeriod, lang)}`,
      `${entry.monthsEmployed} ${this.i18n.translate(entry.monthsEmployed === 1 ? 'earnings.terms.month' : 'earnings.terms.months')}`,
    ];
    if (entry.employerCount > 1)
      parts.push(`${entry.employerCount} ${this.i18n.translate('earnings.terms.employers')}`);
    return parts.join(' · ');
  }

  protected tiles(entry: CareerEntry): Tile[] {
    const lang = this.i18n.language();
    const t = (k: string) => this.i18n.translate(`earnings.terms.${k}`);
    const tile = (key: 'gross' | 'net' | 'taxes' | 'social' | 'bonus'): Tile => {
      const share =
        key === 'gross' ? null : formatShareOfGross(entry.totals[key], entry.totals.gross, lang);
      return {
        label: t(key),
        value: formatMoney(entry.totals[key], lang, { whole: true }),
        perMonth: formatMoney(entry.perMonth[key], lang, { whole: true }),
        share: share && fill(this.i18n.translate('earnings.overview.shareOfGross'), { share }),
      };
    };
    return [
      tile('gross'),
      tile('net'),
      tile('taxes'),
      tile('social'),
      tile('bonus'),
      {
        label: t('netRatio'),
        value: formatPercent(entry.netRatio, lang),
        perMonth: null,
        share: null,
      },
    ];
  }
}
