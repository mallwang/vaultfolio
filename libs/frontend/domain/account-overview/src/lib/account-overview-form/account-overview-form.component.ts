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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type {
  AccountCategory,
  AccountOverviewEntry,
  CreateAccountOverviewEntryRequest,
  UpdateAccountOverviewEntryRequest,
} from '@vaultfolio/api-contract';
import { ACCOUNT_CATEGORIES } from '../account-category-options';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { AccountOverviewService } from '../account-overview.service';

/** Category `p-select` option, label resolved through the translate pipe (design.md's fixed order). */
interface CategoryOption {
  value: AccountCategory;
  labelKey: string;
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

      <div class="field">
        <label for="website">{{ 'accountOverviewForm.website' | translate }}</label>
        <input
          id="website"
          type="text"
          pInputText
          formControlName="website"
          [placeholder]="'accountOverviewForm.websitePlaceholder' | translate"
        />
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

      <div class="field">
        <label for="cardUsage">{{ 'accountOverviewForm.cardUsage' | translate }}</label>
        <input
          id="cardUsage"
          type="text"
          pInputText
          formControlName="cardUsage"
          [placeholder]="'accountOverviewForm.cardUsagePlaceholder' | translate"
        />
      </div>

      <div class="field">
        <label for="requiredMinimum">{{ 'accountOverviewForm.requiredMinimum' | translate }}</label>
        <input
          id="requiredMinimum"
          type="text"
          pInputText
          formControlName="requiredMinimum"
          [placeholder]="'accountOverviewForm.requiredMinimumPlaceholder' | translate"
        />
      </div>

      <div class="field">
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

  protected readonly categoryOptions: CategoryOption[] = ACCOUNT_CATEGORIES.map((value) => ({
    value,
    labelKey: `accountCategory.${value}`,
  }));
  protected readonly submitError = signal<string | null>(null);
  protected readonly submitting = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    name: this.fb.nonNullable.control('', Validators.required),
    category: this.fb.nonNullable.control<AccountCategory>('OTHER'),
    provider: this.fb.control<string | null>(null),
    website: this.fb.control<string | null>(null),
    purpose: this.fb.control<string | null>(null),
    cardUsage: this.fb.control<string | null>(null),
    requiredMinimum: this.fb.control<string | null>(null),
    notes: this.fb.control<string | null>(null),
  });

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
          provider: this.account.provider,
          website: this.account.website,
          purpose: this.account.purpose,
          cardUsage: this.account.cardUsage,
          requiredMinimum: this.account.requiredMinimum,
          notes: this.account.notes,
        });
      } else {
        this.form.reset({ name: '', category: 'OTHER' });
      }
    }
  }

  protected labelFor(category: AccountCategory): string {
    return this.translate.transform(`accountCategory.${category}`);
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
      provider: raw.provider ?? undefined,
      website: raw.website ?? undefined,
      purpose: raw.purpose ?? undefined,
      cardUsage: raw.cardUsage ?? undefined,
      requiredMinimum: raw.requiredMinimum ?? undefined,
      notes: raw.notes ?? undefined,
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
