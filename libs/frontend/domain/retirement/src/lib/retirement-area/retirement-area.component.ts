import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { catchError, filter, map, of, startWith, switchMap } from 'rxjs';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import type { RetirementPillar, RetirementRecord } from '@vaultfolio/api-contract';
import {
  ExportControlComponent,
  IconComponent,
  TranslatePipe,
} from '@vaultfolio/frontend-shared-ui';
import { PrivacyDialogComponent } from '../privacy-note/privacy-dialog.component';
import { RetirementService } from '../retirement.service';
import { RetirementUnavailableComponent } from './retirement-unavailable.component';

type TabKey = 'overview' | 'statutory' | 'occupational' | 'private' | 'info';

const PILLAR_OF_TAB: Partial<Record<TabKey, RetirementPillar>> = {
  statutory: 'STATUTORY',
  occupational: 'OCCUPATIONAL',
  private: 'PRIVATE',
};

/**
 * Retirement area (design.md "Toolbar + tabs"): the privacy link, export, manual entry and
 * "Upload document" in the toolbar; tabs per pillar plus the information tab, each its own child
 * route rendered into the `<router-outlet>`; the pillar tabs carry a count of their entries.
 * With the key unavailable only the unavailable state renders — no toolbar, tabs or figures.
 *
 * The Overview tab is the area's default route.
 *
 * Inline template/styles: consumed cross-package as a lazily loaded route target (see
 * `IconComponent`'s note in `@vaultfolio/frontend-shared-ui`).
 */
@Component({
  selector: 'app-retirement-area',
  imports: [
    RouterOutlet,
    RouterLink,
    TabsModule,
    ButtonModule,
    BadgeModule,
    ExportControlComponent,
    IconComponent,
    TranslatePipe,
    RetirementUnavailableComponent,
    PrivacyDialogComponent,
  ],
  template: `
    @if (unavailable()) {
      <app-retirement-unavailable />
    } @else {
      <div class="toolbar">
        <button
          type="button"
          class="privacy-link"
          data-testid="retirement-privacy-link"
          (click)="privacyOpen.set(true)"
        >
          <app-icon name="lock" /> {{ 'retirement.toolbar.howProtected' | translate }}
        </button>
        <app-retirement-privacy-dialog [(visible)]="privacyOpen" />
        <div class="toolbar__actions">
          <app-export-control featureId="retirement" />
          <a
            pButton
            severity="secondary"
            [outlined]="true"
            routerLink="new"
            [queryParams]="fromParams()"
            data-testid="retirement-manual-button"
          >
            <app-icon name="plus" /> {{ 'retirement.toolbar.manual' | translate }}
          </a>
          <a
            pButton
            routerLink="import"
            [queryParams]="fromParams()"
            data-testid="retirement-upload-button"
          >
            <app-icon name="upload" /> {{ 'retirement.toolbar.upload' | translate }}
          </a>
        </div>
      </div>

      <p-tabs [value]="activeTab()" (valueChange)="onTabChange($event)" scrollable>
        <p-tablist>
          @for (tab of tabs; track tab) {
            <p-tab [value]="tab" [attr.data-testid]="'retirement-tab-' + tab">
              {{ 'retirement.tabs.' + tab | translate }}
              @if (count(tab); as n) {
                <p-badge
                  [value]="n"
                  severity="secondary"
                  [attr.data-testid]="'retirement-tab-count-' + tab"
                />
              }
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
    .toolbar__actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
    }
    .privacy-link {
      border: 0;
      padding: 0;
      background: none;
      cursor: pointer;
      font-family: inherit;
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.875rem;
      color: var(--p-primary-color);
      text-decoration: none;
    }
    a.p-button {
      text-decoration: none;
    }
    p-badge {
      margin-inline-start: 0.375rem;
    }
  `,
})
export class RetirementAreaComponent {
  private readonly service = inject(RetirementService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly tabs: readonly TabKey[] = [
    'overview',
    'statutory',
    'occupational',
    'private',
    'info',
  ];
  protected readonly unavailable = this.service.unavailable;
  protected readonly privacyOpen = signal(false);

  /** Reloads on every write; a 503 flips `unavailable` on the service, which swaps the area. */
  private readonly records = toSignal(
    toObservable(this.service.changes).pipe(
      switchMap(() => this.service.records().pipe(catchError(() => of([] as RetirementRecord[])))),
    ),
    { initialValue: [] as RetirementRecord[] },
  );

  private readonly counts = computed(() => {
    const counts: Partial<Record<TabKey, number>> = {};
    for (const [tab, pillar] of Object.entries(PILLAR_OF_TAB)) {
      counts[tab as TabKey] = this.records().filter((r) => r.pillar === pillar).length;
    }
    return counts;
  });

  protected readonly activeTab = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.currentTab()),
      startWith(this.currentTab()),
    ),
    { initialValue: 'overview' },
  );

  /** Lets "Back" on the manual form / upload lead to the pillar tab they were opened from. */
  protected readonly fromParams = computed(() =>
    this.activeTab() in PILLAR_OF_TAB ? { from: this.activeTab() } : {},
  );

  protected count(tab: TabKey): number {
    return this.counts()[tab] ?? 0;
  }

  protected onTabChange(value: string | number | undefined): void {
    if (value === undefined) return;
    void this.router.navigate([String(value)], { relativeTo: this.route });
  }

  private currentTab(): string {
    return this.route.snapshot.firstChild?.url[0]?.path ?? 'overview';
  }
}
