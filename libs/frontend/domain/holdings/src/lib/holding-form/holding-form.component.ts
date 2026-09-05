import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import type {
  AssetType,
  CreateHoldingRequest,
  HoldingResponse,
  UpdateHoldingRequest,
} from '@vaultfolio/api-contract';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { IconComponent, TranslatePipe, I18nService } from '@vaultfolio/frontend-shared-ui';
import {
  ASSET_TYPES,
  ASSET_TYPE_FIELD_SETS,
  ASSET_TYPE_LABEL_KEYS,
  ASSET_TYPE_NAME_PLACEHOLDER_KEYS,
  isValidIsin,
  type AssetTypeFieldSet,
} from '../asset-type-fields';
import { HoldingsService } from '../holdings.service';

function positiveNumberValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (control.value == null || control.value === '') {
      return null;
    }
    return Number(control.value) > 0 ? null : { positive: true };
  };
}

/** currentValue's floor is 0 (an emptied deposit-money balance is valid), unlike every other decimal field. */
function nonNegativeNumberValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (control.value == null || control.value === '') {
      return null;
    }
    return Number(control.value) >= 0 ? null : { nonNegative: true };
  };
}

function notFutureDateValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as Date | null;
    if (!value) {
      return null;
    }
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return value.getTime() <= today.getTime() ? null : { future: true };
  };
}

function isinValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string | null;
    if (!value) {
      return null;
    }
    return isValidIsin(value) ? null : { isin: true };
  };
}

/** Decimal-string round trip that avoids native-float artifacts for typical UI-entered values. */
function toDecimalString(value: number | null): string | undefined {
  if (value == null) {
    return undefined;
  }
  return String(value);
}

