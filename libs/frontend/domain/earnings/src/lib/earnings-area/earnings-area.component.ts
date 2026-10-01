import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TabsModule } from 'primeng/tabs';
import {
  ExportControlComponent,
  I18nService,
  IconComponent,
  TranslatePipe,
} from '@vaultfolio/frontend-shared-ui';
import { ALL_EMPLOYERS, EarningsFilterStore } from './earnings-filter.store';
import { EarningsUnavailableComponent } from './earnings-unavailable.component';

/**
 * Earnings area (design.md "Domain toolbar + sub-tabs"): employer filter, privacy link, export and
 * "Import documents" in the toolbar; sub-tabs Overview / Tables / Data check (with an issue badge)
 * / Imports, each its own child route rendered into the `<router-outlet>`. Follows
 * `HoldingsAreaComponent`. With the key unavailable (FR-044) only the unavailable state renders —
 * no toolbar, tabs or figures.
 *
 * Inline template/styles: consumed cross-package as a lazily loaded route target (see
 * `IconComponent`'s note in `@vaultfolio/frontend-shared-ui`).
 */
@Component({
  selector: 'app-earnings-area',
  imports: [
    FormsModule,
    RouterOutlet,
    RouterLink,
    TabsModule,
    SelectModule,
    ButtonModule,
    BadgeModule,
    ExportControlComponent,
    IconComponent,
    TranslatePipe,
    EarningsUnavailableComponent,
  ],
  providers: [EarningsFilterStore],
  template: `
    @if (store.unavailable()) {
      <app-earnings-unavailable />
    } @else {
      <div class="toolbar">
        <div class="toolbar__filters">
          <label class="filter-label" for="earnings-employer-filter">{{
            'earnings.toolbar.employer' | translate
          }}</label>
          <p-select
            inputId="earnings-employer-filter"
            data-testid="earnings-employer-filter"
            [options]="employerOptions()"
            optionLabel="label"
            optionValue="value"
            [ngModel]="store.selection()"
            (ngModelChange)="store.select($event)"
          />
          <a
            class="privacy-link"
            routerLink="imports"
            fragment="privacy"
            data-testid="earnings-privacy-link"
          >
            <app-icon name="lock" /> {{ 'earnings.toolbar.howProtected' | translate }}
          </a>
        </div>
        <div class="toolbar__actions">
          <app-export-control featureId="earnings" severity="info" />
          <a pButton routerLink="import" data-testid="earnings-import-button">
            <app-icon name="upload" /> {{ 'earnings.toolbar.importDocuments' | translate }}
          </a>
        </div>
      </div>

      <p-tabs [value]="activeTab()" (valueChange)="onTabChange($event)" scrollable>
        <p-tablist>
          <p-tab value="overview" data-testid="earnings-tab-overview">{{
            'earnings.tabs.overview' | translate
          }}</p-tab>
          <p-tab value="tables" data-testid="earnings-tab-tables">{{
            'earnings.tabs.tables' | translate
          }}</p-tab>
          <p-tab value="check" data-testid="earnings-tab-check">
            {{ 'earnings.tabs.check' | translate }}
            @if (store.dataCheckIssues() > 0) {
              <p-badge
                [value]="store.dataCheckIssues()"
                severity="warn"
                data-testid="earnings-check-badge"
              />
            }
          </p-tab>
          <p-tab value="imports" data-testid="earnings-tab-imports">{{
            'earnings.tabs.imports' | translate
          }}</p-tab>
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
    .toolbar__filters,
    .toolbar__actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
    }
    .filter-label {
      font-size: 0.875rem;
      color: var(--p-text-muted-color);
    }
    .privacy-link {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.875rem;
      color: var(--p-primary-color);
      text-decoration: none;
    }
    .privacy-link:hover {
      text-decoration: underline;
    }
    a.p-button {
      text-decoration: none;
    }
    p-badge {
      margin-inline-start: 0.375rem;
    }
  `,
})
export class EarningsAreaComponent {
  protected readonly store = inject(EarningsFilterStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(I18nService);

  protected readonly employerOptions = computed(() => {
    this.i18n.language();
    return [
      { label: this.i18n.translate('earnings.toolbar.allEmployers'), value: ALL_EMPLOYERS },
      ...this.store.employers().map((e) => ({ label: this.store.labelOf(e), value: e.id })),
    ];
  });

  protected readonly activeTab = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.currentTab()),
      startWith(this.currentTab()),
    ),
    { initialValue: 'overview' },
  );

  protected onTabChange(value: string | number | undefined): void {
    if (value === undefined) return;
    void this.router.navigate([String(value)], { relativeTo: this.route });
  }

  private currentTab(): string {
    return this.route.snapshot.firstChild?.url[0]?.path ?? 'overview';
  }
}
