import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type {
  CreateHoldingRequest,
  HoldingResponse,
  UpdateHoldingRequest,
} from '@vaultfolio/api-contract';
import {
  ASSET_TYPES,
  ASSET_TYPE_FIELDS,
  CRYPTO_CATALOG,
  HOLDING_UNITS,
  METAL_CATALOG,
  NOTE_MAX_LENGTH,
  fieldsForAssetType,
  validateHoldingSubmission,
  type AssetType,
  type HoldingField,
  type HoldingSubmission,
  type HoldingUnit,
} from '@vaultfolio/domain-holdings';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { IconComponent, TranslatePipe, I18nService } from '@vaultfolio/frontend-shared-ui';
import {
  ASSET_TYPE_ICONS,
  ASSET_TYPE_LABEL_KEYS,
  ASSET_TYPE_NAME_PLACEHOLDER_KEYS,
} from '../holding-display';
import { HoldingsService } from '../holdings.service';

function round(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}

/** Decimal string for the API; never exponent notation (`String(1e-7)` is "1e-7"). */
function toDecimalString(value: number): string {
  const text = String(value);
  if (!text.includes('e')) return text;
  let fixed = value.toFixed(20);
  while (fixed.endsWith('0')) fixed = fixed.slice(0, -1);
  return fixed.endsWith('.') ? fixed.slice(0, -1) : fixed;
}

/**
 * Add/edit dialog content. The visible fields come from the domain lib's
 * `ASSET_TYPE_FIELDS`; validation is the domain lib's `validateHoldingSubmission`
 * and server 400 `errors[]` use the same codes, both mapped to `holdingError.*`
 * messages under the offending field. Edit mode locks the asset type and PUTs
 * without it.
 *
 * Inline `template`/`styles` (see `holdings.component.ts`): this is reachable
 * from a lazily routed component.
 */