function toIsoDateOnly(value: Date | null): string | undefined {
  if (!value) {
    return undefined;
  }
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Add/edit dialog content (FR-001–FR-010, FR-014, FR-015). One Angular
 * Reactive Form whose field set is driven by the selected (add mode) or
 * locked (edit mode) asset type, per research.md #5. Add mode creates via
 * `POST /holdings` (which may upsert an ETF/Gold row in place, FR-011a); edit
 * mode updates via `PUT /holdings/:id`, scoped to the holding's own type.
 *
 * Inline `template`/`styles`, not `templateUrl`/`styleUrl` — see
 * `holdings.component.ts`'s identical note (020): this dialog's content is
 * reachable transitively from the same lazily-routed `HoldingsComponent`.
 */
@Component({
  selector: 'app-holding-form',
  imports: [
    ReactiveFormsModule,
    InputTextModule,
    InputNumberModule,
    DatePickerModule,
    ButtonModule,
    MessageModule,
    TranslatePipe,
    IconComponent,
  ],
  providers: [TranslatePipe],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="holding-form">
      <fieldset class="field field--fieldset">
        <legend>{{ 'holdingForm.assetType' | translate }}</legend>
        @if (isEditMode) {
          <div class="type-select type-select--locked">
            <span class="type-option type-option--locked">
              <app-icon [name]="iconFor(form.controls.assetType.value)" />
              {{ labelFor(form.controls.assetType.value) }}
            </span>
          </div>
        } @else {
          <div class="type-select">
            @for (option of assetTypeOptions; track option.value) {
              <button
                type="button"
                class="type-option"
                [class.type-option--active]="form.controls.assetType.value === option.value"
                [attr.aria-pressed]="form.controls.assetType.value === option.value"
                (click)="selectAssetType(option.value)"
              >
                <app-icon [name]="option.icon" />
                {{ labelFor(option.value) }}
              </button>
            }
          </div>
        }
      </fieldset>

      <div class="field-row">
        <div class="field">
          <label for="management" [class.field-label--required]="isRequired('management')">
            {{ 'holdingForm.management' | translate }}
          </label>
          <input
            id="management"
            type="text"
            pInputText
            formControlName="management"
            [placeholder]="'holdingForm.managementPlaceholder' | translate"
          />
          @if (form.controls.management.invalid && form.controls.management.touched) {
            <p-message severity="error">{{
              'holdingForm.managementRequired' | translate
            }}</p-message>
          }
        </div>

        @if (fieldSet().name) {
          <div class="field">
            <label for="name" [class.field-label--required]="isRequired('name')">
              {{ 'holdingForm.name' | translate }}
            </label>
            <input
              id="name"
              type="text"
              pInputText
              formControlName="name"
              [placeholder]="namePlaceholderKey() | translate"
            />
            @if (form.controls.name.invalid && form.controls.name.touched) {
              <p-message severity="error">{{ 'holdingForm.nameRequired' | translate }}</p-message>
            }
          </div>
        }
      </div>

      @if (fieldSet().isin) {
        <div class="field">
          <label for="isin" [class.field-label--required]="isRequired('isin')">
            {{ 'holdingForm.isin' | translate }}
          </label>
          <input
            id="isin"
            type="text"
            pInputText
            formControlName="isin"
            [placeholder]="'holdingForm.isinPlaceholder' | translate"
          />
          @if (form.controls.isin.invalid && form.controls.isin.touched) {
            @if (form.controls.isin.errors?.['isin']) {
              <p-message severity="error">{{ 'holdingForm.isinInvalid' | translate }}</p-message>
            } @else {
              <p-message severity="error">{{ 'holdingForm.isinRequired' | translate }}</p-message>
            }
          }
        </div>
      }

      @if (fieldSet().quantity || fieldSet().purchasePrice) {
        <div class="field-row">
          @if (fieldSet().quantity) {
            <div class="field">
              <label for="quantity" [class.field-label--required]="isRequired('quantity')">
                {{ 'holdingForm.quantity' | translate }}
              </label>
              <p-inputnumber
                id="quantity"
                formControlName="quantity"
                mode="decimal"
                [locale]="i18n.language()"
                [maxFractionDigits]="8"
                [placeholder]="'holdingForm.quantityPlaceholder' | translate"
              />
              @if (form.controls.quantity.invalid && form.controls.quantity.touched) {
                <p-message severity="error">{{
                  'holdingForm.quantityInvalid' | translate
                }}</p-message>
              }
            </div>
          }

          @if (fieldSet().purchasePrice) {
            <div class="field">
              <label
                for="purchasePrice"
                [class.field-label--required]="isRequired('purchasePrice')"
              >
                {{
                  (form.controls.assetType.value === 'ETF'
                    ? 'holdingForm.averagePurchasePrice'
                    : 'holdingForm.purchasePrice'
                  ) | translate
                }}
              </label>
              <p-inputnumber
                id="purchasePrice"
                formControlName="purchasePrice"
                mode="decimal"
                [locale]="i18n.language()"
                [maxFractionDigits]="8"
                [placeholder]="'holdingForm.purchasePricePlaceholder' | translate"
              />
              @if (form.controls.purchasePrice.invalid && form.controls.purchasePrice.touched) {
                <p-message severity="error">{{
                  'holdingForm.purchasePriceInvalid' | translate
                }}</p-message>
              }
            </div>
          }
        </div>
      }

      @if (fieldSet().weightGrams || fieldSet().currentValue) {
        <div class="field-row">
          @if (fieldSet().weightGrams) {
            <div class="field">
              <label for="weightGrams" [class.field-label--required]="isRequired('weightGrams')">
                {{ 'holdingForm.weightGrams' | translate }}
              </label>
              <p-inputnumber
                id="weightGrams"
                formControlName="weightGrams"
                mode="decimal"
                [locale]="i18n.language()"
                [maxFractionDigits]="8"
                [placeholder]="'holdingForm.weightGramsPlaceholder' | translate"
              />
              @if (form.controls.weightGrams.invalid && form.controls.weightGrams.touched) {
                <p-message severity="error">{{
                  'holdingForm.weightGramsInvalid' | translate
                }}</p-message>
              }
            </div>
          }

          @if (fieldSet().currentValue) {
            <div class="field">
              <label for="currentValue" [class.field-label--required]="isRequired('currentValue')">
                {{ 'holdingForm.currentValue' | translate }}
              </label>
              <p-inputnumber
                id="currentValue"
                formControlName="currentValue"
                mode="decimal"
                [locale]="i18n.language()"
                [maxFractionDigits]="8"
                [placeholder]="'holdingForm.currentValuePlaceholder' | translate"
              />
              @if (form.controls.currentValue.invalid && form.controls.currentValue.touched) {
                <p-message severity="error">{{
                  'holdingForm.currentValueInvalid' | translate
                }}</p-message>
              }
            </div>
          }
        </div>
      }

      @if (fieldSet().purchaseDate === 'optional') {
        <div class="field">
          <label for="purchaseDate">{{ 'holdingForm.purchaseDate' | translate }}</label>
          <p-datepicker
            id="purchaseDate"
            formControlName="purchaseDate"
            [dateFormat]="dateFormat()"
            [showIcon]="true"
            [placeholder]="'holdingForm.purchaseDatePlaceholder' | translate"
          >
            <ng-template #triggericon><app-icon name="calendar" /></ng-template>
          </p-datepicker>
          @if (form.controls.purchaseDate.invalid && form.controls.purchaseDate.touched) {
            <p-message severity="error">{{
              'holdingForm.purchaseDateInvalid' | translate
            }}</p-message>
          }
        </div>
      }

      @if (submitError(); as message) {
        <p-message severity="error">{{ message }}</p-message>
      }

      <div class="form-actions">
        <button pButton type="button" severity="secondary" (click)="cancel()">
          {{ 'common.cancel' | translate }}
        </button>
        <button pButton type="submit" [disabled]="form.invalid" [loading]="submitting()">
          {{ 'common.save' | translate }}
        </button>
      </div>
    </form>
  `,
  styles: `
    .holding-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      min-width: 20rem;
      max-width: 30rem;
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

    .field-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }

    .field-row > .field:only-child {
      grid-column: 1 / -1;
    }

    @media (max-width: 26rem) {
      .field-row {
        grid-template-columns: 1fr;
      }
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

    /* FR-012: button/card asset-type selector (design.md's approved mockup). */
    .type-select {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 0.4rem;
    }

    @media (max-width: 26rem) {
      .type-select {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    .type-option {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.3rem;
      padding: 0.5rem 0.25rem;
      border: 1.5px solid transparent;
      border-radius: 10px;
      font-size: 0.72rem;
      font-weight: 600;
      color: var(--p-text-muted-color);
      cursor: pointer;
      background: transparent;
      text-align: center;
      line-height: 1.15;
    }

    .type-option--active {
      border-color: var(--p-primary-color);
      color: var(--p-primary-color);
      background: var(--p-highlight-background);
    }

    .type-select--locked {
      grid-template-columns: 1fr;
    }

    .type-option--locked {
      flex-direction: row;
      justify-content: center;
      cursor: default;
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
  /** Drives p-inputnumber's [locale] input — without it, PrimeNG falls back to the
   *  browser's OS locale for decimal-separator parsing, which can silently
   *  disagree with the app's own language setting (e.g. an English UI on a
   *  German-locale OS would still only accept "45,50", not "45.50"). */
  protected readonly i18n = inject(I18nService);

  /** Icon shown on each type-selector button/card (FR-012, design.md's approved mockup). */
  private static readonly ASSET_TYPE_ICONS: Readonly<Record<AssetType, string>> = {
    ETF: 'chart-line',
    SHARE: 'building',
    PRECIOUS_METAL: 'diamond',
    CRYPTO: 'currency-bitcoin',
    DEPOSIT_MONEY: 'wallet',
  };

  protected readonly assetTypeOptions = ASSET_TYPES.map((value) => ({
    value,
    icon: HoldingFormComponent.ASSET_TYPE_ICONS[value],
  }));
  protected readonly fieldSet = signal<AssetTypeFieldSet>(ASSET_TYPE_FIELD_SETS['ETF']);
  protected readonly submitError = signal<string | null>(null);
  protected readonly submitting = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    assetType: this.fb.nonNullable.control<AssetType>('ETF', Validators.required),
    management: this.fb.nonNullable.control('', Validators.required),
    isin: this.fb.control<string | null>(null),
    name: this.fb.control<string | null>(null),
    quantity: this.fb.control<number | null>(null),
    purchasePrice: this.fb.control<number | null>(null),
    purchaseDate: this.fb.control<Date | null>(null),
    weightGrams: this.fb.control<number | null>(null),
    currentValue: this.fb.control<number | null>(null),
  });

  get isEditMode(): boolean {
    return this.holding != null;
  }

  constructor() {
    this.form.controls.assetType.valueChanges.subscribe((assetType) => {
      this.applyFieldSet(assetType, { resetInapplicable: true });
    });
    this.applyFieldSet('ETF', { resetInapplicable: false });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('holding' in changes) {
      this.submitError.set(null);
      if (this.holding) {
        this.form.reset({
          assetType: this.holding.assetType,
          management: this.holding.management,
          isin: this.holding.isin,
          name: this.holding.name,
          quantity: this.holding.quantity != null ? Number(this.holding.quantity) : null,
          purchasePrice:
            this.holding.purchasePrice != null ? Number(this.holding.purchasePrice) : null,
          purchaseDate: this.holding.purchaseDate ? new Date(this.holding.purchaseDate) : null,
          weightGrams: this.holding.weightGrams != null ? Number(this.holding.weightGrams) : null,
          currentValue:
            this.holding.currentValue != null ? Number(this.holding.currentValue) : null,
        });
        this.form.controls.assetType.disable();
        this.applyFieldSet(this.holding.assetType, { resetInapplicable: false });
      } else {
        this.form.reset({ assetType: 'ETF', management: '' });
        this.form.controls.assetType.enable();
        this.applyFieldSet('ETF', { resetInapplicable: false });
      }
    }
  }

  private applyFieldSet(assetType: AssetType, options: { resetInapplicable: boolean }): void {
    const fieldSet = ASSET_TYPE_FIELD_SETS[assetType];
    this.fieldSet.set(fieldSet);
    const { controls } = this.form;

    this.configureControl(controls.isin, fieldSet.isin, [], options.resetInapplicable);
    this.configureControl(controls.name, fieldSet.name, [], options.resetInapplicable);
    this.configureControl(
      controls.quantity,
      fieldSet.quantity,
      [positiveNumberValidator()],
      options.resetInapplicable,
    );
    this.configureControl(
      controls.purchasePrice,
      fieldSet.purchasePrice,
      [positiveNumberValidator()],
      options.resetInapplicable,
    );
    this.configureControl(
      controls.purchaseDate,
      fieldSet.purchaseDate !== 'hidden',
      [notFutureDateValidator()],
      options.resetInapplicable,
      { requiredWhenApplicable: false },
    );
    this.configureControl(
      controls.weightGrams,
      fieldSet.weightGrams,
      [positiveNumberValidator()],
      options.resetInapplicable,
    );
    this.configureControl(
      controls.currentValue,
      fieldSet.currentValue,
      [nonNegativeNumberValidator()],
      options.resetInapplicable,
      // Required for DEPOSIT_MONEY (FR-002); optional for PRECIOUS_METAL
      // (used only by the distribution view, FR-012a).
      { requiredWhenApplicable: assetType === 'DEPOSIT_MONEY' },
    );

    if (fieldSet.isin) {
      controls.isin.addValidators(isinValidator());
    }
  }

  private configureControl(
    control: AbstractControl,
    applicable: boolean,
    extraValidators: ValidatorFn[],
    resetInapplicable: boolean,
    opts: { requiredWhenApplicable: boolean } = { requiredWhenApplicable: true },
  ): void {
    if (!applicable) {
      if (resetInapplicable) {
        control.reset(null);
      }
      control.clearValidators();
      control.updateValueAndValidity({ emitEvent: false });
      return;
    }

    const validators = [...extraValidators];
    if (opts.requiredWhenApplicable) {
      validators.push(Validators.required);
    }
    control.setValidators(validators);
    control.updateValueAndValidity({ emitEvent: false });
  }

  protected submit(): void {
    this.submitError.set(null);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    const raw = this.form.getRawValue();
    const body = this.toRequestBody(raw);
    this.submitting.set(true);

    const request$ = this.isEditMode
      ? this.holdingsService.update(this.holding!.id, body as unknown as UpdateHoldingRequest)
      : this.holdingsService.create(body as unknown as CreateHoldingRequest);

    request$.subscribe({
      next: (result) => {
        this.submitting.set(false);
        this.saved.emit(result);
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.submitError.set(this.extractServerErrors(error));
      },
    });
  }

  protected cancel(): void {
    this.cancelled.emit();
  }

  /** FR-012: button/card type selector — clicking a card selects that asset type (add mode only). */
  protected selectAssetType(assetType: AssetType): void {
    if (this.isEditMode) {
      return;
    }
    this.form.controls.assetType.setValue(assetType);
  }

  protected labelFor(assetType: AssetType): string {
    return this.translate.transform(ASSET_TYPE_LABEL_KEYS[assetType]);
  }

  /** Example text shown in the "name" field's placeholder differs by asset type (FR-012a-adjacent UX polish). */
  protected namePlaceholderKey(): string {
    return ASSET_TYPE_NAME_PLACEHOLDER_KEYS[this.form.controls.assetType.value];
  }

  protected iconFor(assetType: AssetType): string {
    return HoldingFormComponent.ASSET_TYPE_ICONS[assetType];
  }

  /** p-datepicker's display/typing format (PrimeNG tokens, not a date-fns/ICU pattern) —
   *  kept in lockstep with the holdings table's `localeDate` pipe (Intl.DateTimeFormat
   *  under the active language), so the same date reads the same way whether it's
   *  being typed here or displayed there: German is day-month-year with dots
   *  (TT.MM.JJJJ), English is US month/day/year (MM/DD/YYYY). Storage is unaffected:
   *  toIsoDateOnly() reads the Date object's fields directly, not this display string. */
  protected dateFormat(): string {
    return this.i18n.language() === 'de' ? 'dd.mm.yy' : 'mm/dd/yy';
  }

  /** Drives the label's "*" marker — required-ness varies by asset type (e.g. currentValue). */
  protected isRequired(controlName: keyof typeof this.form.controls): boolean {
    return this.form.controls[controlName].hasValidator(Validators.required);
  }

  private toRequestBody(raw: {
    assetType: AssetType;
    management: string;
    isin: string | null;
    name: string | null;
    quantity: number | null;
    purchasePrice: number | null;
    purchaseDate: Date | null;
    weightGrams: number | null;
    currentValue: number | null;
  }): Record<string, unknown> {
    const fieldSet = ASSET_TYPE_FIELD_SETS[raw.assetType];
    const body: Record<string, unknown> = {
      assetType: raw.assetType,
      management: raw.management,
    };
    if (fieldSet.isin && raw.isin) {
      body['isin'] = raw.isin;
    }
    if (fieldSet.name && raw.name) {
      body['name'] = raw.name;
    }
    if (fieldSet.quantity) {
      body['quantity'] = toDecimalString(raw.quantity);
    }
    if (fieldSet.purchasePrice) {
      body['purchasePrice'] = toDecimalString(raw.purchasePrice);
    }
    if (fieldSet.purchaseDate !== 'hidden') {
      const date = toIsoDateOnly(raw.purchaseDate);
      if (date) {
        body['purchaseDate'] = date;
      }
    }
    if (fieldSet.weightGrams) {
      body['weightGrams'] = toDecimalString(raw.weightGrams);
    }
    if (fieldSet.currentValue) {
      const value = toDecimalString(raw.currentValue);
      if (value) {
        body['currentValue'] = value;
      }
    }
    return body;
  }

  private extractServerErrors(error: unknown): string {
    const httpError = error as { error?: { fieldErrors?: { field: string; message: string }[] } };
    const fieldErrors = httpError.error?.fieldErrors;
    if (fieldErrors && fieldErrors.length > 0) {
      return fieldErrors.map((fieldError) => fieldError.message).join(' ');
    }
    return 'Unable to save this holding. Please try again.';
  }
}
