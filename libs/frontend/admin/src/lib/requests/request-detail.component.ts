import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgComponentOutlet } from '@angular/common';
import type { RequestDetail, RequestStatusDto } from '@vaultfolio/api-contract';
import { IconComponent, LocaleDateTimePipe, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { PAYLOAD_VIEWS } from './payload-views/payload-views';
import { requestText, STATUS_SEVERITY, STATUSES } from './request-text';
import { RequestsService } from './requests.service';

/**
 * Request detail (033, FR-031–FR-033): the anonymized sample with an audited download, and the
 * handling card (status, note). A purged sample shows a notice instead of an error page.
 */
@Component({
  selector: 'app-request-detail',
  imports: [
    FormsModule,
    RouterLink,
    NgComponentOutlet,
    ButtonModule,
    MessageModule,
    SelectModule,
    TagModule,
    TextareaModule,
    IconComponent,
    LocaleDateTimePipe,
    TranslatePipe,
  ],
  template: `
    <a class="back" [routerLink]="[]" [queryParams]="{}" data-testid="request-detail-back"
      >← {{ 'requests.admin.back' | translate }}</a
    >

    @if (loadError()) {
      <p class="error-state" data-testid="request-detail-error">
        {{ 'requests.admin.detailLoadError' | translate }}
      </p>
    } @else if (detail(); as d) {
      <header>
        <h2>{{ label().type }} · {{ label().feature }}</h2>
        <p>
          {{
            t('requests.admin.submittedBy', {
              email: d.requesterEmail,
              date: (d.createdAt | localeDateTime),
            })
          }}
          <p-tag
            [severity]="severity(d.status)"
            [rounded]="true"
            [value]="'requests.status.' + d.status | translate"
          />
        </p>
      </header>

      @if (d.possibleDuplicate) {
        <p-message severity="info" data-testid="request-detail-duplicate">{{
          'requests.admin.duplicateCallout' | translate
        }}</p-message>
      }

      <div class="split">
        <div class="column">
          <section class="card" data-testid="request-detail-sample">
            <h3>{{ 'requests.admin.sampleTitle' | translate }}</h3>
            @if (d.attachment; as a) {
              <p class="muted">{{ 'requests.admin.sampleOrigin' | translate }}</p>
              <dl>
                <dt>{{ 'requests.admin.sampleSize' | translate }}</dt>
                <dd>{{ sizeKb(a.sizeBytes) }} kB</dd>
                <dt>{{ 'requests.admin.samplePages' | translate }}</dt>
                <dd>{{ a.pageCount }}</dd>
                <dt>{{ 'requests.admin.sampleHash' | translate }}</dt>
                <dd class="hash">{{ a.sha256 }}</dd>
              </dl>
              <p class="muted" data-testid="request-detail-audit">
                {{ t('requests.admin.sampleDownloads', { count: a.downloadCount }) }}
                @if (a.lastDownloadedAt) {
                  ·
                  {{
                    t('requests.admin.sampleLastDownload', {
                      date: (a.lastDownloadedAt | localeDateTime),
                    })
                  }}
                }
              </p>
              <button
                pButton
                type="button"
                severity="info"
                data-testid="request-detail-download"
                [disabled]="downloading()"
                (click)="download(d)"
              >
                <app-icon name="download" /> {{ 'requests.admin.download' | translate }}
              </button>
              @if (downloadError()) {
                <p class="error-state">{{ 'requests.admin.downloadError' | translate }}</p>
              }
            } @else {
              <p class="muted" data-testid="request-detail-sample-gone">
                {{ 'requests.admin.sampleGone' | translate }}
              </p>
            }
          </section>

          @if (payloadView(); as view) {
            <section class="card" data-testid="request-detail-payload">
              <ng-container *ngComponentOutlet="view; inputs: { payload: d.payload }" />
            </section>
          }
        </div>

        <section class="card" data-testid="request-detail-handling">
          <h3>{{ 'requests.admin.handlingTitle' | translate }}</h3>
          <label for="request-detail-status">{{ 'requests.admin.status' | translate }}</label>
          <p-select
            inputId="request-detail-status"
            data-testid="request-detail-status"
            [options]="statusOptions()"
            optionLabel="label"
            optionValue="value"
            [ngModel]="status()"
            (ngModelChange)="status.set($event)"
          />
          <label for="request-detail-note">{{ 'requests.admin.note' | translate }}</label>
          <textarea
            id="request-detail-note"
            pTextarea
            rows="4"
            maxlength="2000"
            data-testid="request-detail-note"
            [placeholder]="'requests.admin.notePlaceholder' | translate"
            [ngModel]="note()"
            (ngModelChange)="note.set($event)"
          ></textarea>
          <button
            pButton
            type="button"
            data-testid="request-detail-save"
            [disabled]="!dirty() || saving()"
            (click)="save(d)"
          >
            <app-icon name="save" /> {{ 'requests.admin.save' | translate }}
          </button>
          @if (message(); as m) {
            <p
              [class]="m.error ? 'error-state' : 'ok-state'"
              role="status"
              data-testid="request-detail-message"
            >
              {{ m.key | translate }}
            </p>
          }
          @if (d.handledByEmail && d.handledAt) {
            <p class="muted">
              {{
                t('requests.admin.handledBy', {
                  email: d.handledByEmail,
                  date: (d.handledAt | localeDateTime),
                })
              }}
            </p>
          }
          <p class="muted" data-testid="request-detail-retention">
            {{ 'requests.admin.retentionHint' | translate }}
            @if (d.sampleDeletesAt) {
              ({{ t('requests.admin.sampleDeletesOn', { date: dateOf(d.sampleDeletesAt) }) }})
            }
          </p>
        </section>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .back {
      display: inline-block;
      margin-bottom: 0.75rem;
      color: var(--p-primary-color);
    }

    .split {
      display: grid;
      grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
      gap: 1rem;
      align-items: start;
    }

    @media (max-width: 900px) {
      .split {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .column {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .card {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 1rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
      background: var(--p-content-background);
    }

    dl {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr);
      gap: 0.25rem 1rem;
      margin: 0;
    }

    dd {
      margin: 0;
    }

    .hash {
      font-family: monospace;
      overflow-wrap: anywhere;
    }

    .muted {
      color: var(--p-text-muted-color);
    }

    .error-state {
      color: var(--p-red-500);
    }

    .ok-state {
      color: var(--p-green-500);
    }
  `,
})
export class RequestDetailComponent {
  private readonly service = inject(RequestsService);
  private readonly text = requestText();

  readonly id = input.required<string>();

  protected readonly t = this.text.t;
  protected readonly dateOf = this.text.date;
  protected readonly detail = signal<RequestDetail | null>(null);
  protected readonly loadError = signal(false);
  protected readonly status = signal<RequestStatusDto>('OPEN');
  protected readonly note = signal('');
  protected readonly saving = signal(false);
  protected readonly downloading = signal(false);
  protected readonly downloadError = signal(false);
  protected readonly message = signal<{ key: string; error: boolean } | null>(null);

  protected readonly statusOptions = computed(() =>
    STATUSES.map((status) => ({ label: this.t(`requests.status.${status}`), value: status })),
  );

  protected readonly label = computed(() => {
    const d = this.detail();
    return d ? this.text.typeLabel(d.feature, d.type) : { feature: '', type: '' };
  });

  protected readonly payloadView = computed(() => {
    const d = this.detail();
    return d && d.payload !== null ? (PAYLOAD_VIEWS[`${d.feature}/${d.type}`] ?? null) : null;
  });

  protected readonly dirty = computed(() => {
    const d = this.detail();
    return d !== null && (this.status() !== d.status || this.note() !== (d.note ?? ''));
  });

  constructor() {
    effect(() => this.load(this.id()));
  }

  protected severity(status: RequestStatusDto) {
    return STATUS_SEVERITY[status];
  }

  protected sizeKb(bytes: number): string {
    return (bytes / 1024).toFixed(1);
  }

  protected save(current: RequestDetail): void {
    const change: { status?: RequestStatusDto; note?: string } = {};
    if (this.status() !== current.status) change.status = this.status();
    if (this.note() !== (current.note ?? '')) change.note = this.note();
    this.saving.set(true);
    this.message.set(null);
    this.service.update(current.id, change).subscribe({
      next: (updated) => {
        this.apply(updated);
        this.saving.set(false);
        this.message.set({ key: 'requests.admin.saved', error: false });
        this.service.refreshOpenCount();
      },
      error: () => {
        this.saving.set(false);
        this.message.set({ key: 'requests.admin.saveError', error: true });
      },
    });
  }

  protected download(current: RequestDetail): void {
    this.downloading.set(true);
    this.downloadError.set(false);
    this.service.downloadAttachment(current.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `request-${current.id.slice(0, 8)}-sample.pdf`;
        link.click();
        URL.revokeObjectURL(url);
        this.downloading.set(false);
        this.reload(current.id);
      },
      error: () => {
        this.downloading.set(false);
        this.downloadError.set(true);
      },
    });
  }

  private load(id: string): void {
    this.loadError.set(false);
    this.detail.set(null);
    this.message.set(null);
    this.service.get(id).subscribe({
      next: (d) => this.apply(d),
      error: () => this.loadError.set(true),
    });
  }

  /** Refreshes the download statistics after a download. */
  private reload(id: string): void {
    this.service.get(id).subscribe({ next: (d) => this.apply(d), error: () => undefined });
  }

  private apply(d: RequestDetail): void {
    this.detail.set(d);
    this.status.set(d.status);
    this.note.set(d.note ?? '');
  }
}
