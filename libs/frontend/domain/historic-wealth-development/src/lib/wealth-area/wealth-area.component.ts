import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TabsModule } from 'primeng/tabs';
import {
  ExportControlComponent,
  I18nService,
  IconComponent,
  TranslatePipe,
  routeTabs,
} from '@vaultfolio/frontend-shared-ui';
import type { Period } from '@vaultfolio/wealth';
import { WealthStore } from '../wealth-store';
import { WealthService } from '../wealth.service';
import { WealthUnavailableComponent } from './wealth-unavailable.component';

const TABS = ['development', 'balance'] as const;
const PERIODS: readonly Period[] = ['1y', '3y', 'all'];

/**
 * Wealth area (design.md "Toolbar + tabs"): period filter shared by both tabs and the PDF, the
 * export link and "Stichtag erfassen" in the toolbar; tabs Entwicklung and Bilanz as child routes.
 * With the key unavailable only the unavailable state renders — no toolbar, tabs or figures.
 *
 * Inline template/styles: consumed cross-package as a lazily loaded route target (see
 * `IconComponent`'s note in `@vaultfolio/frontend-shared-ui`).
 */
@Component({
  selector: 'app-wealth-area',
  imports: [
    FormsModule,
    RouterOutlet,
    RouterLink,
    TabsModule,
    ButtonModule,
    MessageModule,
    SelectButtonModule,
    ExportControlComponent,
    IconComponent,
    TranslatePipe,
    WealthUnavailableComponent,
  ],
  template: `
    @if (unavailable()) {
      <app-wealth-unavailable />
    } @else {
      <div class="toolbar">
        <div class="period">
          <span id="wealth-period-label">{{ 'wealth.period.label' | translate }}</span>
          <p-selectbutton
            [options]="periodOptions()"
            optionLabel="label"
            optionValue="value"
            [ngModel]="store.period()"
            (ngModelChange)="onPeriod($event)"
            [allowEmpty]="false"
            ariaLabelledBy="wealth-period-label"
            data-testid="wealth-period"
          />
        </div>
        <div class="toolbar__actions">
          <app-export-control featureId="historic-wealth-development" />
          <a pButton routerLink="new" data-testid="wealth-add-button">
            <app-icon name="plus" /> {{ 'wealth.toolbar.add' | translate }}
          </a>
        </div>
      </div>

      @if (store.loadFailed() && !store.loaded()) {
        <p-message severity="error" data-testid="wealth-load-error">{{
          'wealth.state.loadError' | translate
        }}</p-message>
      }

      <p-tabs [value]="activeTab()" (valueChange)="onTabChange($event)" scrollable>
        <p-tablist>
          @for (tab of tabs; track tab) {
            <p-tab [value]="tab" [attr.data-testid]="'wealth-tab-' + tab">
              {{ 'wealth.tabs.' + tab | translate }}
            </p-tab>
          }
        </p-tablist>
        <p-tabpanels>
          <router-outlet />
        </p-tabpanels>
      </p-tabs>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }
    .period {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: var(--p-text-muted-color);
    }
    .toolbar__actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
    }
    a.p-button {
      text-decoration: none;
    }
  `,
})
export class WealthAreaComponent {
  protected readonly store = inject(WealthStore);
  private readonly service = inject(WealthService);
  private readonly i18n = inject(I18nService);

  protected readonly tabs = TABS;
  protected readonly unavailable = this.service.unavailable;
  private readonly nav = routeTabs('development');
  protected readonly activeTab = this.nav.activeTab;
  protected readonly onTabChange = this.nav.onTabChange;

  constructor() {
    this.store.ensureLoaded();
  }

  protected periodOptions() {
    return PERIODS.map((value) => ({
      label: this.i18n.translate(`wealth.period.${value}`),
      value,
    }));
  }

  protected onPeriod(period: Period | null): void {
    if (period) this.store.period.set(period);
  }
}
