import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { DomainMaintenanceStatus } from '@vaultfolio/api-contract';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { DOMAIN_REGISTRY } from '@vaultfolio/frontend-domain-access';
import { IconComponent, LocaleDateTimePipe, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { DomainsService } from './domains.service';

/**
 * Admin "Domains" tab (041-domain-maintenance-mode): every domain with its maintenance state and a
 * switch. Switching a domain into maintenance asks for confirmation; switching it back does not.
 * Inline template/styles for the same cross-package reason as `HealthStatusComponent`.
 */
@Component({
  selector: 'app-domains',
  imports: [
    FormsModule,
    ConfirmDialogModule,
    MessageModule,
    TableModule,
    TagModule,
    ToastModule,
    ToggleSwitchModule,
    IconComponent,
    LocaleDateTimePipe,
    TranslatePipe,
  ],
  providers: [ConfirmationService, MessageService, TranslatePipe],
  template: `
    <p-toast />
    <p-confirmdialog
      [pt]="{
        pcAcceptButton: { root: { 'data-testid': 'domains-confirm-accept' } },
        pcRejectButton: { root: { 'data-testid': 'domains-confirm-reject' } },
      }"
    >
      <ng-template #icon><app-icon name="build" /></ng-template>
    </p-confirmdialog>

    <section class="domains">
      <h2>{{ 'maintenance.admin.title' | translate }}</h2>
      <p>{{ 'maintenance.admin.subtitle' | translate }}</p>

      @if (loadError()) {
        <p-message severity="error" data-testid="domains-load-error">{{ loadError() }}</p-message>
      }

      <p-table [value]="rows()" [tableStyle]="{ 'min-width': '36rem' }">
        <ng-template #header>
          <tr>
            <th scope="col">{{ 'maintenance.admin.columnDomain' | translate }}</th>
            <th scope="col">{{ 'maintenance.admin.columnStatus' | translate }}</th>
            <th scope="col" class="domains__changed">
              {{ 'maintenance.admin.columnChanged' | translate }}
            </th>
            <th scope="col">{{ 'maintenance.admin.columnSwitch' | translate }}</th>
          </tr>
        </ng-template>
        <ng-template #body let-row>
          <tr [attr.data-testid]="'domains-row-' + row.domainId">
            <td>
              <span class="domains__name">
                <app-icon [name]="row.icon" />
                <strong>{{ row.labelKey | translate }}</strong>
              </span>
            </td>
            <td>
              <p-tag
                [severity]="row.inMaintenance ? 'warn' : 'success'"
                [rounded]="true"
                [value]="
                  (row.inMaintenance
                    ? 'maintenance.admin.inMaintenance'
                    : 'maintenance.admin.active'
                  ) | translate
                "
                [attr.data-testid]="'domains-state-' + row.domainId"
              />
            </td>
            <td class="domains__changed" [attr.data-testid]="'domains-changed-' + row.domainId">
              @if (row.updatedAt) {
                {{ row.updatedAt | localeDateTime }}
                @if (row.updatedBy) {
                  · {{ row.updatedBy }}
                }
              } @else {
                {{ 'maintenance.admin.neverChanged' | translate }}
              }
            </td>
            <td>
              @for (key of [row.domainId + ':' + revision()]; track key) {
                <p-toggleswitch
                  [ngModel]="row.inMaintenance"
                  [disabled]="busy()"
                  [ariaLabel]="toggleLabel(row.labelKey)"
                  [attr.data-testid]="'domains-toggle-' + row.domainId"
                  (onChange)="onToggle(row, $event.checked)"
                />
              }
            </td>
          </tr>
        </ng-template>
      </p-table>
    </section>
  `,
  styles: `
    :host {
      display: block;
      max-width: 1100px;
      margin: 0 auto;
    }
    .domains {
      display: block;
    }
    .domains p-table {
      display: block;
      margin-top: 1rem;
    }
    .domains__name {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }
    @media (max-width: 640px) {
      .domains__changed {
        display: none;
      }
    }
  `,
})
export class DomainsComponent implements OnInit {
  private readonly service = inject(DomainsService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly messages = inject(MessageService);
  private readonly translate = inject(TranslatePipe);

  private readonly statuses = signal<DomainMaintenanceStatus[]>([]);
  protected readonly loadError = signal<string | null>(null);
  protected readonly busy = signal(false);
  /** Bumped to re-create the switches after a declined or failed change, so they show the stored state. */
  protected readonly revision = signal(0);

  protected readonly rows = computed(() =>
    this.statuses().map((status) => {
      const descriptor = DOMAIN_REGISTRY.find((d) => d.id === status.domainId);
      return {
        ...status,
        labelKey: descriptor?.labelKey ?? status.domainId,
        icon: descriptor?.icon ?? 'build',
      };
    }),
  );

  ngOnInit(): void {
    this.load();
  }

  protected toggleLabel(labelKey: string): string {
    return this.translate
      .transform('maintenance.admin.toggleLabel')
      .replace('{{domain}}', this.translate.transform(labelKey));
  }

  protected onToggle(row: { domainId: string; labelKey: string }, enable: boolean): void {
    if (!enable) {
      this.apply(row.domainId, false);
      return;
    }
    this.confirmation.confirm({
      header: this.translate
        .transform('maintenance.admin.confirm.header')
        .replace('{{domain}}', this.translate.transform(row.labelKey)),
      message: this.translate.transform('maintenance.admin.confirm.message'),
      acceptButtonProps: {
        severity: 'warn',
        label: this.translate.transform('maintenance.admin.confirm.accept'),
      },
      rejectButtonProps: {
        severity: 'secondary',
        label: this.translate.transform('maintenance.admin.confirm.reject'),
      },
      accept: () => this.apply(row.domainId, true),
      reject: () => this.revision.update((n) => n + 1),
    });
  }

  private apply(domainId: string, inMaintenance: boolean): void {
    this.busy.set(true);
    this.service.setMaintenance(domainId, inMaintenance).subscribe({
      next: (updated) => {
        this.busy.set(false);
        this.statuses.update((list) => list.map((s) => (s.domainId === domainId ? updated : s)));
        this.revision.update((n) => n + 1);
      },
      error: () => {
        this.busy.set(false);
        this.revision.update((n) => n + 1);
        this.messages.add({
          severity: 'error',
          summary: this.translate.transform('maintenance.admin.saveError'),
        });
      },
    });
  }

  private load(): void {
    this.loadError.set(null);
    this.service.list().subscribe({
      next: ({ domains }) => this.statuses.set(domains),
      error: () => this.loadError.set(this.translate.transform('maintenance.admin.loadError')),
    });
  }
}
