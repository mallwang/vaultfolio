import Decimal from 'decimal.js';
import { ASSET_TYPE_FIELDS, isAssetType, type AssetType, type HoldingField } from './asset-type.js';

/**
 * Raw create/update payload as it arrives at the domain boundary — decimal
 * fields as strings (matching contracts/holdings-api.md's wire format so
 * precision is never lost to JSON's floating-point representation before
 * reaching `Decimal`), dates as ISO `YYYY-MM-DD` strings. Fields not
 * applicable to `assetType` should be omitted by a well-behaved client, but a
 * defensive server rejects them if present (FR-008, Edge Cases).
 */
export interface HoldingSubmission {
  assetType: AssetType;
  management: string;
  quantity?: string | null;
  purchasePrice?: string | null;
  purchaseDate?: string | null;
  isin?: string | null;
  name?: string | null;
  weightGrams?: string | null;
  currentValue?: string | null;
}

export interface FieldError {
  field: string;
  message: string;
}

/** The same submission, parsed into exact domain types once validation passes. */
export interface ValidatedHolding {
  assetType: AssetType;
  management: string;
  quantity: Decimal | null;
  purchasePrice: Decimal | null;
  purchaseDate: Date | null;
  isin: string | null;
  name: string | null;
  weightGrams: Decimal | null;
  currentValue: Decimal | null;
}

export type ValidationResult =
  { valid: true; value: ValidatedHolding } | { valid: false; fieldErrors: FieldError[] };

const DECIMAL_FIELDS = ['quantity', 'purchasePrice', 'weightGrams', 'currentValue'] as const;

/**
 * Standard ISIN checksum: a 2-letter ISO 3166-1 country code, 9 further
 * alphanumeric characters, and a 1-digit mod-10 (Luhn) check digit computed
 * over the numeric expansion of the first 11 characters (each letter A–Z
 * expands to its 1-based-from-10 two-digit value, i.e. A=10 ... Z=35), per
 * spec.md's Assumptions. Pure, no I/O — research.md #1.
 */
export function isValidIsin(isin: string): boolean {
  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) {
    return false;
  }

  const expanded = isin
    .split('')
    .map((char) => (/[0-9]/.test(char) ? char : String(char.charCodeAt(0) - 55)))
    .join('');

  // Luhn algorithm over the expanded digit string, processed right-to-left.
  let sum = 0;
  let doubleDigit = false;
  for (let i = expanded.length - 1; i >= 0; i--) {
    let digit = Number(expanded[i]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }

  return sum % 10 === 0;
}

function isBlank(value: string | null | undefined): boolean {
  return value == null || value.trim() === '';
}

function parsePositiveDecimal(
  field: HoldingField,
  raw: string | null | undefined,
  errors: FieldError[],
): Decimal | null {
  if (raw == null || raw === '') {
    return null;
  }
  let decimal: Decimal;
  try {
    decimal = new Decimal(raw);
  } catch {
    errors.push({ field, message: `${field} must be a valid number.` });
    return null;
  }
  // currentValue's floor is 0 (an emptied deposit-money balance is valid);
  // every other decimal field (quantity, purchasePrice, weightGrams) keeps
  // the strict > 0 floor.
  const minimum = field === 'currentValue' ? 0 : undefined;
  if (!decimal.isFinite() || (minimum === 0 ? decimal.lessThan(0) : decimal.lessThanOrEqualTo(0))) {
    const message =
      field === 'currentValue'
        ? `${field} must be a non-negative number.`
        : `${field} must be a positive number.`;
    errors.push({ field, message });
    return null;
  }
  return decimal;
}

function isFieldApplicable(assetType: AssetType, field: HoldingField): boolean {
  const metadata = ASSET_TYPE_FIELDS[assetType];
  return metadata.required.includes(field) || metadata.optional.includes(field);
}

/**
 * Validates a raw submission against every rule in data-model.md's
 * "Validation rules" section, reporting every failing field at once (SC-002)
 * rather than stopping at the first. The single source of truth for "what
 * makes a Holding valid" — consumed by the REST layer, and reusable by any
 * future import path (research.md #2).
 */
