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
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import type {
  AccountCategory,
  AccountOverviewEntry,
  AccountStatus,
  CreateAccountOverviewEntryRequest,
  UpdateAccountOverviewEntryRequest,
} from '@vaultfolio/api-contract';
import { ACCOUNT_CATEGORIES } from '../account-category-options';
import { ACCOUNT_STATUSES } from '../account-status-options';
import { formatCardNumberInput, formatExpirationInput } from '../card-format';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { I18nService, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { AccountOverviewService } from '../account-overview.service';

/** Category `p-select` option, label resolved through the translate pipe (design.md's fixed order). */
interface CategoryOption {
  value: AccountCategory;
  labelKey: string;
}

/** Status `p-select` option, label resolved through the translate pipe (active listed before decommissioned). */
interface StatusOption {
  value: AccountStatus;
  labelKey: string;
}

/** Requires a well-formed absolute `http(s)://` URL — matches the field's own placeholder example. */
function urlValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string | null;
    if (!value) {
      return null;
    }
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:' ? null : { url: true };
    } catch {
      return { url: true };
    }
  };
}

/** A recorded minimum balance can't be negative. */
function nonNegativeNumberValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (control.value == null || control.value === '') {
      return null;
    }
    return Number(control.value) >= 0 ? null : { nonNegative: true };
  };
}

/** Reads a stored `requiredMinimum` (a plain integer string, e.g. "500") back into the
 *  currency input's numeric value. Any pre-existing free-text value that doesn't parse as a
 *  finite number falls back to empty rather than showing NaN. */
