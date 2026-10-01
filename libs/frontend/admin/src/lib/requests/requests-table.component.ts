import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { RequestListItem, RequestStatusDto } from '@vaultfolio/api-contract';
import { LocaleDateTimePipe, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { requestText, STATUS_SEVERITY, STATUSES } from './request-text';
import { RequestsService } from './requests.service';

/**
 * Requests table (033, FR-029, FR-030): generic over the registry, so a new request type needs no
 * change here. Newest first, status filter, left accent on open rows.
 */
@Component({
  selector: 'app-requests-table',
  imports: [
    FormsModule,
    RouterLink,
    SelectModule,
    TableModule,
    TagModule,
    LocaleDateTimePipe,
    TranslatePipe,
  ],
  template: `
    <section>
      <div class="header">
        <div>
          <h2>{{ 'nav.requests' | translate }}</h2>
          <p>{{ 'requests.admin.subtitle' | translate }}</p>
        </div>
        <p-select
          data-testid="requests-status-filter"
          [options]="filterOptions()"
          optionLabel="label"
          optionValue="value"
          [ngModel]="filter()"
          [ariaLabel]="'requests.admin.filterLabel' | translate"
          (ngModelChange)="onFilter($event)"
        />
      </div>

      @if (loadError()) {
        <p class="error-state" data-testid="requests-load-error">
          {{ 'requests.admin.loadError' | translate }}
        </p>
      } @else {
        <div class="scroll">
          <p-table [value]="items()" [loading]="loading()" [tableStyle]="{ 'min-width': '52rem' }">
            <ng-template #header>
              <tr>
                <th scope="col">{{ 'requests.admin.columnFeature' | translate }}</th>
                <th scope="col">{{ 'requests.admin.columnRequest' | translate }}</th>
                <th scope="col">{{ 'requests.admin.columnFrom' | translate }}</th>
                <th scope="col">{{ 'requests.admin.columnSubmitted' | translate }}</th>
                <th scope="col">{{ 'requests.admin.columnStatus' | translate }}</th>
                <th scope="col"></th>
              </tr>
            </ng-template>
            <ng-template #body let-item>
              <tr
                [attr.data-testid]="'requests-row-' + item.id"
                [class.row--open]="item.status === 'OPEN' || item.status === 'IN_PROGRESS'"
              >
                <td>{{ label(item).feature }}</td>
                <td>
                  {{ label(item).type }}
                  @if (item.possibleDuplicate) {
                    <p-tag
                      severity="info"
                      [rounded]="true"
                      [value]="'requests.admin.possibleDuplicate' | translate"
                    />
                  }
                </td>
                <td>{{ item.requesterEmail }}</td>
                <td>{{ item.createdAt | localeDateTime }}</td>
                <td>
                  <p-tag
                    [severity]="severity(item.status)"
                    [rounded]="true"
                    [value]="'requests.status.' + item.status | translate"
                  />
                  @if (item.sampleDeletesAt) {
                    <small class="hint" data-testid="requests-sample-deletes">
                      {{
                        t('requests.admin.sampleDeletesOn', { date: dateOf(item.sampleDeletesAt) })
                      }}
                    </small>
                  } @else if (!item.hasSample && item.closedAt) {
                    <small class="hint">{{ 'requests.admin.sampleDeleted' | translate }}</small>
                  }
                </td>
                <td>
                  <a
                    class="open-link"
                    [routerLink]="[]"
                    [queryParams]="{ id: item.id }"
                    [attr.data-testid]="'requests-open-' + item.id"
                    >{{ 'requests.admin.open' | translate }}</a
                  >
                </td>
              </tr>
            </ng-template>
            <ng-template #emptymessage>
              <tr>
                <td colspan="6">
                  <div class="empty-state">{{ 'requests.admin.emptyState' | translate }}</div>
                </td>
              </tr>
            </ng-template>
          </p-table>
        </div>
      }
    </section>
  `,
  styles: `
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
      margin-bottom: 0.75rem;
    }

    .scroll {
      overflow-x: auto;
    }

    .row--open td:first-child {
      box-shadow: inset 3px 0 0 var(--p-primary-color);
    }

    .hint {
      display: block;
      margin-top: 0.25rem;
      color: var(--p-text-muted-color);
    }

    .open-link {
      color: var(--p-primary-color);
      font-weight: 600;
    }

    .error-state {
      color: var(--p-red-500);
    }

    .empty-state {
      padding: 2rem 1rem;
      text-align: center;
      color: var(--p-text-muted-color);
    }
  `,
})
export class RequestsTableComponent implements OnInit {
  private readonly service = inject(RequestsService);
  private readonly text = requestText();

  protected readonly t = this.text.t;
  protected readonly items = signal<RequestListItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly filter = signal<RequestStatusDto | null>(null);

  protected readonly filterOptions = computed(() => [
    { label: this.t('requests.admin.filterAll'), value: null },
    ...STATUSES.map((status) => ({ label: this.t(`requests.status.${status}`), value: status })),
  ]);

  ngOnInit(): void {
    this.load();
  }

  protected onFilter(value: RequestStatusDto | null): void {
    this.filter.set(value);
    this.load();
  }

  protected label(item: RequestListItem): { feature: string; type: string } {
    return this.text.typeLabel(item.feature, item.type);
  }

  protected severity(status: RequestStatusDto) {
    return STATUS_SEVERITY[status];
  }

  protected readonly dateOf = this.text.date;

  private load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    const filter = this.filter();
    this.service.list(filter ? [filter] : []).subscribe({
      next: (response) => {
        this.items.set(response.items);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }
}
