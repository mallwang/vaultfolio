import { isAccountCategory } from './account-category.js';
import type { AccountCategory } from './account-category.js';

/**
 * Raw create/update payload as it arrives at the domain boundary, mirroring
 * `holding-validation.ts`'s `HoldingSubmission` shape. `category` is optional
 * — omitted (or `undefined`) defaults to `'OTHER'` (FR-007/FR-008).
 */
export interface AccountSubmission {
  name: string;
  category?: AccountCategory;
  provider?: string | null;
  website?: string | null;
  purpose?: string | null;
  cardUsage?: string | null;
  requiredMinimum?: string | null;
  notes?: string | null;
}

export interface FieldError {
  field: string;
  message: string;
}

/** The same submission, validated and every optional string trimmed/null-normalized. */
export interface ValidatedAccount {
  name: string;
  category: AccountCategory;
  provider: string | null;
  website: string | null;
  purpose: string | null;
  cardUsage: string | null;
  requiredMinimum: string | null;
  notes: string | null;
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

  if (errors.length > 0) {
    return { valid: false, fieldErrors: errors };
  }

  return {
    valid: true,
    value: {
      name: submission.name.trim(),
      category,
      provider: trimToNullable(submission.provider),
      website: trimToNullable(submission.website),
      purpose: trimToNullable(submission.purpose),
      cardUsage: trimToNullable(submission.cardUsage),
      requiredMinimum: trimToNullable(submission.requiredMinimum),
      notes: trimToNullable(submission.notes),
    },
  };
}