export function validateHoldingSubmission(submission: HoldingSubmission): ValidationResult {
  const errors: FieldError[] = [];
  const { assetType } = submission;

  // A client-supplied assetType is only a compile-time AssetType at the
  // TypeScript boundary — at runtime (e.g. a stale client sending the
  // pre-017 'GOLD'/'BITCOIN' literals) it may be any string. Reject early
  // rather than let `ASSET_TYPE_FIELDS[assetType]` come back `undefined` and
  // crash every check below (FR-011).
  if (!isAssetType(assetType)) {
    return {
      valid: false,
      fieldErrors: [
        { field: 'assetType', message: `${String(assetType)} is not a recognized asset type.` },
      ],
    };
  }

  const metadata = ASSET_TYPE_FIELDS[assetType];

  if (isBlank(submission.management)) {
    errors.push({ field: 'management', message: 'Management is required.' });
  }

  // Parse every decimal field present, positivity-checked regardless of
  // whether it turns out to be applicable — a stray field still gets a
  // useful error rather than being silently accepted.
  const parsed: Record<(typeof DECIMAL_FIELDS)[number], Decimal | null> = {
    quantity: parsePositiveDecimal('quantity', submission.quantity, errors),
    purchasePrice: parsePositiveDecimal('purchasePrice', submission.purchasePrice, errors),
    weightGrams: parsePositiveDecimal('weightGrams', submission.weightGrams, errors),
    currentValue: parsePositiveDecimal('currentValue', submission.currentValue, errors),
  };

  // Required-field presence for this asset type.
  for (const field of metadata.required) {
    if (field === 'isin' || field === 'name') {
      if (isBlank(submission[field])) {
        errors.push({ field, message: `${field} is required for ${assetType}.` });
      }
    } else if (
      field === 'quantity' ||
      field === 'purchasePrice' ||
      field === 'weightGrams' ||
      field === 'currentValue'
    ) {
      if (parsed[field] == null && isBlank(submission[field])) {
        errors.push({ field, message: `${field} is required for ${assetType}.` });
      }
    }
  }

  // Extraneous fields not applicable to this asset type must not be present
  // (FR-008, Edge Cases) — a defensive server rejects them rather than
  // silently storing them.
  const allFields: HoldingField[] = [
    'isin',
    'name',
    'quantity',
    'purchasePrice',
    'purchaseDate',
    'weightGrams',
    'currentValue',
  ];
  for (const field of allFields) {
    if (isFieldApplicable(assetType, field)) {
      continue;
    }
    const raw = submission[field];
    if (raw != null && raw !== '') {
      errors.push({
        field,
        message: `${field} does not apply to ${assetType} and must be omitted.`,
      });
    }
  }

  // ISIN checksum, only when isin is applicable and present.
  let isin: string | null = null;
  if (isFieldApplicable(assetType, 'isin') && !isBlank(submission.isin)) {
    isin = submission.isin as string;
    if (!isValidIsin(isin)) {
      errors.push({ field: 'isin', message: 'isin is not a well-formed ISIN.' });
    }
  }

  // purchaseDate: only meaningful when applicable to this type; never in the future.
  let purchaseDate: Date | null = null;
  if (isFieldApplicable(assetType, 'purchaseDate') && !isBlank(submission.purchaseDate)) {
    const candidate = new Date(submission.purchaseDate as string);
    if (Number.isNaN(candidate.getTime())) {
      errors.push({ field: 'purchaseDate', message: 'purchaseDate must be a valid date.' });
    } else {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (candidate.getTime() > today.getTime()) {
        errors.push({ field: 'purchaseDate', message: 'purchaseDate must not be in the future.' });
      } else {
        purchaseDate = candidate;
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, fieldErrors: errors };
  }

  return {
    valid: true,
    value: {
      assetType,
      management: submission.management.trim(),
      quantity: isFieldApplicable(assetType, 'quantity') ? parsed.quantity : null,
      purchasePrice: isFieldApplicable(assetType, 'purchasePrice') ? parsed.purchasePrice : null,
      purchaseDate,
      isin,
      name:
        isFieldApplicable(assetType, 'name') && !isBlank(submission.name)
          ? (submission.name as string).trim()
          : null,
      weightGrams: isFieldApplicable(assetType, 'weightGrams') ? parsed.weightGrams : null,
      currentValue: isFieldApplicable(assetType, 'currentValue') ? parsed.currentValue : null,
    },
  };
}
