import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TabsModule } from 'primeng/tabs';
import {
  ExportControlComponent,
  IconComponent,
  TranslatePipe,
  routeTabs,
} from '@vaultfolio/frontend-shared-ui';
import { InsurancesStore } from '../insurances-store';
import { InsurancesService } from '../insurances.service';
import { InsurancesDangerZoneComponent } from './insurances-danger-zone.component';
import { InsurancesUnavailableComponent } from './insurances-unavailable.component';

const TABS = ['overview', 'contracts', 'gap-check'] as const;

/**
 * Insurances area (design.md "Toolbar + tabs"): year filter and the social-insurance switch shared
 * by all tabs, reminders link, export control and "Vertrag erfassen" in the toolbar; tabs Übersicht,
 * Verträge and Lückencheck as child routes. With the key unavailable only the unavailable state
 * renders — no toolbar, tabs or figures.
 *
 * Inline template/styles: consumed cross-package as a lazily loaded route target.
 */
@Component({
  selector: 'app-insurances-area',
  imports: [
    FormsModule,
    RouterOutlet,
    RouterLink,
    TabsModule,
    ButtonModule,
    CheckboxModule,
    MessageModule,
    SelectModule,
    ExportControlComponent,
    IconComponent,
    TranslatePipe,
    InsurancesDangerZoneComponent,
    InsurancesUnavailableComponent,
  ],
  template: `
    @if (unavailable()) {
      <app-insurances-unavailable />
    } @else {
      <div class="toolbar">
        <div class="filters">
          <label class="year">
            <span id="insurances-year-label">{{ 'insurances.toolbar.year' | translate }}</span>
            <p-select
              [options]="years()"
              [ngModel]="store.year()"
              (ngModelChange)="store.year.set($event)"
              ariaLabelledBy="insurances-year-label"
              data-testid="insurances-year"
            />
          </label>
          <label class="social">
            <p-checkbox
              [binary]="true"
              [ngModel]="store.settings().includeSocial"
              (ngModelChange)="setIncludeSocial($event)"
              inputId="insurances-include-social"
              data-testid="insurances-include-social"
            />
            <span>{{ 'insurances.toolbar.includeSocial' | translate }}</span>
          </label>
        </div>
        <div class="toolbar__actions">
          <a
            pButton
            [outlined]="true"
            severity="secondary"
            routerLink="reminders"
            data-testid="insurances-reminders-link"
          >
            <app-icon name="envelope" /> {{ 'insurances.toolbar.reminders' | translate }}
          </a>
          <app-export-control featureId="insurances" />
          <a pButton routerLink="/app/insurances/new" data-testid="insurances-add-button">
            <app-icon name="plus" /> {{ 'insurances.toolbar.add' | translate }}
          </a>
        </div>
      </div>

      @if (store.loadFailed() && !store.loaded()) {
        <p-message severity="error" data-testid="insurances-load-error">{{
          'insurances.state.loadError' | translate
        }}</p-message>
      }

      <p-tabs [value]="activeTab()" (valueChange)="onTabChange($event)" scrollable>
        <p-tablist>
          @for (tab of tabs; track tab) {
            <p-tab [value]="tab" [attr.data-testid]="'insurances-tab-' + tab">
              {{ 'insurances.tabs.' + tab | translate }}
            </p-tab>
          }
        </p-tablist>
        <p-tabpanels>
          <router-outlet />
        </p-tabpanels>
      </p-tabs>

      @if (store.contracts().length > 0) {
        <app-insurances-danger-zone />
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      max-width: 1300px;
      margin: 0 auto;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }
    .filters,
    .toolbar__actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
    }
    .year,
    .social {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: var(--p-text-muted-color);
    }
    a.p-button {
      text-decoration: none;
    }
  `,
})
export class InsurancesAreaComponent {
  protected readonly store = inject(InsurancesStore);
  private readonly service = inject(InsurancesService);

  protected readonly tabs = TABS;
  protected readonly unavailable = this.service.unavailable;
  private readonly nav = routeTabs('overview');
  protected readonly activeTab = this.nav.activeTab;
  protected readonly onTabChange = this.nav.onTabChange;

  constructor() {
    this.store.ensureLoaded();
  }

  protected years(): number[] {
    const current = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, i) => current - 3 + i);
  }

  protected setIncludeSocial(includeSocial: boolean): void {
    const next = { ...this.store.settings(), includeSocial };
    this.store.setSettings(next);
    this.service.saveSettings(next).subscribe({
      next: (saved) => this.store.setSettings(saved),
      error: () => this.store.refresh(),
    });
  }
}