@Component({
  selector: 'app-holding-form',
  imports: [
    ReactiveFormsModule,
    InputTextModule,
    InputNumberModule,
    ButtonModule,
    MessageModule,
    SelectModule,
    TextareaModule,
    TranslatePipe,
    IconComponent,
  ],
  providers: [TranslatePipe],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="holding-form">
      <fieldset class="field field--full field--fieldset" data-testid="holding-form-type">
        <legend>{{ 'holdingForm.assetType' | translate }}</legend>
        @if (isEditMode) {
          <div class="type-select type-select--locked">
            <span class="type-option type-option--locked">
              <app-icon size="1rem" [name]="iconFor(form.controls.assetType.value)" />
              {{ labelFor(form.controls.assetType.value) }}
            </span>
          </div>
        } @else {
          <div class="type-select">
            @for (option of assetTypeOptions; track option.value) {
              <button
                type="button"
                class="type-option"
                [attr.data-testid]="'holding-form-type-' + option.value"
                [class.type-option--active]="form.controls.assetType.value === option.value"
                [attr.aria-pressed]="form.controls.assetType.value === option.value"
                (click)="selectAssetType(option.value)"
              >
                <app-icon size="1rem" [name]="option.icon" />
                {{ labelFor(option.value) }}
              </button>
            }
          </div>
        }
      </fieldset>

      @if (has('isin')) {
        <div class="field">
          <label for="isin" [class.field-label--required]="isRequired('isin')">
            {{ 'holdingForm.isin' | translate }}
          </label>
          <input
            id="isin"
            data-testid="holding-form-isin"
            type="text"
            pInputText
            formControlName="isin"
            [placeholder]="'holdingForm.isinPlaceholder' | translate"
          />
          @if (errorCode('isin'); as code) {
            <p-message severity="error" data-testid="holding-form-isin-error">{{
              'holdingError.' + code | translate
            }}</p-message>
          }
        </div>
      }
      @if (has('name')) {
        <div class="field">
          <label for="name" [class.field-label--required]="isRequired('name')">
            {{ 'holdingForm.name' | translate }}
          </label>
          <input
            id="name"
            data-testid="holding-form-name"
            type="text"
            pInputText
            formControlName="name"
            [placeholder]="namePlaceholderKey() | translate"
          />
          @if (errorCode('name'); as code) {
            <p-message severity="error" data-testid="holding-form-name-error">{{
              'holdingError.' + code | translate
            }}</p-message>
          }
        </div>
      }
      @if (has('metal')) {
        <div class="field" [class]="span('metal')">
          <label for="metal" [class.field-label--required]="isRequired('metal')">
            {{ 'holdingForm.metal' | translate }}
          </label>
          <p-select
            [fluid]="true"
            inputId="metal"
            data-testid="holding-form-metal"
            formControlName="metal"
            [options]="metalOptions()"
            optionLabel="label"
            optionValue="code"
            [placeholder]="'holdingForm.metalPlaceholder' | translate"
            appendTo="body"
          />
          @if (errorCode('metal'); as code) {
            <p-message severity="error" data-testid="holding-form-metal-error">{{
              'holdingError.' + code | translate
            }}</p-message>
          }
        </div>
      }
      @if (has('coinId')) {
        <div class="field" [class]="span('coinId')">
          <label for="coinId" [class.field-label--required]="isRequired('coinId')">
            {{ 'holdingForm.coin' | translate }}
          </label>
          <p-select
            [fluid]="true"
            inputId="coinId"
            data-testid="holding-form-coin"
            formControlName="coinId"
            [options]="coinOptions"
            optionLabel="label"
            optionValue="id"
            [filter]="true"
            filterBy="name,symbol"
            [placeholder]="'holdingForm.coinPlaceholder' | translate"
            appendTo="body"
          />
          @if (errorCode('coinId'); as code) {
            <p-message severity="error" data-testid="holding-form-coin-error">{{
              'holdingError.' + code | translate
            }}</p-message>
          }
        </div>
      }
      @if (has('quantity')) {
        <div class="field" [class]="span('quantity')">
          <label for="quantity" [class.field-label--required]="isRequired('quantity')">
            {{ 'holdingForm.quantity' | translate }}
          </label>
          <p-inputnumber
            [fluid]="true"
            inputId="quantity"
            data-testid="holding-form-quantity"
            formControlName="quantity"
            mode="decimal"
            [locale]="i18n.language()"
            [maxFractionDigits]="8"
            [placeholder]="'holdingForm.quantityPlaceholder' | translate"
          />
          @if (assetType() === 'CRYPTO') {
            <span class="unit-hint" data-testid="holding-form-quantity-hint">{{
              'holdingForm.quantityHint' | translate
            }}</span>
          }
          @if (errorCode('quantity'); as code) {
            <p-message severity="error" data-testid="holding-form-quantity-error">{{
              'holdingError.' + code | translate
            }}</p-message>
          }
        </div>
      }
      @if (has('unit')) {
        <div class="field" [class]="span('unit')">
          <label for="unit" [class.field-label--required]="isRequired('unit')">
            {{ 'holdingForm.unit' | translate }}
          </label>
          <p-select
            [fluid]="true"
            inputId="unit"
            data-testid="holding-form-unit"
            formControlName="unit"
            [options]="unitOptions()"
            optionLabel="label"
            optionValue="value"
            appendTo="body"
          /><span class="unit-hint">{{ 'holdingForm.unitHint' | translate }}</span>
          @if (errorCode('unit'); as code) {
            <p-message severity="error" data-testid="holding-form-unit-error">{{
              'holdingError.' + code | translate
            }}</p-message>
          }
        </div>
      }
      @if (has('purchasePrice')) {
        <div class="field" [class]="span('purchasePrice')">
          <label for="purchasePrice" [class.field-label--required]="isRequired('purchasePrice')">
            {{ 'holdingForm.purchasePrice' | translate }}
          </label>
          <p-inputnumber
            [fluid]="true"
            inputId="purchasePrice"
            data-testid="holding-form-purchase-price"
            formControlName="purchasePrice"
            mode="decimal"
            [locale]="i18n.language()"
            [minFractionDigits]="2"
            [maxFractionDigits]="8"
            [placeholder]="'holdingForm.purchasePricePlaceholder' | translate"
          />
          @if (errorCode('purchasePrice'); as code) {
            <p-message severity="error" data-testid="holding-form-purchase-price-error">{{
              'holdingError.' + code | translate
            }}</p-message>
          }
        </div>
      }
      @if (has('purchasePrice')) {
        <div class="field" [class]="span('purchaseTotal')">
          <label for="purchaseTotal" class="field-label--required">{{
            'holdingForm.purchaseTotal' | translate
          }}</label>
          <p-inputnumber
            [fluid]="true"
            inputId="purchaseTotal"
            data-testid="holding-form-purchase-total"
            formControlName="purchaseTotal"
            mode="decimal"
            [locale]="i18n.language()"
            [minFractionDigits]="2"
            [maxFractionDigits]="2"
            [placeholder]="'holdingForm.purchaseTotalPlaceholder' | translate"
          />
        </div>
      }
      @if (has('currentValue')) {
        <div class="field">
          <label for="currentValue" [class.field-label--required]="isRequired('currentValue')">
            {{ 'holdingForm.currentValue' | translate }}
          </label>
          <p-inputnumber
            [fluid]="true"
            inputId="currentValue"
            data-testid="holding-form-current-value"
            formControlName="currentValue"
            mode="decimal"
            [locale]="i18n.language()"
            [maxFractionDigits]="8"
            [placeholder]="'holdingForm.currentValuePlaceholder' | translate"
          />
          @if (errorCode('currentValue'); as code) {
            <p-message severity="error" data-testid="holding-form-current-value-error">{{
              'holdingError.' + code | translate
            }}</p-message>
          }
        </div>
      }
      @if (true) {
        <div class="field field--full">
          <label for="management" [class.field-label--required]="isRequired('management')">
            {{ 'holdingForm.management' | translate }}
          </label>
          <input
            id="management"
            data-testid="holding-form-management"
            type="text"
            pInputText
            formControlName="management"
            [placeholder]="'holdingForm.managementPlaceholder' | translate"
          />
          @if (errorCode('management'); as code) {
            <p-message severity="error" data-testid="holding-form-management-error">{{
              'holdingError.' + code | translate
            }}</p-message>
          }
        </div>
      }
      @if (has('note')) {
        <div class="field field--full">
          <label for="note" [class.field-label--required]="isRequired('note')">
            {{ 'holdingForm.note' | translate }}
          </label>
          <textarea
            id="note"
            data-testid="holding-form-note"
            pTextarea
            rows="2"
            formControlName="note"
            [placeholder]="'holdingForm.notePlaceholder' | translate"
          ></textarea>
          <span class="note-counter" data-testid="holding-form-note-counter">{{
            'holdingForm.noteCounter' | translate: { count: noteMax - noteLength() }
          }}</span>
          @if (errorCode('note'); as code) {
            <p-message severity="error" data-testid="holding-form-note-error">{{
              'holdingError.' + code | translate
            }}</p-message>
          }
        </div>
      }

      @if (submitError()) {
        <p-message class="field--full" severity="error" data-testid="holding-form-error">{{
          'holdingForm.saveFailed' | translate
        }}</p-message>
      }

      <div class="form-actions field--full">
        <button
          pButton
          data-testid="holding-form-cancel"
          type="button"
          severity="secondary"
          (click)="cancel()"
        >
          {{ 'common.cancel' | translate }}
        </button>
        <button pButton data-testid="holding-form-submit" type="submit" [loading]="submitting()">
          {{ 'common.save' | translate }}
        </button>
      </div>
    </form>
  `,
  styles: `
    .holding-form {
      display: grid;
      grid-template-columns: repeat(30, minmax(0, 1fr));
      gap: 1rem 0.75rem;
      min-width: 20rem;
      max-width: 36rem;
    }

    .holding-form > .field {
      grid-column: span 15;
    }

    .holding-form > .field--third {
      grid-column: span 10;
    }

    .holding-form > .field--wide {
      grid-column: span 18;
    }

    .holding-form > .field--narrow {
      grid-column: span 12;
    }

    .holding-form > .field--full {
      grid-column: 1 / -1;
    }

    @media (max-width: 30rem) {
      .holding-form > .field,
      .holding-form > .field--third,
      .holding-form > .field--wide,
      .holding-form > .field--narrow {
        grid-column: 1 / -1;
      }
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .field label {
      font-weight: 600;
    }

    /*
 * Required marker is generated content (a non-breaking space + "*") rather
 * than an inline element in the template, so it can never be pushed onto its
 * own line by a text wrap — a plain "<span> *</span>" wraps away from a long
 * label on narrow field-row columns.
 */
    .field-label--required::after {
      content: '\\00a0*';
      color: var(--p-red-500);
    }

    .field--fieldset {
      margin: 0;
      padding: 0;
      border: none;
    }

    .field--fieldset legend {
      padding: 0;
      font-weight: 600;
      margin-bottom: 0.35rem;
    }

    /* FR-012: asset-type selector, same chip look as the holdings table's filter. */
    .type-select {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }

    .type-option {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.25rem 0.75rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: 999px;
      background: var(--p-content-background);
      color: inherit;
      font-size: 0.85rem;
      cursor: pointer;
    }

    .type-option--active {
      border-color: var(--p-primary-color);
      background: var(--p-highlight-background);
      color: var(--p-primary-color);
    }

    .type-option--locked {
      cursor: default;
    }

    .note-counter {
      align-self: flex-end;
      font-size: 0.75rem;
      color: var(--p-text-muted-color);
    }

    .unit-hint {
      font-size: 0.75rem;
      color: var(--p-text-muted-color);
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }
  `,
})
export class HoldingFormComponent implements OnChanges {
  /** `null` in add mode; the holding being edited in edit mode. */
  @Input() holding: HoldingResponse | null = null;
  @Output() saved = new EventEmitter<HoldingResponse>();
  @Output() cancelled = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly holdingsService = inject(HoldingsService);
  private readonly translate = inject(TranslatePipe);
  /** Drives p-inputnumber's [locale] so decimal parsing follows the app language, not the OS. */
  protected readonly i18n = inject(I18nService);

  protected readonly assetTypeOptions = ASSET_TYPES.map((value) => ({
    value,
    icon: ASSET_TYPE_ICONS[value],
  }));
  protected readonly noteMax = NOTE_MAX_LENGTH;
  protected readonly coinOptions = CRYPTO_CATALOG.map((coin) => ({
    ...coin,
    label: `${coin.name} (${coin.symbol})`,
  }));
  protected readonly metalOptions = computed(() =>
    METAL_CATALOG.map((metal) => ({
      code: metal.code,
      label: this.i18n.translate(`holdingMetal.${metal.code}`),
    })),
  );
  protected readonly unitOptions = computed(() =>
    HOLDING_UNITS.map((value) => ({
      value,
      label: this.i18n.translate(`holdingForm.unit${value}`),
    })),
  );

  protected readonly assetType = signal<AssetType>('ETF');
  private readonly fields = computed(
    () => new Set<HoldingField>(fieldsForAssetType(this.assetType())),
  );
  /** Error code per field, from client validation or the server's 400 `errors[]`. */
  private readonly fieldErrors = signal<Record<string, string>>({});
  private readonly noteText = signal('');
  protected readonly submitError = signal(false);
  protected readonly submitting = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    assetType: this.fb.nonNullable.control<AssetType>('ETF'),
    management: this.fb.nonNullable.control('', Validators.required),
    note: this.fb.control<string | null>(null),
    isin: this.fb.control<string | null>(null),
    name: this.fb.control<string | null>(null),
    metal: this.fb.control<string | null>(null),
    coinId: this.fb.control<string | null>(null),
    quantity: this.fb.control<number | null>(null),
    unit: this.fb.control<HoldingUnit | null>('G'),
    purchasePrice: this.fb.control<number | null>(null),
    /** UI helper only: kept in sync with quantity × purchasePrice, never submitted. */
    purchaseTotal: this.fb.control<number | null>(null),
    currentValue: this.fb.control<number | null>(null),
  });

  get isEditMode(): boolean {
    return this.holding != null;
  }

  constructor() {
    this.form.controls.note.valueChanges.subscribe((note) => this.noteText.set(note ?? ''));
    this.form.controls.assetType.valueChanges.subscribe((type) => {
      this.assetType.set(type);
      this.fieldErrors.set({});
    });
    this.linkPurchaseAmounts();
    for (const [field, control] of Object.entries(this.form.controls) as [
      string,
      AbstractControl,
    ][]) {
      control.valueChanges.subscribe(() => this.clearError(field));
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!('holding' in changes)) return;
    this.submitError.set(false);
    this.fieldErrors.set({});
    const holding = this.holding;
    if (holding) {
      this.form.reset({
        assetType: holding.assetType,
        management: holding.management,
        note: holding.note,
        isin: holding.isin,
        name: holding.name,
        metal: holding.metal,
        coinId: holding.coinId,
        quantity: holding.quantity != null ? Number(holding.quantity) : null,
        unit: holding.unit ?? 'G',
        purchasePrice: holding.purchasePrice != null ? Number(holding.purchasePrice) : null,
        currentValue: holding.currentValue != null ? Number(holding.currentValue) : null,
      });
      this.syncTotalFromPrice();
      this.form.controls.assetType.disable();
    } else {
      this.form.reset({ assetType: 'ETF', management: '', unit: 'G' });
      this.form.controls.assetType.enable();
    }
    this.lastEdited = 'price';
    this.assetType.set(this.form.controls.assetType.value);
  }

  protected has(field: string): boolean {
    return this.fields().has(field as HoldingField);
  }

  protected isRequired(field: string): boolean {
    return (
      field === 'management' ||
      ASSET_TYPE_FIELDS[this.assetType()].required.includes(field as HoldingField)
    );
  }

  protected errorCode(field: string): string | undefined {
    return this.fieldErrors()[field];
  }

  protected noteLength(): number {
    return Array.from(this.noteText()).length;
  }

  private clearError(field: string): void {
    if (this.fieldErrors()[field]) {
      this.fieldErrors.update((errors) => {
        const rest = { ...errors };
        delete rest[field];
        return rest;
      });
    }
  }

  protected submit(): void {
    this.submitError.set(false);
    const submission = this.toSubmission();
    const result = validateHoldingSubmission(submission);
    if (!result.valid) {
      this.setErrors(result.fieldErrors);
      return;
    }
    this.submitting.set(true);
    const update: Partial<typeof submission> = { ...submission };
    delete update.assetType;
    const request$ = this.holding
      ? this.holdingsService.update(this.holding.id, update as UpdateHoldingRequest)
      : this.holdingsService.create(submission as CreateHoldingRequest);
    request$.subscribe({
      next: (saved) => {
        this.submitting.set(false);
        this.saved.emit(saved);
      },
      error: (error: { error?: { errors?: { field: string; code: string }[] } }) => {
        this.submitting.set(false);
        const errors = error.error?.errors;
        if (errors?.length) {
          this.setErrors(errors);
        } else {
          this.submitError.set(true);
        }
      },
    });
  }

  private setErrors(errors: readonly { field: string; code: string }[]): void {
    const byField: Record<string, string> = {};
    for (const { field, code } of errors) {
      byField[field] ??= code;
    }
    this.fieldErrors.set(byField);
  }

  /** Only the asset type's own fields, decimals as strings, empty optionals omitted. */
  private toSubmission(): HoldingSubmission {
    const raw = this.form.getRawValue();
    const submission: Record<string, string> = {
      assetType: raw.assetType,
      management: raw.management.trim(),
    };
    const values: Record<string, string | null | undefined> = {
      note: raw.note?.trim(),
      isin: raw.isin?.trim().toUpperCase(),
      name: raw.name?.trim(),
      metal: raw.metal,
      coinId: raw.coinId,
      unit: raw.unit,
      quantity: raw.quantity == null ? null : toDecimalString(raw.quantity),
      purchasePrice: raw.purchasePrice == null ? null : toDecimalString(raw.purchasePrice),
      currentValue: raw.currentValue == null ? null : toDecimalString(raw.currentValue),
    };
    for (const field of this.fields()) {
      const value = values[field];
      if (value) submission[field] = value;
    }
    return submission as unknown as HoldingSubmission;
  }

  protected cancel(): void {
    this.cancelled.emit();
  }

  protected selectAssetType(assetType: AssetType): void {
    if (!this.isEditMode) this.form.controls.assetType.setValue(assetType);
  }

  protected labelFor(assetType: AssetType): string {
    return this.translate.transform(ASSET_TYPE_LABEL_KEYS[assetType]);
  }

  /** Grid-span class: three-up rows for ETF/share (amounts) and metal (type, quantity, unit); crypto is 60/40. */
  protected span(field: string): string {
    const type = this.assetType();
    if (type === 'CRYPTO') {
      if (field === 'coinId') return 'field--wide';
      return field === 'quantity' ? 'field--narrow' : '';
    }
    const thirds: Record<string, string[]> = {
      PRECIOUS_METAL: ['metal', 'quantity', 'unit'],
      ETF: ['quantity', 'purchasePrice', 'purchaseTotal'],
      SHARE: ['quantity', 'purchasePrice', 'purchaseTotal'],
    };
    return thirds[type]?.includes(field) ? 'field--third' : '';
  }

  /** Price per unit and total purchase value derive each other via the quantity; the one edited last wins. */
  private lastEdited: 'price' | 'total' = 'price';

  private linkPurchaseAmounts(): void {
    const { quantity, purchasePrice, purchaseTotal } = this.form.controls;
    purchasePrice.valueChanges.subscribe(() => {
      this.lastEdited = 'price';
      this.syncTotalFromPrice();
    });
    purchaseTotal.valueChanges.subscribe((total) => {
      if (total == null) return;
      this.lastEdited = 'total';
      const qty = quantity.value;
      if (total != null && qty) {
        purchasePrice.setValue(round(total / qty, 8), { emitEvent: false });
      }
    });
    quantity.valueChanges.subscribe((qty) => {
      if (!qty) return;
      if (this.lastEdited === 'price') this.syncTotalFromPrice();
      else if (purchaseTotal.value != null) {
        purchasePrice.setValue(round(purchaseTotal.value / qty, 8), { emitEvent: false });
      }
    });
  }

  private syncTotalFromPrice(): void {
    const { quantity, purchasePrice, purchaseTotal } = this.form.controls;
    if (purchasePrice.value != null && quantity.value) {
      purchaseTotal.setValue(round(purchasePrice.value * quantity.value, 2), { emitEvent: false });
    }
  }

  protected namePlaceholderKey(): string {
    return ASSET_TYPE_NAME_PLACEHOLDER_KEYS[this.assetType()];
  }

  protected iconFor(assetType: AssetType): string {
    return ASSET_TYPE_ICONS[assetType];
  }
}
