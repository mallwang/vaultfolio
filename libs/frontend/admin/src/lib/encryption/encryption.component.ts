import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type {
  DomainKeyStatus,
  EncryptionDomainId,
  EncryptionDomainState,
  EncryptionRunStatus,
  RotationRun,
} from '@vaultfolio/api-contract';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ProgressBarModule } from 'primeng/progressbar';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { IconComponent, LocaleDateTimePipe, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { EncryptionService } from './encryption.service';

type Severity = 'success' | 'info' | 'secondary' | 'danger' | 'warn';

const STATE_SEVERITY: Record<EncryptionDomainState, Severity> = {
  READY: 'success',
  KEY_MISSING: 'danger',
  KEY_MISMATCH: 'danger',
  MIGRATING: 'warn',
  REENCRYPTING: 'warn',
};

const RUN_SEVERITY: Record<EncryptionRunStatus, Severity> = {
  RUNNING: 'info',
  SUCCEEDED: 'success',
  FAILED: 'danger',
  INTERRUPTED: 'warn',
};

const POLL_MS = 2000;

/**
 * Admin "Encryption" tab (040-encryption-key-rotation): per-domain key status, master key rotation,
 * confirmed data re-encryption, destroying retired keys and the operation history. Only reads the
 * status endpoint, which keeps working while a domain is locked, so the cause stays visible.
 * Inline template/styles for the same cross-package reason as `HealthStatusComponent`.
 */
@Component({
  selector: 'app-encryption',
  imports: [
    FormsModule,
    ButtonModule,
    CardModule,
    ConfirmDialogModule,
    DialogModule,
    InputTextModule,
    MessageModule,
    ProgressBarModule,
    TableModule,
    TagModule,
    ToastModule,
    IconComponent,
    LocaleDateTimePipe,
    TranslatePipe,
  ],
  providers: [ConfirmationService, MessageService, TranslatePipe],
  template: `
    <p-toast />
    <p-confirmdialog
      [pt]="{
        pcAcceptButton: { root: { 'data-testid': 'encryption-destroy-confirm-accept' } },
        pcRejectButton: { root: { 'data-testid': 'encryption-destroy-confirm-reject' } },
      }"
    >
      <ng-template #icon><app-icon name="warning" /></ng-template>
    </p-confirmdialog>

    <section class="encryption">
      <h2>{{ 'encryption.title' | translate }}</h2>
      <p>{{ 'encryption.subtitle' | translate }}</p>

      @if (loadError()) {
        <p-message severity="error" data-testid="encryption-load-error">{{
          loadError()
        }}</p-message>
      }

      <div class="encryption__cards">
        @for (domain of domains(); track domain.domain) {
          <p-card [attr.data-testid]="'encryption-domain-' + domain.domain">
            <ng-template #header>
              <div class="encryption__card-header">
                <strong>{{ domainLabel(domain.domain) }}</strong>
                <p-tag
                  [severity]="stateSeverity(domain.state)"
                  [value]="'encryption.state.' + domain.state | translate"
                  [rounded]="true"
                  [attr.data-testid]="'encryption-' + domain.domain + '-state'"
                />
              </div>
            </ng-template>

            @if (stateHint(domain.state); as hint) {
              <p-message severity="warn" size="small">{{ hint }}</p-message>
            }

            <dl class="encryption__facts">
              <dt>{{ 'encryption.dataKeyVersion' | translate }}</dt>
              <dd>{{ domain.currentVersion === null ? '–' : 'v' + domain.currentVersion }}</dd>
              <dt>{{ 'encryption.retiredKeys' | translate }}</dt>
              <dd>{{ retired(domain) }}</dd>
              <dt>{{ 'encryption.rowsPerVersion' | translate }}</dt>
              <dd>{{ rows(domain) }}</dd>
              <dt>{{ 'encryption.lastRun' | translate }}</dt>
              <dd>
                @if (domain.lastRun; as run) {
                  {{ 'encryption.history.kind.' + run.kind | translate }} ·
                  {{ 'encryption.history.status.' + run.status | translate }} ·
                  {{ run.startedAt | localeDateTime }}
                } @else {
                  {{ 'encryption.noRuns' | translate }}
                }
              </dd>
            </dl>

            @if (domain.rotationPending) {
              <p-message severity="info" size="small">{{
                'encryption.rotationPending' | translate
              }}</p-message>
            }
            @if (domain.previousKeyRemovable) {
              <p-message severity="success" size="small">{{
                'encryption.previousKeyRemovable' | translate
              }}</p-message>
            }

            @if (domain.runningRun; as run) {
              <div class="encryption__progress">
                <p-progressbar
                  [value]="percent(run)"
                  [showValue]="false"
                  [attr.data-testid]="'encryption-' + domain.domain + '-progress'"
                />
                <small>{{ progressText(run) }}</small>
              </div>
            }

            <div class="encryption__actions">
              <button
                pButton
                type="button"
                severity="secondary"
                [attr.data-testid]="'encryption-' + domain.domain + '-rotate-master-key'"
                [disabled]="!canOperate(domain)"
                (click)="rotateMasterKey(domain)"
              >
                <app-icon name="key" /> {{ 'encryption.rotateMasterKey' | translate }}
              </button>
              <button
                pButton
                type="button"
                severity="secondary"
                [attr.data-testid]="'encryption-' + domain.domain + '-reencrypt'"
                [disabled]="!canOperate(domain)"
                (click)="openReencrypt(domain)"
              >
                <app-icon name="replay" /> {{ 'encryption.reencrypt' | translate }}
              </button>
              @for (version of domain.retiredVersions; track version) {
                <button
                  pButton
                  type="button"
                  severity="danger"
                  [text]="true"
                  [attr.data-testid]="'encryption-' + domain.domain + '-destroy-' + version"
                  [disabled]="busy()"
                  (click)="confirmDestroy(domain, version, $event)"
                >
                  <app-icon name="trash" /> {{ destroyLabel(version) }}
                </button>
              }
            </div>
          </p-card>
        }
      </div>

      <h3>{{ 'encryption.history.title' | translate }}</h3>
      <p-table [value]="history()" [tableStyle]="{ 'min-width': '50rem' }">
        <ng-template #header>
          <tr>
            <th scope="col">{{ 'encryption.history.columnTime' | translate }}</th>
            <th scope="col">{{ 'encryption.history.columnDomain' | translate }}</th>
            <th scope="col">{{ 'encryption.history.columnKind' | translate }}</th>
            <th scope="col">{{ 'encryption.history.columnStatus' | translate }}</th>
            <th scope="col">{{ 'encryption.history.columnBy' | translate }}</th>
            <th scope="col">{{ 'encryption.history.columnRecords' | translate }}</th>
          </tr>
        </ng-template>
        <ng-template #body let-run>
          <tr [attr.data-testid]="'encryption-history-row-' + run.id">
            <td>{{ run.startedAt | localeDateTime }}</td>
            <td>{{ domainLabel(run.domain) }}</td>
            <td>{{ 'encryption.history.kind.' + run.kind | translate }}</td>
            <td>
              <p-tag
                [severity]="runSeverity(run.status)"
                [value]="'encryption.history.status.' + run.status | translate"
                [rounded]="true"
              />
            </td>
            <td>{{ run.triggeredByEmail ?? ('encryption.history.system' | translate) }}</td>
            <td>{{ run.recordsDone }} / {{ run.recordsTotal }}</td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr>
            <td colspan="6">
              <div class="encryption__empty">{{ 'encryption.history.empty' | translate }}</div>
            </td>
          </tr>
        </ng-template>
      </p-table>
    </section>

    <p-dialog
      [header]="reencryptHeader()"
      [modal]="true"
      [visible]="reencryptTarget() !== null"
      [style]="{ width: '30rem' }"
      [pt]="{ pcCloseButton: { root: { 'data-testid': 'encryption-reencrypt-close' } } }"
      (visibleChange)="closeReencrypt()"
    >
      <ng-template #closeicon><app-icon name="close" /></ng-template>
      <p>{{ 'encryption.reencryptDialog.message' | translate }}</p>
      <label for="encryption-reencrypt-confirm">{{
        'encryption.reencryptDialog.confirmLabel' | translate
      }}</label>
      <input
        pInputText
        id="encryption-reencrypt-confirm"
        data-testid="encryption-reencrypt-confirm-input"
        autocomplete="off"
        [ngModel]="confirmText()"
        (ngModelChange)="confirmText.set($event)"
      />
      <ng-template #footer>
        <button
          pButton
          type="button"
          severity="secondary"
          [text]="true"
          data-testid="encryption-reencrypt-cancel"
          (click)="closeReencrypt()"
        >
          {{ 'common.cancel' | translate }}
        </button>
        <button
          pButton
          type="button"
          severity="danger"
          data-testid="encryption-reencrypt-submit"
          [loading]="busy()"
          [disabled]="confirmText() !== reencryptTarget()"
          (click)="submitReencrypt()"
        >
          {{ 'encryption.reencryptDialog.submit' | translate }}
        </button>
      </ng-template>
    </p-dialog>
  `,
  styles: `
    :host {
      display: block;
      max-width: 1100px;
      margin: 0 auto;
    }

    .encryption__cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .encryption__card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.25rem 0;
    }

    .encryption__facts {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.25rem 1rem;
      margin: 0.75rem 0;
    }

    .encryption__facts dt {
      color: var(--p-text-muted-color);
    }

    .encryption__facts dd {
      margin: 0;
    }

    .encryption__progress {
      margin: 0.75rem 0;
    }

    .encryption__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 0.75rem;
    }

    .encryption__empty {
      padding: 2rem 1rem;
      text-align: center;
      color: var(--p-text-muted-color);
    }
  `,
})
export class EncryptionComponent implements OnInit {
  private readonly service = inject(EncryptionService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly messages = inject(MessageService);
  private readonly translate = inject(TranslatePipe);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly domains = signal<DomainKeyStatus[]>([]);
  protected readonly history = signal<RotationRun[]>([]);
  protected readonly loadError = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly reencryptTarget = signal<EncryptionDomainId | null>(null);
  protected readonly confirmText = signal('');
  protected readonly reencryptHeader = computed(() => {
    const target = this.reencryptTarget();
    return target
      ? this.translate
          .transform('encryption.reencryptDialog.header')
          .replace('{{domain}}', this.domainLabel(target))
      : '';
  });

  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.refresh();
    this.destroyRef.onDestroy(() => this.stopPolling());
  }

  protected domainLabel(domain: EncryptionDomainId): string {
    return this.translate.transform(`encryption.domain.${domain}`);
  }

  protected stateSeverity(state: EncryptionDomainState): Severity {
    return STATE_SEVERITY[state];
  }

  protected runSeverity(status: EncryptionRunStatus): Severity {
    return RUN_SEVERITY[status];
  }

  protected stateHint(state: EncryptionDomainState): string {
    return state === 'READY' ? '' : this.translate.transform(`encryption.stateHint.${state}`);
  }

  protected retired(domain: DomainKeyStatus): string {
    return domain.retiredVersions.length > 0
      ? domain.retiredVersions.map((v) => `v${v}`).join(', ')
      : this.translate.transform('encryption.none');
  }

  protected rows(domain: DomainKeyStatus): string {
    const entries = Object.entries(domain.rowsPerVersion);
    return entries.length > 0 ? entries.map(([v, n]) => `v${v}: ${n}`).join(', ') : '–';
  }

  protected destroyLabel(version: number): string {
    return this.translate.transform('encryption.destroyKey').replace('{{version}}', `${version}`);
  }

  protected percent(run: RotationRun): number {
    return run.recordsTotal > 0 ? Math.round((run.recordsDone / run.recordsTotal) * 100) : 0;
  }

  protected progressText(run: RotationRun): string {
    return this.translate
      .transform('encryption.progress')
      .replace('{{done}}', `${run.recordsDone}`)
      .replace('{{total}}', `${run.recordsTotal}`);
  }

  protected canOperate(domain: DomainKeyStatus): boolean {
    return domain.state === 'READY' && domain.runningRun === null && !this.busy();
  }

  protected rotateMasterKey(domain: DomainKeyStatus): void {
    this.run(this.service.rotateMasterKey(domain.domain), 'encryption.rotatedMasterKey');
  }

  protected openReencrypt(domain: DomainKeyStatus): void {
    this.confirmText.set('');
    this.reencryptTarget.set(domain.domain);
  }

  protected closeReencrypt(): void {
    this.reencryptTarget.set(null);
  }

  protected submitReencrypt(): void {
    const target = this.reencryptTarget();
    if (!target) return;
    this.run(
      this.service.startReencryption(target, this.confirmText()),
      'encryption.reencryptionStarted',
      () => this.closeReencrypt(),
    );
  }

  protected confirmDestroy(domain: DomainKeyStatus, version: number, event: Event): void {
    this.confirmation.confirm({
      target: event.target as EventTarget,
      header: this.translate.transform('encryption.destroyConfirm.header'),
      message: this.translate
        .transform('encryption.destroyConfirm.message')
        .replace('{{version}}', `${version}`)
        .replace('{{domain}}', this.domainLabel(domain.domain)),
      acceptButtonProps: {
        severity: 'danger',
        label: this.translate.transform('encryption.destroyConfirm.accept'),
      },
      rejectButtonProps: {
        severity: 'secondary',
        label: this.translate.transform('encryption.destroyConfirm.reject'),
      },
      accept: () =>
        this.run(this.service.destroyDataKey(domain.domain, version), 'encryption.destroyedKey'),
    });
  }

  private run(
    call: ReturnType<EncryptionService['rotateMasterKey']>,
    successKey: string,
    onSuccess?: () => void,
  ): void {
    this.busy.set(true);
    call.subscribe({
      next: () => {
        this.busy.set(false);
        onSuccess?.();
        this.messages.add({ severity: 'success', summary: this.translate.transform(successKey) });
        this.refresh();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.messages.add({ severity: 'error', summary: this.errorText(error) });
        this.refresh();
      },
    });
  }

  private errorText(error: unknown): string {
    const code =
      error instanceof HttpErrorResponse ? (error.error as { error?: string })?.error : undefined;
    const key = code ? `encryption.errors.${code}` : '';
    const text = key ? this.translate.transform(key) : '';
    return text && text !== key ? text : this.translate.transform('encryption.errors.generic');
  }

  private refresh(): void {
    this.loadError.set(null);
    this.service.status().subscribe({
      next: ({ domains }) => {
        this.domains.set(domains);
        this.syncPolling(domains.some((d) => d.runningRun !== null));
      },
      error: () => this.loadError.set(this.translate.transform('encryption.loadError')),
    });
    this.service.history().subscribe({
      next: ({ runs }) => this.history.set(runs),
      error: () => this.loadError.set(this.translate.transform('encryption.loadError')),
    });
  }

  private syncPolling(active: boolean): void {
    if (active && this.timer === null) {
      this.timer = setInterval(() => this.refresh(), POLL_MS);
    } else if (!active) {
      this.stopPolling();
    }
  }

  private stopPolling(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
