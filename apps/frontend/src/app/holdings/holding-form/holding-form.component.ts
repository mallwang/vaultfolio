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
import { IconComponent } from '../../shared/icon/icon.component';
import {
  ASSET_TYPES,
  ASSET_TYPE_FIELD_SETS,
  ASSET_TYPE_LABEL_KEYS,
  isValidIsin,
  type AssetTypeFieldSet,
} from '../asset-type-fields';
import { HoldingsService } from '../holdings.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

function positiveNumberValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (control.value == null || control.value === '') {
      return null;
    }
    return Number(control.value) > 0 ? null : { positive: true };
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
  templateUrl: './holding-form.component.html',
  styleUrl: './holding-form.component.css',
})
export class HoldingFormComponent implements OnChanges {
  /** `null` in add mode; the holding being edited in edit mode. */
  @Input() holding: HoldingResponse | null = null;
  @Output() saved = new EventEmitter<HoldingResponse>();
  @Output() cancelled = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly holdingsService = inject(HoldingsService);
  private readonly translate = inject(TranslatePipe);

  /** Icon shown on each type-selector button/card (FR-012, design.md's approved mockup). */
  private static readonly ASSET_TYPE_ICONS: Readonly<Record<AssetType, string>> = {
    ETF: 'chart-line',
    SHARE: 'building',
    PRECIOUS_METAL: 'diamond',
    CRYPTO: 'currency-bitcoin',
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
      [positiveNumberValidator()],
      options.resetInapplicable,
      { requiredWhenApplicable: false },
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

  protected iconFor(assetType: AssetType): string {
    return HoldingFormComponent.ASSET_TYPE_ICONS[assetType];
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
