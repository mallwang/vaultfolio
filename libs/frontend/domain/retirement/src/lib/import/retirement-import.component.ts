import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ProgressBarModule } from 'primeng/progressbar';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import type { RetirementScenario } from '@vaultfolio/api-contract';
import { needsProviderLabel } from '@vaultfolio/retirement';
import { MAX_RECOGNITION_PAGES, OcrConsentComponent } from '@vaultfolio/frontend-document-reader';
import { I18nService, IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { returnLabelKey, returnLink } from '../return-link';
import { sortFigureKeys } from '../retirement-fields';
import { displayFigure, fill, formatDate } from '../retirement-format';
import { type ImportRejection, ImportStore } from './import-store';

const SCENARIOS: readonly RetirementScenario[] = ['0', '3', '6', '9'];

type RowStatus = 'READING' | 'DECISION' | 'RECOGNISING' | 'REJECTED' | 'NEW' | 'REPLACES';

const STATUS_ICON: Record<RowStatus, string> = {
  READING: 'spinner',
  RECOGNISING: 'spinner',
  DECISION: 'scan',
  REJECTED: 'close',
  NEW: 'check-circle',
  REPLACES: 'check-circle',
};

const STATUS_SEVERITY: Record<RowStatus, 'success' | 'info' | 'warn' | 'danger' | 'contrast'> = {
  READING: 'contrast',
  RECOGNISING: 'contrast',
  DECISION: 'warn',
  REJECTED: 'danger',
  NEW: 'success',
  REPLACES: 'info',
};

/** Route (pillar tab) shown after a successful save. */
const PILLAR_ROUTE = {
  STATUTORY: 'statutory',
  OCCUPATIONAL: 'occupational',
  PRIVATE: 'private',
} as const;

/**
 * Statement import (design.md "Import flow"): the file is read on this device, the figures the
 * parser found are shown for review, and only after confirmation one `POST /retirement/records`
 * with the whitelisted figures is sent. A document no parser accepts ends on the "not recognised"
 * screen with a way to enter the contract manually. `?replaces=<id>` comes from a card's
 * "Replace with new document" action.
 */
@Component({
  selector: 'app-retirement-import',
  imports: [
    FormsModule,
    RouterLink,
    ButtonModule,
    InputTextModule,
    MessageModule,
    ProgressBarModule,
    SelectModule,
    TagModule,
    IconComponent,
    TranslatePipe,
    OcrConsentComponent,
  ],
  providers: [ImportStore],
  template: `
    <a class="back" [routerLink]="backLink" data-testid="retirement-import-back">
      <app-icon name="chevron-left" /> {{ backLabelKey | translate }}
    </a>

    @if (store.step() === 'saved') {
      <p-message severity="success" data-testid="retirement-import-saved">
        {{ 'retirement.import.saved' | translate }}
      </p-message>
    } @else {
      <div
        class="dropzone"
        [class.dropzone--active]="dragging()"
        data-testid="retirement-import-dropzone"
        (dragover)="onDragOver($event)"
        (dragleave)="dragging.set(false)"
        (drop)="onDrop($event)"
      >
        <app-icon name="upload" class="dropzone__icon" />
        <h2>{{ 'retirement.import.dropTitle' | translate }}</h2>
        <p class="muted">{{ 'retirement.import.dropSub' | translate }}</p>
        <input
          #picker
          type="file"
          accept=".pdf,application/pdf"
          hidden
          data-testid="retirement-import-input"
          (change)="onPick(picker)"
        />
        <button
          pButton
          type="button"
          [disabled]="busy()"
          data-testid="retirement-import-choose"
          (click)="picker.click()"
        >
          {{ 'retirement.import.choose' | translate }}
        </button>
        <div class="chips">
          <span class="muted">{{ 'retirement.import.supported' | translate }}:</span>
          <p-tag severity="secondary" [value]="'retirement.import.formatChips.drv' | translate" />
          <p-tag
            severity="secondary"
            [value]="'retirement.import.formatChips.private' | translate"
          />
          <p-tag
            severity="secondary"
            [value]="'retirement.import.formatChips.capital' | translate"
          />
        </div>
      </div>

      <p-message severity="info" data-testid="retirement-import-device-banner">
        <app-icon name="lock" /> {{ 'retirement.import.deviceBanner' | translate }}
      </p-message>

      @if (store.step() !== 'idle') {
        <div class="progress" data-testid="retirement-import-progress">
          <span>{{ progressSummary() }}</span>
          <p-progressbar [value]="store.step() === 'reading' ? 0 : 100" [showValue]="false" />
        </div>

        <ul class="rows">
          <li class="row" data-testid="retirement-import-row">
            <div class="row__main">
              <span class="row__icon" [class]="'row__icon--' + status().toLowerCase()">
                <app-icon
                  [name]="statusIcon()"
                  [spin]="status() === 'READING' || status() === 'RECOGNISING'"
                />
              </span>
              <div class="row__name">
                <strong>{{ store.fileName() }}</strong>
                @if (store.record(); as record) {
                  <span class="muted">{{
                    'retirement.types.' + record.contractType | translate
                  }}</span>
                }
                @if (store.ocrRead()) {
                  <p-tag
                    class="row__badge"
                    severity="warn"
                    [value]="'retirement.badges.ocr' | translate"
                  />
                }
              </div>
              <div class="row__checks">
                @if (store.record()) {
                  <span data-testid="retirement-import-checks-passed">
                    <app-icon name="check-circle" />
                    {{ 'retirement.import.checksPassed' | translate }}
                  </span>
                }
              </div>
              <p-tag
                [severity]="statusSeverity()"
                [value]="statusLabel()"
                data-testid="retirement-import-status"
              />
              @if (canRemove()) {
                <button
                  pButton
                  type="button"
                  text
                  severity="secondary"
                  [attr.aria-label]="'retirement.import.removeFile' | translate"
                  data-testid="retirement-import-remove"
                  (click)="store.reset()"
                >
                  <app-icon name="close" />
                </button>
              }
            </div>

            @switch (store.step()) {
              @case ('awaiting-recognition') {
                <vf-ocr-consent
                  class="row__ocr"
                  state="offer"
                  [fileName]="store.fileName()"
                  (allow)="store.acceptRecognition()"
                  (dismissed)="store.declineRecognition()"
                />
              }
              @case ('recognising') {
                <vf-ocr-consent
                  class="row__ocr"
                  state="progress"
                  [fileName]="store.fileName()"
                  [progressText]="progressText()"
                  [progressPercent]="progressPercent()"
                  (dismissed)="store.cancelRecognition()"
                />
              }
              @case ('rejected') {
                <div data-testid="retirement-import-rejected">
                  <p class="row__note row__note--error" data-testid="retirement-import-rejection">
                    {{ rejectionText() }}
                  </p>
                  @if (store.failedChecks().length > 0) {
                    <p class="row__note" data-testid="retirement-import-failed-checks">
                      {{ 'retirement.import.checks' | translate }}:
                      {{ store.failedChecks().join(', ') }}
                    </p>
                  }
                  <div class="row__request">
                    <a
                      pButton
                      size="small"
                      routerLink="/app/retirement/new"
                      [queryParams]="fromParams"
                      data-testid="retirement-import-manual"
                    >
                      {{ 'retirement.import.manualInstead' | translate }}
                    </a>
                    <button
                      pButton
                      type="button"
                      size="small"
                      severity="secondary"
                      [outlined]="true"
                      data-testid="retirement-import-retry"
                      (click)="store.reset()"
                    >
                      {{ 'retirement.import.tryAnother' | translate }}
                    </button>
                  </div>
                </div>
              }
            }
          </li>
        </ul>

        @if (store.record(); as record) {
          <section class="review" data-testid="retirement-import-review">
            @if (store.ocrRead()) {
              <p-message severity="warn" data-testid="retirement-import-ocr-notice">{{
                'retirement.import.ocrNotice' | translate
              }}</p-message>
            }

            <h3>{{ 'retirement.import.figures' | translate }}</h3>
            <dl class="figures" data-testid="retirement-import-figures">
              @for (row of rows(); track row.key) {
                <div
                  class="figures__row"
                  [attr.data-testid]="'retirement-import-figure-' + row.key"
                >
                  <dt>{{ row.label }}</dt>
                  <dd>{{ row.value }}</dd>
                </div>
              }
            </dl>

            @if (needsProviderLabel()) {
              <label class="field">
                <span>{{ 'retirement.import.providerLabel' | translate }}</span>
                <input
                  pInputText
                  name="providerLabel"
                  maxlength="80"
                  [ngModel]="store.inputs().providerLabel ?? ''"
                  (ngModelChange)="store.setInput('providerLabel', $event)"
                  data-testid="retirement-import-provider-label"
                />
                <small class="muted">{{ 'retirement.import.providerLabelHint' | translate }}</small>
              </label>
            }

            @if (record.missingSupplement.length > 0 || store.hasScenarios()) {
              <h3>{{ 'retirement.import.supplementTitle' | translate }}</h3>
              <p class="muted">{{ 'retirement.import.supplementHint' | translate }}</p>
              <div class="supplement">
                @for (key of record.missingSupplement; track key) {
                  <label class="field">
                    <span>{{ 'retirement.fields.' + key | translate }}</span>
                    <input
                      pInputText
                      inputmode="decimal"
                      [name]="key"
                      [ngModel]="store.inputs()[key] ?? ''"
                      (ngModelChange)="store.setInput(key, $event)"
                      [attr.aria-invalid]="store.invalidInputs().includes(key)"
                      [attr.data-testid]="'retirement-import-input-' + key"
                    />
                    @if (store.invalidInputs().includes(key)) {
                      <small class="error" role="alert">{{
                        'retirement.import.invalidAmount' | translate
                      }}</small>
                    }
                  </label>
                }
                @if (store.hasScenarios()) {
                  <label class="field">
                    <span>{{ 'retirement.import.scenario' | translate }}</span>
                    <p-select
                      [options]="scenarioOptions"
                      optionLabel="label"
                      optionValue="value"
                      appendTo="body"
                      [ngModel]="store.expectedScenario()"
                      (ngModelChange)="store.expectedScenario.set($event)"
                      [pt]="{ root: { 'data-testid': 'retirement-import-scenario' } }"
                    />
                  </label>
                }
              </div>
            }

            @if (store.replaceTarget(); as target) {
              <p-message severity="warn" data-testid="retirement-import-replace-warning">{{
                (target.origin === 'IMPORTED'
                  ? 'retirement.import.replaceImported'
                  : 'retirement.import.replaceManual'
                ) | translate
              }}</p-message>
            }
            @if (store.errorCode(); as code) {
              <p-message severity="error" data-testid="retirement-import-error">{{
                errorText(code)
              }}</p-message>
            }

            <div class="actions">
              <button
                pButton
                type="button"
                [disabled]="!store.canConfirm() || store.step() === 'saving'"
                data-testid="retirement-import-confirm"
                (click)="confirm()"
              >
                {{
                  (store.step() === 'saving'
                    ? 'retirement.import.saving'
                    : 'retirement.import.confirm'
                  ) | translate
                }}
              </button>
              <button
                pButton
                type="button"
                severity="secondary"
                [outlined]="true"
                data-testid="retirement-import-cancel"
                (click)="store.reset()"
              >
                {{ 'retirement.import.cancel' | translate }}
              </button>
            </div>
          </section>
        }
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    h1,
    h2,
    h3,
    p {
      margin: 0;
    }
    .back {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      align-self: flex-start;
      color: var(--p-primary-color);
      text-decoration: none;
    }
    .muted {
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
    }
    .dropzone {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 2rem 1rem;
      text-align: center;
      border: 2px dashed var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
      background: var(--p-content-background);
    }
    .dropzone--active {
      border-color: var(--p-primary-color);
    }
    .dropzone__icon {
      font-size: 2rem;
      color: var(--p-primary-color);
    }
    .dropzone h2 {
      font-size: 1.1rem;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-top: 0.75rem;
    }
    .review {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .progress {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.25rem 1rem;
      align-items: center;
    }
    .progress p-progressbar {
      grid-column: 1 / -1;
    }
    .rows {
      list-style: none;
      margin: 0;
      padding: 0;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
      background: var(--p-content-background);
    }
    .row {
      padding: 0.75rem 1rem;
    }
    .row__main {
      display: grid;
      grid-template-columns: auto minmax(0, 2fr) minmax(0, 1fr) auto auto;
      align-items: center;
      gap: 0.75rem;
    }
    .row__name {
      display: flex;
      flex-direction: column;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .row__badge {
      align-self: flex-start;
      margin-top: 0.25rem;
    }
    .row__checks {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      color: var(--p-green-600);
      font-size: 0.875rem;
    }
    .row__icon--new,
    .row__icon--replaces {
      color: var(--p-green-600);
    }
    .row__icon--reading,
    .row__icon--recognising {
      color: var(--p-text-muted-color);
    }
    .row__icon--rejected {
      color: var(--p-red-600);
    }
    .row__ocr {
      display: block;
      margin: 0.5rem 0 0 2.25rem;
    }
    .row__note {
      margin: 0.375rem 0 0 2.25rem;
      font-size: 0.875rem;
      color: var(--p-text-muted-color);
    }
    .row__note--error {
      color: var(--p-red-600);
    }
    .row__request {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
      margin: 0.5rem 0 0 2.25rem;
    }
    @media (max-width: 640px) {
      .row__main {
        grid-template-columns: auto minmax(0, 1fr) auto auto;
      }
      .row__checks {
        grid-column: 2 / -1;
      }
    }
    .figures {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
      gap: 0.5rem 1rem;
      margin: 0;
    }
    .figures__row {
      display: flex;
      flex-direction: column;
    }
    .figures dt {
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
    }
    .figures dd {
      margin: 0;
      font-weight: 600;
    }
    .supplement {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
      gap: 0.75rem 1rem;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .error {
      color: var(--p-red-500);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    a.p-button {
      text-decoration: none;
    }
  `,
})
export class RetirementImportComponent {
  protected readonly store = inject(ImportStore);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly from = inject(ActivatedRoute).snapshot.queryParamMap.get('from');
  protected readonly backLink = returnLink(this.from);
  protected readonly backLabelKey = returnLabelKey(this.from);
  protected readonly fromParams = this.from ? { from: this.from } : {};

  protected readonly dragging = signal(false);

  constructor() {
    const replaces = inject(ActivatedRoute).snapshot.queryParamMap.get('replaces');
    this.store.requestReplace(replaces);
  }

  protected get scenarioOptions(): { label: string; value: RetirementScenario }[] {
    this.i18n.language();
    return SCENARIOS.map((value) => ({ label: `${value} %`, value }));
  }

  /** Only contract types that carry a provider (not the statutory pension) and lack one in the document. */
  protected readonly needsProviderLabel = computed(() => {
    const record = this.store.record();
    return !!record && !record.providerLabel && needsProviderLabel(record.contractType);
  });

  /** The recognised figures, labelled and formatted for the review grid. */
  protected readonly rows = computed(() => {
    const record = this.store.record();
    const lang = this.i18n.language();
    if (!record) return [];
    const years = this.i18n.translate('retirement.card.years');
    const rows: { key: string; label: string; value: string }[] = [];
    const add = (key: string, value: string): void => {
      rows.push({ key, label: this.i18n.translate(`retirement.fields.${key}`), value });
    };
    if (record.providerLabel) add('providerLabel', record.providerLabel);
    if (record.identifier) add('identifier', record.identifier);
    add('statementDate', formatDate(record.statementDate, lang));
    if (record.payoutStart) add('payoutStart', formatDate(record.payoutStart, lang));
    const figures = record.figures as unknown as Record<string, unknown>;
    for (const key of sortFigureKeys(Object.keys(figures))) {
      const value = figures[key];
      if (value === undefined || value === null) continue;
      if (key === 'scenarioMonthly') {
        for (const [pct, amount] of Object.entries(value as Record<string, string>)) {
          rows.push({
            key: `${key}-${pct}`,
            label: `${this.i18n.translate('retirement.fields.scenarioMonthly')} (${pct} %)`,
            value: displayFigure('expectedMonthly', amount, lang, years),
          });
        }
        continue;
      }
      add(key, displayFigure(key, value, lang, years));
    }
    return rows;
  });

  protected readonly busy = computed(() =>
    ['reading', 'recognising', 'saving'].includes(this.store.step()),
  );

  protected readonly status = computed<RowStatus>(() => {
    switch (this.store.step()) {
      case 'reading':
        return 'READING';
      case 'awaiting-recognition':
        return 'DECISION';
      case 'recognising':
        return 'RECOGNISING';
      case 'rejected':
        return 'REJECTED';
      default:
        return this.store.replaceTarget() ? 'REPLACES' : 'NEW';
    }
  });

  protected readonly statusIcon = computed(() => STATUS_ICON[this.status()]);
  protected readonly statusSeverity = computed(() => STATUS_SEVERITY[this.status()]);
  protected readonly statusLabel = computed(() => {
    const status = this.status();
    return this.i18n.translate(
      status === 'DECISION' || status === 'RECOGNISING'
        ? `ocr.status${status}`
        : `retirement.import.status${status}`,
    );
  });
  protected readonly canRemove = computed(() => !this.busy());
  protected readonly progressSummary = computed(() =>
    fill(this.i18n.translate('retirement.import.progress'), {
      done: this.store.step() === 'reading' ? 0 : 1,
      total: 1,
    }),
  );

  protected readonly progressText = computed(() => {
    const p = this.store.recognition();
    if (!p) return this.i18n.translate('ocr.loading');
    if (p.phase === 'LOADING') return this.i18n.translate('ocr.loading');
    return fill(this.i18n.translate(p.phase === 'RENDERING' ? 'ocr.rendering' : 'ocr.page'), {
      page: p.page,
      total: p.pageCount,
    });
  });

  protected readonly progressPercent = computed(() => {
    const p = this.store.recognition();
    return p ? Math.round(((p.page - 1 + p.fraction) / p.pageCount) * 100) : null;
  });

  protected rejectionText(): string {
    const reason: ImportRejection = this.store.rejection() ?? 'UNREADABLE';
    const text = this.i18n.translate(`retirement.import.rejection.${reason}`);
    return reason === 'TOO_MANY_PAGES' ? `${text} (${MAX_RECOGNITION_PAGES})` : text;
  }

  protected errorText(code: string): string {
    const key = `retirement.errors.${code}`;
    const text = this.i18n.translate(key);
    return text === key ? this.i18n.translate('retirement.errors.saveFailed') : text;
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) void this.store.pick(file);
  }

  protected onPick(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.store.pick(file);
  }

  protected async confirm(): Promise<void> {
    if (!(await this.store.confirm())) return;
    const pillar = this.store.savedPillar();
    await this.router.navigate(['/app/retirement', pillar ? PILLAR_ROUTE[pillar] : 'statutory']);
  }
}
