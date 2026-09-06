import { isAccountCategory } from './account-category.js';
import type { AccountCategory } from './account-category.js';
import { isAccountStatus } from './account-status.js';
import type { AccountStatus } from './account-status.js';

/**
 * Raw create/update payload as it arrives at the domain boundary, mirroring
 * `holding-validation.ts`'s `HoldingSubmission` shape. `category` is optional
 * — omitted (or `undefined`) defaults to `'OTHER'` (FR-007/FR-008).
 */
export interface AccountSubmission {
  name: string;
  category?: AccountCategory;
  /** Omitted (or `undefined`) defaults to `'ACTIVE'`. */
  status?: AccountStatus;
  provider?: string | null;
  website?: string | null;
  purpose?: string | null;
  cardUsage?: string | null;
  requiredMinimum?: string | null;
  notes?: string | null;
  /** Digits plus optional spaces/dashes; 12-19 digits once those are stripped (common PAN range). */
  cardNumber?: string | null;
  /** `MM/YY`, e.g. `09/28`. */
  validUntil?: string | null;
}

export interface FieldError {
  field: string;
  message: string;
}

/** The same submission, validated and every optional string trimmed/null-normalized. */
export interface ValidatedAccount {
  name: string;
  category: AccountCategory;
  status: AccountStatus;
  provider: string | null;
  website: string | null;
  purpose: string | null;
  cardUsage: string | null;
  requiredMinimum: string | null;
  notes: string | null;
  cardNumber: string | null;
  validUntil: string | null;
}

export type ValidationResult =
  { valid: true; value: ValidatedAccount } | { valid: false; fieldErrors: FieldError[] };

function isBlank(value: string | null | undefined): boolean {
  return value == null || value.trim() === '';
}

/** Trims a value; an empty string after trimming normalizes to `null` (data-model.md's rule). */
function trimToNullable(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Validates a raw submission against every rule in data-model.md's
 * "Validation rules" section: `name` is the only required field (FR-006);
 * `category`, if present, must be one of the five known literals (a
 * defensive server-side check — a well-behaved client only ever sends a
 * known literal or omits the field); every other optional field is stored
 * exactly as submitted, trimmed and null-normalized. Mirrors
 * `holding-validation.ts`'s `validateHoldingSubmission` shape.
 */
export function validateAccountSubmission(submission: AccountSubmission): ValidationResult {
  const errors: FieldError[] = [];

  if (isBlank(submission.name)) {
    errors.push({ field: 'name', message: 'Name is required.' });
  }

  let category: AccountCategory = 'OTHER';
  if (submission.category != null) {
    if (!isAccountCategory(submission.category)) {
      errors.push({
        field: 'category',
        message: `${String(submission.category)} is not a recognized category.`,
      });
    } else {
      category = submission.category;
    }
  }

  let status: AccountStatus = 'ACTIVE';
  if (submission.status != null) {
    if (!isAccountStatus(submission.status)) {
      errors.push({
        field: 'status',
        message: `${String(submission.status)} is not a recognized status.`,
      });
    } else {
      status = submission.status;
    }
  }

  const cardNumber = trimToNullable(submission.cardNumber);
  if (cardNumber != null) {
    const digitCount = cardNumber.replace(/\D/g, '').length;
    if (!/^[0-9 -]+$/.test(cardNumber) || digitCount < 12 || digitCount > 19) {
      errors.push({
        field: 'cardNumber',
        message: 'Card number must be 12-19 digits (spaces/dashes allowed).',
      });
    }
  }

  const validUntil = trimToNullable(submission.validUntil);
  if (validUntil != null && !/^(0[1-9]|1[0-2])\/\d{2}$/.test(validUntil)) {
    errors.push({ field: 'validUntil', message: 'Valid until must be in MM/YY format.' });
  }

  if (errors.length > 0) {
    return { valid: false, fieldErrors: errors };
  }

  return {
    valid: true,
    value: {
      name: submission.name.trim(),
      category,
      status,
      provider: trimToNullable(submission.provider),
      website: trimToNullable(submission.website),
      purpose: trimToNullable(submission.purpose),
      cardUsage: trimToNullable(submission.cardUsage),
      requiredMinimum: trimToNullable(submission.requiredMinimum),
      notes: trimToNullable(submission.notes),
      cardNumber,
      validUntil,
    },
  };
}
