import { Component, inject, input } from '@angular/core';
import type { EarningsPayAmountKey, EarningsPayRecordInput } from '@vaultfolio/api-contract';
import { I18nService, IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { ButtonModule } from 'primeng/button';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { TagModule } from 'primeng/tag';
import { fill, formatMonth, formatMoney } from '../../earnings-format';
import { RECORD_FIGURES, figureTerm } from '../figures';
import { type ImportRow, ImportSessionStore, figureId } from '../import-session.store';

interface Cell {
  key: EarningsPayAmountKey;
  label: string;
  /** Domain id of the input and the prefix of its test ids. */
  id: string;
  /** `<key>-<file>-<record>` — shared by the input's and the restore button's test ids. */
  suffix: string;
  value: string;
  editable: boolean;
  failing: boolean;
  corrected: boolean;
  invalid: boolean;
  readValue: string;
  text: string;
}

/**
 * The "figures that will be sent" grid of a payslip that failed an arithmetic check (design.md,
 * "Import screen addendum", FR-012a). Only figures taking part in the failing check are inputs;
 * every keystroke re-runs the checks in the `ImportSessionStore`. Edits live in the browser only.
 */
@Component({
  selector: 'app-earnings-correction-grid',
  imports: [
    ButtonModule,
    InputGroupModule,
    InputGroupAddonModule,
    InputTextModule,
    MessageModule,
    TagModule,
    IconComponent,
    TranslatePipe,
  ],
  template: `
    @let r = row();
    <div class="correction" [attr.data-testid]="'earnings-import-correction-' + r.clientFileId">
      @if (r.failures.length > 0) {
        <p-message
          severity="error"
          role="alert"
          [attr.id]="messageId()"
          [attr.data-testid]="'earnings-import-check-message-' + r.clientFileId"
        >
          <div>
            <div>{{ 'earnings.import.correctHint' | translate }}</div>
            <div class="involved">{{ involvedText() }}</div>
          </div>
        </p-message>
      } @else if (r.state === 'candidate') {
        <p-message
          severity="success"
          role="status"
          [attr.id]="messageId()"
          [attr.data-testid]="'earnings-import-check-message-' + r.clientFileId"
        >
          <div>
            <strong>{{ 'earnings.import.passTitle' | translate }}</strong>
            <div>{{ 'earnings.import.passBody' | translate }}</div>
          </div>
        </p-message>
      }

      @for (record of r.draft; track $index; let i = $index) {
        @if (hasEditable(i)) {
          <h4>{{ title(record) }}</h4>
          <div class="grid">
            @for (cell of cells(record, i); track cell.key) {
              <div
                class="field"
                [class.field--failing]="cell.failing"
                [class.field--corrected]="cell.corrected"
              >
                <label [attr.for]="cell.id">
                  {{ cell.label }}
                  @if (cell.failing) {
                    <span class="flag">
                      <app-icon name="warning" /> {{ 'earnings.import.inFailingCheck' | translate }}
                    </span>
                  }
                </label>
                <p-inputgroup>
                  <input
                    pInputText
                    type="text"
                    inputmode="decimal"
                    autocomplete="off"
                    [attr.id]="cell.id"
                    [attr.data-testid]="cell.id"
                    [value]="cell.text"
                    [disabled]="!cell.editable || busy()"
                    [attr.aria-invalid]="cell.invalid || cell.failing ? 'true' : null"
                    [attr.aria-describedby]="describedBy(cell)"
                    (input)="onInput(r, i, cell, $event)"
                  />
                  <p-inputgroup-addon>€</p-inputgroup-addon>
                </p-inputgroup>
                @if (cell.invalid) {
                  <small class="error" [attr.id]="cell.id + '-error'">
                    {{ 'earnings.import.invalidAmount' | translate }}
                  </small>
                }
                @if (cell.corrected) {
                  <div class="corrected">
                    <p-tag
                      severity="success"
                      [value]="'earnings.import.correctedByYou' | translate"
                    />
                    <span class="muted">{{ readText(cell) }}</span>
                    <button
                      pButton
                      type="button"
                      text
                      size="small"
                      [disabled]="busy()"
                      [attr.aria-label]="restoreLabel(cell)"
                      [attr.data-testid]="'earnings-import-figure-restore-' + cell.suffix"
                      (click)="restore(r, i, cell)"
                    >
                      {{ 'earnings.import.restore' | translate }}
                    </button>
                  </div>
                }
              </div>
            }
          </div>
        }
      }
      <p class="muted">{{ 'earnings.import.onlyInvolved' | translate }}</p>
    </div>
  `,
  styles: `
    .correction {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin: 0.5rem 0 0 2.25rem;
    }
    h4 {
      margin: 0.5rem 0 0;
      font-size: 0.875rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
      gap: 0.75rem 1rem;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 0.375rem;
      border: 2px solid transparent;
      border-radius: var(--p-content-border-radius);
    }
    .field--failing {
      border-color: var(--p-red-500);
    }
    .field--corrected {
      border-color: var(--p-green-500);
    }
    label {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.25rem;
      font-size: 0.8125rem;
    }
    .flag {
      display: inline-flex;
      align-items: center;
      gap: 0.125rem;
      color: var(--p-red-600);
      font-size: 0.75rem;
    }
    input {
      text-align: right;
      font-variant-numeric: tabular-nums;
      min-width: 0;
      width: 100%;
    }
    .error {
      color: var(--p-red-600);
    }
    .corrected {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.375rem;
    }
    .muted,
    .involved {
      color: var(--p-text-muted-color);
      font-size: 0.8125rem;
      margin: 0;
    }
    @media (max-width: 640px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class CorrectionGridComponent {
  readonly row = input.required<ImportRow>();

  private readonly store = inject(ImportSessionStore);
  private readonly i18n = inject(I18nService);

  protected busy(): boolean {
    return ['reading', 'checking', 'importing', 'done'].includes(this.store.phase());
  }

  protected messageId(): string {
    return `earnings-import-check-message-${this.row().clientFileId}`;
  }

  protected hasEditable(recordIndex: number): boolean {
    return this.row().editable.some((e) => e.recordIndex === recordIndex);
  }

  protected title(record: EarningsPayRecordInput): string {
    const kind = this.t('earnings.kind.' + record.kind);
    return `${formatMonth(record.period, this.lang())} · ${kind}`;
  }

  protected involvedText(): string {
    const labels = new Set(
      this.row().failures.flatMap((f) =>
        f.involved.map((i) => this.t(`earnings.terms.${figureTerm(i.key)}`)),
      ),
    );
    return fill(this.t('earnings.import.involved'), { figures: [...labels].join(', ') });
  }

  protected cells(record: EarningsPayRecordInput, recordIndex: number): Cell[] {
    const row = this.row();
    const lang = this.lang();
    const amounts = record.amounts as unknown as Record<string, string | null>;
    const original = (row.originalRecords?.[recordIndex]?.amounts ?? {}) as unknown as Record<
      string,
      string | null
    >;
    return RECORD_FIGURES.filter(([key]) => amounts[key] != null).map(([key, term]) => {
      const k = key as EarningsPayAmountKey;
      const id = figureId(recordIndex, k);
      const value = amounts[key] as string;
      return {
        key: k,
        label: this.t(`earnings.terms.${term}`),
        id: `earnings-import-figure-${key}-${row.clientFileId}-${recordIndex}`,
        suffix: `${key}-${row.clientFileId}-${recordIndex}`,
        value,
        editable: row.editable.some((e) => e.recordIndex === recordIndex && e.key === k),
        failing: row.failures.some((f) =>
          f.involved.some((i) => i.recordIndex === recordIndex && i.key === k),
        ),
        corrected: (record.corrected ?? []).includes(k),
        invalid: row.inputErrors[id] === true,
        readValue: formatMoney(original[key] ?? value, lang),
        text: row.inputs[id] ?? plainAmount(value, lang),
      };
    });
  }

  protected describedBy(cell: Cell): string | null {
    const ids = [cell.failing || this.row().state === 'candidate' ? this.messageId() : null];
    if (cell.invalid) ids.push(`${cell.id}-error`);
    const out = ids.filter(Boolean).join(' ');
    return out || null;
  }

  protected readText(cell: Cell): string {
    return fill(this.t('earnings.import.readValue'), { value: cell.readValue });
  }

  protected restoreLabel(cell: Cell): string {
    return fill(this.t('earnings.import.restoreAria'), { figure: cell.label });
  }

  protected onInput(row: ImportRow, recordIndex: number, cell: Cell, event: Event): void {
    this.store.editFigure(
      row.clientFileId,
      recordIndex,
      cell.key,
      (event.target as HTMLInputElement).value,
    );
  }

  protected restore(row: ImportRow, recordIndex: number, cell: Cell): void {
    this.store.restoreFigure(row.clientFileId, recordIndex, cell.key);
  }

  private lang(): string {
    return this.i18n.language();
  }

  private t(key: string): string {
    this.i18n.language();
    return this.i18n.translate(key);
  }
}

/** Plain amount for an input: no currency, no grouping, the locale's decimal separator. */
function plainAmount(value: string, lang: string): string {
  return lang.startsWith('de') ? value.replace('.', ',') : value;
}