function parseRequiredMinimum(value: string | null): number | null {
  if (value == null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** The inverse of `parseRequiredMinimum` — a whole-number string, since the field takes no decimals. */
function toRequiredMinimumString(value: number | null): string | undefined {
  if (value == null) {
    return undefined;
  }
  return String(Math.round(value));
}

/**
 * Add/edit dialog content (FR-003/FR-004/FR-006/FR-007), reused for both
 * modes (design.md's "Add / edit account" region) — field order: name
 * (required), category (defaults to "Other"), provider, website, purpose,
 * card usage, required minimum, notes. Add mode creates via
 * `POST /account-overview/accounts`; edit mode updates via
 * `PUT /account-overview/accounts/:id`. Mirrors `HoldingFormComponent`'s
 * shape.
 *
 * Inline `template`/`styles`, not `templateUrl`/`styleUrl` (020, 021): this
 * dialog's content is reachable transitively from the lazily-routed
 * `AccountOverviewPageComponent` — see `HoldingFormComponent`'s identical
 * note.
 */
@Component({
  selector: 'app-account-overview-form',
  imports: [
    ReactiveFormsModule,
    InputNumberModule,
    InputTextModule,
    SelectModule,
    TextareaModule,
    ButtonModule,
    MessageModule,
    TranslatePipe,
  ],
  providers: [TranslatePipe],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="account-form">
      <div class="field-row">
        <div class="field">
          <label for="name" class="field-label--required">{{
            'accountOverviewForm.name' | translate
          }}</label>
          <input
            id="name"
            type="text"
            pInputText
            data-testid="account-overview-form-name"
            formControlName="name"
            [placeholder]="'accountOverviewForm.namePlaceholder' | translate"
          />
          @if (form.controls.name.invalid && form.controls.name.touched) {
            <p-message severity="error" data-testid="account-overview-form-name-error">{{
              'accountOverviewForm.nameRequired' | translate
            }}</p-message>
          }
        </div>

        <div class="field">
          <label for="category">{{ 'accountOverviewForm.category' | translate }}</label>
          <p-select
            id="category"
            data-testid="account-overview-form-category"
            formControlName="category"
            [options]="categoryOptions"
            optionValue="value"
          >
            <ng-template #selectedItem let-option>{{ labelFor(option.value) }}</ng-template>
            <ng-template #item let-option>{{ labelFor(option.value) }}</ng-template>
          </p-select>
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label for="status">{{ 'accountOverviewForm.status' | translate }}</label>
          <p-select
            id="status"
            data-testid="account-overview-form-status"
            formControlName="status"
            [options]="statusOptions"
            optionValue="value"
          >
            <ng-template #selectedItem let-option>{{ statusLabelFor(option.value) }}</ng-template>
            <ng-template #item let-option>{{ statusLabelFor(option.value) }}</ng-template>
          </p-select>
        </div>

        <div class="field">
          <label for="provider">{{ 'accountOverviewForm.provider' | translate }}</label>
          <input
            id="provider"
            type="text"
            pInputText
            formControlName="provider"
            [placeholder]="'accountOverviewForm.providerPlaceholder' | translate"
          />
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label for="website">{{ 'accountOverviewForm.website' | translate }}</label>
          <input
            id="website"
            type="text"
            pInputText
            data-testid="account-overview-form-website"
            formControlName="website"
            [placeholder]="'accountOverviewForm.websitePlaceholder' | translate"
          />
          @if (form.controls.website.invalid && form.controls.website.touched) {
            <p-message severity="error" data-testid="account-overview-form-website-error">{{
              'accountOverviewForm.websiteInvalid' | translate
            }}</p-message>
          }
        </div>

        <div class="field">
          <label for="purpose">{{ 'accountOverviewForm.purpose' | translate }}</label>
          <input
            id="purpose"
            type="text"
            pInputText
            formControlName="purpose"
            [placeholder]="'accountOverviewForm.purposePlaceholder' | translate"
          />
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label for="requiredMinimum">{{
            'accountOverviewForm.requiredMinimum' | translate
          }}</label>
          <p-inputnumber
            id="requiredMinimum"
            data-testid="account-overview-form-required-minimum"
            formControlName="requiredMinimum"
            mode="currency"
            currency="EUR"
            [locale]="i18n.language()"
            [minFractionDigits]="0"
            [maxFractionDigits]="0"
            [placeholder]="'accountOverviewForm.requiredMinimumPlaceholder' | translate"
          />
          @if (form.controls.requiredMinimum.invalid && form.controls.requiredMinimum.touched) {
            <p-message
              severity="error"
              data-testid="account-overview-form-required-minimum-error"
              >{{ 'accountOverviewForm.requiredMinimumInvalid' | translate }}</p-message
            >
          }
        </div>
      </div>

      @if (isCreditCard()) {
        <div class="field-row">
          <div class="field">
            <label for="cardNumber">{{ 'accountOverviewForm.cardNumber' | translate }}</label>
            <input
              id="cardNumber"
              type="text"
              pInputText
              data-testid="account-overview-form-card-number"
              formControlName="cardNumber"
              autocomplete="off"
              (input)="onCardNumberInput($event)"
              [placeholder]="'accountOverviewForm.cardNumberPlaceholder' | translate"
            />
            @if (form.controls.cardNumber.invalid && form.controls.cardNumber.touched) {
              <p-message severity="error" data-testid="account-overview-form-card-number-error">{{
                'accountOverviewForm.cardNumberInvalid' | translate
              }}</p-message>
            }
          </div>

          <div class="field">
            <label for="validUntil">{{ 'accountOverviewForm.validUntil' | translate }}</label>
            <input
              id="validUntil"
              type="text"
              pInputText
              data-testid="account-overview-form-valid-until"
              formControlName="validUntil"
              (input)="onValidUntilInput($event)"
              placeholder="MM/YY"
            />
            @if (form.controls.validUntil.invalid && form.controls.validUntil.touched) {
              <p-message severity="error" data-testid="account-overview-form-valid-until-error">{{
                'accountOverviewForm.validUntilInvalid' | translate
              }}</p-message>
            }
          </div>
        </div>
      }

      <div class="field field--full">
        <label for="cardUsage">{{ 'accountOverviewForm.cardUsage' | translate }}</label>
        <textarea
          id="cardUsage"
          pTextarea
          rows="2"
          formControlName="cardUsage"
          [placeholder]="'accountOverviewForm.cardUsagePlaceholder' | translate"
        ></textarea>
      </div>

      <div class="field field--full">
        <label for="notes">{{ 'accountOverviewForm.notes' | translate }}</label>
        <textarea
          id="notes"
          pTextarea
          rows="3"
          formControlName="notes"
          [placeholder]="'accountOverviewForm.notesPlaceholder' | translate"
        ></textarea>
      </div>

      @if (submitError(); as message) {
        <p-message severity="error">{{ message }}</p-message>
      }

      <div class="form-actions">
        <button
          pButton
          data-testid="account-overview-form-cancel"
          type="button"
          severity="secondary"
          (click)="cancel()"
        >
          {{ 'common.cancel' | translate }}
        </button>
        <button
          pButton
          data-testid="account-overview-form-save"
          type="submit"
          [disabled]="form.invalid"
          [loading]="submitting()"
        >
          {{ 'common.save' | translate }}
        </button>
      </div>
    </form>
  `,
  styles: `
    .account-form {
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

    .field--full textarea {
      width: 100%;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }
  `,
})
export class AccountOverviewFormComponent implements OnChanges {
  /** `null` in add mode; the account being edited in edit mode. */
  @Input() account: AccountOverviewEntry | null = null;
  @Output() saved = new EventEmitter<AccountOverviewEntry>();
  @Output() cancelled = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly accountOverviewService = inject(AccountOverviewService);
  private readonly translate = inject(TranslatePipe);
  /** Drives p-inputnumber's [locale] input for `requiredMinimum` — see `HoldingFormComponent`'s
   *  identical note: without it PrimeNG falls back to the browser's OS locale instead of the
   *  app's own language setting. */
  protected readonly i18n = inject(I18nService);

  protected readonly categoryOptions: CategoryOption[] = ACCOUNT_CATEGORIES.map((value) => ({
    value,
    labelKey: `accountCategory.${value}`,
  }));
  protected readonly statusOptions: StatusOption[] = ACCOUNT_STATUSES.map((value) => ({
    value,
    labelKey: `accountStatus.${value}`,
  }));
  protected readonly submitError = signal<string | null>(null);
  protected readonly submitting = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    name: this.fb.nonNullable.control('', Validators.required),
    category: this.fb.nonNullable.control<AccountCategory>('OTHER'),
    status: this.fb.nonNullable.control<AccountStatus>('ACTIVE'),
    provider: this.fb.control<string | null>(null),
    website: this.fb.control<string | null>(null, [urlValidator()]),
    purpose: this.fb.control<string | null>(null),
    cardUsage: this.fb.control<string | null>(null),
    requiredMinimum: this.fb.control<number | null>(null, [nonNegativeNumberValidator()]),
    notes: this.fb.control<string | null>(null),
    cardNumber: this.fb.control<string | null>(null, [Validators.pattern(/^[0-9 -]{12,23}$/)]),
    validUntil: this.fb.control<string | null>(null, [
      Validators.pattern(/^(0[1-9]|1[0-2])\/\d{2}$/),
    ]),
  });

  /** Drives showing the card-number/valid-until fields only for a `CREDIT_CARD` account. */
  private readonly selectedCategory = toSignal(this.form.controls.category.valueChanges, {
    initialValue: this.form.controls.category.value,
  });
  protected readonly isCreditCard = computed(() => this.selectedCategory() === 'CREDIT_CARD');

  get isEditMode(): boolean {
    return this.account != null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('account' in changes) {
      this.submitError.set(null);
      if (this.account) {
        this.form.reset({
          name: this.account.name,
          category: this.account.category,
          status: this.account.status,
          provider: this.account.provider,
          website: this.account.website,
          purpose: this.account.purpose,
          cardUsage: this.account.cardUsage,
          requiredMinimum: parseRequiredMinimum(this.account.requiredMinimum),
          notes: this.account.notes,
          cardNumber: this.account.cardNumber,
          validUntil: this.account.validUntil,
        });
      } else {
        this.form.reset({ name: '', category: 'OTHER', status: 'ACTIVE' });
      }
    }
  }

  protected labelFor(category: AccountCategory): string {
    return this.translate.transform(`accountCategory.${category}`);
  }

  protected statusLabelFor(status: AccountStatus): string {
    return this.translate.transform(`accountStatus.${status}`);
  }

  /** Re-groups digits into blocks of 4 as the user types (`4111 1111 1111 1111`). */
  protected onCardNumberInput(event: Event): void {
    const formatted = formatCardNumberInput((event.target as HTMLInputElement).value);
    this.form.controls.cardNumber.setValue(formatted);
  }

  /** Inserts the `MM/YY` slash after the month as the user types. */
  protected onValidUntilInput(event: Event): void {
    const formatted = formatExpirationInput((event.target as HTMLInputElement).value);
    this.form.controls.validUntil.setValue(formatted);
  }

  protected submit(): void {
    this.submitError.set(null);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    const raw = this.form.getRawValue();
    const body: CreateAccountOverviewEntryRequest | UpdateAccountOverviewEntryRequest = {
      name: raw.name,
      category: raw.category,
      status: raw.status,
      provider: raw.provider ?? undefined,
      website: raw.website ?? undefined,
      purpose: raw.purpose ?? undefined,
      cardUsage: raw.cardUsage ?? undefined,
      requiredMinimum: toRequiredMinimumString(raw.requiredMinimum),
      notes: raw.notes ?? undefined,
      cardNumber: raw.cardNumber ?? undefined,
      validUntil: raw.validUntil ?? undefined,
    };
    this.submitting.set(true);

    const request$ = this.isEditMode
      ? this.accountOverviewService.update(this.account!.id, body)
      : this.accountOverviewService.create(body as CreateAccountOverviewEntryRequest);

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

  private extractServerErrors(error: unknown): string {
    const httpError = error as { error?: { fieldErrors?: { field: string; message: string }[] } };
    const fieldErrors = httpError.error?.fieldErrors;
    if (fieldErrors && fieldErrors.length > 0) {
      return fieldErrors.map((fieldError) => fieldError.message).join(' ');
    }
    return 'Unable to save this account. Please try again.';
  }
}
