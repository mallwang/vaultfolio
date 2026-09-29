import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { EarningsPreviewStatus } from '@vaultfolio/api-contract';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { I18nService, IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { fill, formatDate, formatMonth, formatMoney, rejectionText } from '../earnings-format';
import { type ImportRow, ImportSessionStore } from './import-session.store';

type RowStatus = EarningsPreviewStatus | 'READING';

const STATUS_SEVERITY: Record<RowStatus, 'success' | 'info' | 'secondary' | 'danger' | 'contrast'> =
  {
    NEW: 'success',
    REPLACES: 'info',
    DUPLICATE: 'secondary',
    REJECTED: 'danger',
    READING: 'contrast',
  };

const RECORD_FIGURES: [key: string, label: string][] = [
  ['gross', 'grossTotal'],
  ['taxGross', 'taxGross'],
  ['svGrossKv', 'svGrossKv'],
  ['svGrossRv', 'svGrossRv'],
  ['wageTax', 'wageTax'],
  ['soli', 'soli'],
  ['churchTax', 'churchTax'],
  ['health', 'health'],
  ['care', 'care'],
  ['pension', 'pension'],
  ['unemployment', 'unemployment'],
  ['net', 'statutoryNet'],
  ['other', 'other'],
  ['payout', 'payout'],
];

interface FigureGroup {
  title: string;
  items: { label: string; value: string }[];
}

/**
 * Import screen (design.md "Import screen", FR-005–FR-017, FR-022): files are read on this device,
 * each file gets a row with its outcome, and nothing is saved until the visitor confirms. The
 * "Figures that will be sent" grid shows exactly the whitelisted body of a file (FR-008, FR-017).
 */
@Component({
  selector: 'app-earnings-import',
  imports: [
    RouterLink,
    ButtonModule,
    MessageModule,
    ProgressBarModule,
    TagModule,
    IconComponent,
    TranslatePipe,
  ],
  providers: [ImportSessionStore],
  template: `
    <a class="back" routerLink="/app/earnings" data-testid="earnings-import-back">
      <app-icon name="chevron-left" /> {{ 'earnings.import.back' | translate }}
    </a>

    <div
      class="dropzone"
      [class.dropzone--active]="dragging()"
      data-testid="earnings-import-dropzone"
      (dragover)="onDragOver($event)"
      (dragleave)="dragging.set(false)"
      (drop)="onDrop($event)"
    >
      <app-icon name="upload" class="dropzone__icon" />
      <h2>{{ 'earnings.import.dropTitle' | translate }}</h2>
      <p class="muted">{{ 'earnings.import.dropSub' | translate }}</p>
      <input
        #picker
        type="file"
        multiple
        accept=".pdf,.json,application/pdf,application/json"
        hidden
        data-testid="earnings-import-input"
        (change)="onPick(picker)"
      />
      <button
        pButton
        type="button"
        [disabled]="busy()"
        data-testid="earnings-import-choose"
        (click)="picker.click()"
      >
        {{ 'earnings.import.chooseFiles' | translate }}
      </button>
      <div class="chips">
        <span class="muted">{{ 'earnings.import.supported' | translate }}:</span>
        <p-tag severity="secondary" [value]="'earnings.formatChips.sap' | translate" />
        <p-tag severity="secondary" [value]="'earnings.formatChips.certificate' | translate" />
        <p-tag severity="secondary" [value]="'earnings.formatChips.export' | translate" />
      </div>
    </div>

    <p-message severity="info" data-testid="earnings-import-device-banner">
      <app-icon name="lock" /> {{ 'earnings.import.deviceBanner' | translate }}
    </p-message>

    @if (doneCount() !== null) {
      <p-message severity="success" data-testid="earnings-import-done">
        {{ doneText() }}
        <a routerLink="/app/earnings/overview">{{ 'earnings.import.back' | translate }}</a>
      </p-message>
    }

    @if (store.errorCode(); as code) {
      <p-message severity="error" data-testid="earnings-import-error">{{
        errorText(code)
      }}</p-message>
    }

    @if (store.total() > 0) {
      <div class="progress" data-testid="earnings-import-progress">
        <span>{{ progressText() }}</span>
        @if (store.phase() === 'checking') {
          <span class="muted">{{ 'earnings.import.checking' | translate }}</span>
        }
        <p-progressbar [value]="progress()" [showValue]="false" />
      </div>

      <ul class="rows">
        @for (row of store.rows(); track row.clientFileId) {
          @let status = statusOf(row);
          <li class="row" [attr.data-testid]="'earnings-import-row-' + row.clientFileId">
            <div class="row__main">
              <span class="row__icon" [class]="'row__icon--' + status.toLowerCase()">
                <app-icon [name]="iconOf(status)" [spin]="status === 'READING'" />
              </span>
              <div class="row__name">
                <strong>{{ row.fileName }}</strong>
                <span class="muted">{{ describe(row) }}</span>
              </div>
              <div class="row__periods">
                {{ periodsOf(row) }}
                @if (row.preview?.includesCorrection) {
                  <p-tag
                    severity="warn"
                    [value]="'earnings.import.includesCorrection' | translate"
                  />
                }
              </div>
              <div class="row__checks">
                @if (row.state === 'candidate') {
                  <app-icon name="check-circle" /> {{ 'earnings.import.allChecks' | translate }}
                }
              </div>
              <p-tag
                [severity]="severityOf(status)"
                [value]="'earnings.import.status' + status | translate"
                [attr.data-testid]="'earnings-import-status-' + row.clientFileId"
              />
              @if (!busy() && store.phase() !== 'done') {
                <button
                  pButton
                  type="button"
                  text
                  severity="secondary"
                  [attr.aria-label]="'earnings.import.removeFile' | translate"
                  [attr.data-testid]="'earnings-import-remove-' + row.clientFileId"
                  (click)="store.remove(row.clientFileId)"
                >
                  <app-icon name="close" />
                </button>
              }
            </div>
            @for (line of notesOf(row); track $index) {
              <p class="row__note" [class.row__note--error]="line.error">{{ line.text }}</p>
            }
            @if (row.body && status !== 'REJECTED') {
              <button
                type="button"
                class="link"
                [attr.aria-expanded]="expanded() === row.clientFileId"
                [attr.data-testid]="'earnings-import-figures-toggle-' + row.clientFileId"
                (click)="toggle(row.clientFileId)"
              >
                {{
                  (expanded() === row.clientFileId
                    ? 'earnings.import.hideSent'
                    : 'earnings.import.whatSent'
                  ) | translate
                }}
              </button>
              @if (expanded() === row.clientFileId) {
                <div
                  class="figures"
                  [attr.data-testid]="'earnings-import-figures-' + row.clientFileId"
                >
                  @for (group of figuresOf(row); track group.title) {
                    <h4>{{ group.title }}</h4>
                    <dl>
                      @for (item of group.items; track item.label) {
                        <dt>{{ item.label }}</dt>
                        <dd>{{ item.value }}</dd>
                      }
                    </dl>
                  }
                </div>
              }
            }
          </li>
        }
      </ul>

      <div class="footer">
        <div class="chips">
          <p-tag
            severity="success"
            [value]="readyText()"
            data-testid="earnings-import-summary-ready"
          />
          @if (store.skipped() > 0) {
            <p-tag
              severity="secondary"
              [value]="countText('earnings.import.skipped', store.skipped())"
            />
          }
          @if (store.rejected() > 0) {
            <p-tag
              severity="danger"
              [value]="countText('earnings.import.rejected', store.rejected())"
            />
          }
        </div>
        <div class="footer__actions">
          <button
            pButton
            type="button"
            severity="secondary"
            outlined
            [disabled]="busy()"
            data-testid="earnings-import-cancel"
            (click)="cancel()"
          >
            {{ 'earnings.import.cancel' | translate }}
          </button>
          <button
            pButton
            type="button"
            data-testid="earnings-import-confirm"
            [disabled]="store.phase() !== 'ready' || store.ready().length === 0"
            (click)="confirm()"
          >
            {{ confirmText() }}
          </button>
        </div>
      </div>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .back {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      color: var(--p-primary-color);
      text-decoration: none;
      align-self: flex-start;
    }
    .muted {
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
    }
    .dropzone {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 0.5rem;
      padding: 2rem 1rem;
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
      margin: 0;
      font-size: 1.1rem;
    }
    .dropzone p {
      margin: 0;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
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
      border-top: 1px solid var(--p-content-border-color);
    }
    .row:first-child {
      border-top: none;
    }
    .row__main {
      display: grid;
      grid-template-columns: auto minmax(0, 2fr) minmax(0, 1.5fr) minmax(0, 1fr) auto auto;
      align-items: center;
      gap: 0.75rem;
    }
    .row__name {
      display: flex;
      flex-direction: column;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .row__periods {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.375rem;
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
    .row__icon--duplicate,
    .row__icon--reading {
      color: var(--p-text-muted-color);
    }
    .row__icon--rejected {
      color: var(--p-red-600);
    }
    .row__note {
      margin: 0.375rem 0 0 2.25rem;
      font-size: 0.875rem;
      color: var(--p-text-muted-color);
    }
    .row__note--error {
      color: var(--p-red-600);
    }
    .link {
      margin: 0.375rem 0 0 2.25rem;
      padding: 0;
      border: none;
      background: none;
      color: var(--p-primary-color);
      cursor: pointer;
      font: inherit;
      font-size: 0.875rem;
    }
    .figures {
      margin: 0.5rem 0 0 2.25rem;
      overflow-x: auto;
    }
    .figures h4 {
      margin: 0.5rem 0 0.25rem;
      font-size: 0.875rem;
    }
    .figures dl {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(11rem, auto) minmax(6rem, auto));
      gap: 0.125rem 1rem;
      margin: 0;
      font-size: 0.8125rem;
    }
    .figures dt {
      color: var(--p-text-muted-color);
    }
    .figures dd {
      margin: 0;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .footer {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }
    .footer .chips {
      justify-content: flex-start;
    }
    .footer__actions {
      display: flex;
      gap: 0.5rem;
    }
    @media (max-width: 640px) {
      .row__main {
        grid-template-columns: auto minmax(0, 1fr) auto auto;
      }
      .row__periods,
      .row__checks {
        grid-column: 2 / -1;
      }
    }
  `,
})
export class EarningsImportComponent {
  protected readonly store = inject(ImportSessionStore);
  private readonly i18n = inject(I18nService);

  protected readonly dragging = signal(false);
  protected readonly expanded = signal<string | null>(null);
  protected readonly doneCount = signal<number | null>(null);

  protected readonly busy = computed(() =>
    ['reading', 'checking', 'importing'].includes(this.store.phase()),
  );
  protected readonly progress = computed(() =>
    this.store.total() === 0 ? 0 : Math.round((this.store.read() / this.store.total()) * 100),
  );
  protected readonly progressText = computed(() =>
    fill(this.t('earnings.import.reading'), { done: this.store.read(), total: this.store.total() }),
  );
  protected readonly readyText = computed(() => {
    const files = this.store.ready().length;
    const key = files === 1 ? 'earnings.import.readySummaryOne' : 'earnings.import.readySummary';
    return fill(this.t(key), { files, records: this.store.readyRecords() });
  });
  protected readonly confirmText = computed(() => {
    if (this.store.phase() === 'importing') return this.t('earnings.import.importing');
    const count = this.store.ready().length;
    return count === 1
      ? this.t('earnings.import.importOne')
      : fill(this.t('earnings.import.importN'), { count });
  });
  protected readonly doneText = computed(() => {
    const count = this.doneCount() ?? 0;
    return count === 1
      ? this.t('earnings.import.doneOne')
      : fill(this.t('earnings.import.done'), { count });
  });

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    if (this.busy()) return;
    this.add(Array.from(event.dataTransfer?.files ?? []));
  }

  protected onPick(input: HTMLInputElement): void {
    this.add(Array.from(input.files ?? []));
    input.value = '';
  }

  protected cancel(): void {
    this.store.reset();
    this.expanded.set(null);
  }

  protected async confirm(): Promise<void> {
    if (await this.store.commit()) {
      // The preview is cleared after success; only the confirmation remains (T049).
      this.doneCount.set(this.store.savedCount());
      this.store.reset();
      this.expanded.set(null);
    }
  }

  protected toggle(id: string): void {
    this.expanded.update((current) => (current === id ? null : id));
  }

  protected statusOf(row: ImportRow): RowStatus {
    if (row.state === 'local-rejected') return 'REJECTED';
    return row.preview?.status ?? 'READING';
  }

  protected severityOf(status: RowStatus) {
    return STATUS_SEVERITY[status];
  }

  protected iconOf(status: RowStatus): string {
    if (status === 'READING') return 'spinner';
    if (status === 'REJECTED') return 'close';
    if (status === 'DUPLICATE') return 'ban';
    return 'check-circle';
  }

  /** "format · employer" */
  protected describe(row: ImportRow): string {
    let format = '';
    if (row.parserId) format = this.t(`earnings.format.${row.parserId}`);
    else if (row.sourceType) format = this.t(`earnings.sourceType.${row.sourceType}`);
    const employer = row.preview?.employers.join(', ') || row.employer || '';
    return [format, employer].filter(Boolean).join(' · ');
  }

  protected periodsOf(row: ImportRow): string {
    const lang = this.i18n.language();
    const years = row.preview?.years ?? [
      ...new Set(row.body?.certificates.map((c) => c.year) ?? []),
    ];
    const periods =
      row.preview?.periods ?? [...new Set(row.body?.records.map((r) => r.period) ?? [])].sort();
    const parts: string[] = [];
    if (periods.length > 0) {
      const first = formatMonth(periods[0], lang);
      const last = formatMonth(periods[periods.length - 1], lang);
      parts.push(first === last ? first : `${first} – ${last}`);
    }
    for (const year of years) parts.push(fill(this.t('earnings.import.year'), { year }));
    return parts.join(', ');
  }

  protected notesOf(row: ImportRow): { text: string; error: boolean }[] {
    const lang = this.i18n.language();
    const rejection = row.localRejection ?? row.preview?.rejection;
    if (rejection) return [{ text: rejectionText(rejection, (k) => this.t(k), lang), error: true }];
    const preview = row.preview;
    if (!preview) return [];
    const notes: { text: string; error: boolean }[] = [];
    if (preview.status === 'DUPLICATE') {
      notes.push({
        text: preview.duplicateOf
          ? fill(this.t('earnings.import.duplicateNote'), {
              date: formatDate(preview.duplicateOf.importedAt, lang),
            })
          : this.t('earnings.import.duplicateInBatch'),
        error: false,
      });
    }
    if (preview.status === 'REPLACES' && preview.replaces.length > 0) {
      const what = [
        ...new Set(
          preview.replaces.map((r) =>
            r.period ? formatMonth(r.period, lang) : String(r.year ?? ''),
          ),
        ),
      ].join(', ');
      notes.push({
        text: fill(this.t('earnings.import.replacesNote'), {
          what,
          date: formatDate(preview.replaces[0].importedAt, lang),
        }),
        error: false,
      });
    }
    if ((preview.status === 'NEW' || preview.status === 'REPLACES') && preview.conflictsWith) {
      notes.push({ text: this.t('earnings.import.conflictWinner'), error: false });
    }
    return notes;
  }

  /** Exactly the whitelisted figures of the file's body (FR-008, FR-017). */
  protected figuresOf(row: ImportRow): FigureGroup[] {
    const lang = this.i18n.language();
    const money = (v: string) => formatMoney(v, lang);
    const groups: FigureGroup[] = [];
    for (const record of row.body?.records ?? []) {
      const a = record.amounts as unknown as Record<string, string | null>;
      const items = RECORD_FIGURES.filter(([key]) => a[key] !== null).map(([key, label]) => ({
        label: this.t(`earnings.terms.${label}`),
        value: money(a[key] as string),
      }));
      const bonusLabel = this.t('earnings.terms.bonusOneOff');
      for (const [key, value] of Object.entries(record.amounts.oneOff)) {
        items.push({ label: `${bonusLabel}: ${this.term(key)}`, value: money(value) });
      }
      if (record.amounts.employerSubsidy) {
        items.push(
          {
            label: this.t('earnings.terms.employerSubsidyHealth'),
            value: money(record.amounts.employerSubsidy.health),
          },
          {
            label: this.t('earnings.terms.employerSubsidyCare'),
            value: money(record.amounts.employerSubsidy.care),
          },
        );
      }
      const ytdLabel = this.t('earnings.terms.ytd');
      for (const [key, value] of Object.entries(record.amounts.ytd ?? {})) {
        items.push({ label: `${ytdLabel}: ${this.term(key)}`, value: money(value) });
      }
      const title = [formatMonth(record.period, lang), this.t(`earnings.kind.${record.kind}`)];
      if (record.kind === 'CORRECTION') {
        title.push(
          fill(this.t('earnings.detail.issuedIn'), { month: formatMonth(record.issued, lang) }),
        );
      }
      groups.push({ title: title.join(' · '), items });
    }
    for (const certificate of row.body?.certificates ?? []) {
      groups.push({
        title: `${this.t('earnings.terms.certificate')} ${certificate.year}`,
        items: Object.entries(certificate.amounts).map(([key, value]) => ({
          label: this.t(`earnings.certificateFields.${key}`),
          value: money(value),
        })),
      });
    }
    return groups;
  }

  protected countText(key: string, count: number): string {
    return fill(this.t(key), { count });
  }

  protected errorText(code: string): string {
    const key = `earnings.errors.${code}`;
    const text = this.t(key);
    return text === key ? this.t('earnings.errors.generic') : fill(text, { path: '' });
  }

  private add(files: File[]): void {
    this.doneCount.set(null);
    void this.store.addFiles(files);
  }

  private t(key: string): string {
    this.i18n.language();
    return this.i18n.translate(key);
  }

  private term(key: string): string {
    return this.t(`earnings.terms.${key}`);
  }
}
