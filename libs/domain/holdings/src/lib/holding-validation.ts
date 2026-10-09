import Decimal from 'decimal.js';
import {
  ALL_HOLDING_FIELDS,
  ASSET_TYPE_FIELDS,
  isAssetType,
  type AssetType,
  type HoldingField,
} from './asset-type.js';
import { findCoin } from './crypto-catalog.js';
import { findMetal, type MetalCode } from './metal-catalog.js';
import { HOLDING_UNITS, type HoldingUnit } from './units.js';

export const NOTE_MAX_LENGTH = 500;
export const CRYPTO_QUANTITY_MAX_DECIMALS = 8;

/** Machine-readable validation codes; the frontend maps each to a de/en message. */
export type HoldingErrorCode =
  | 'REQUIRED'
  | 'ISIN_INVALID'
  | 'ISIN_NOT_ALLOWED'
  | 'METAL_UNKNOWN'
  | 'COIN_UNKNOWN'
  | 'UNIT_INVALID'
  | 'QUANTITY_NOT_POSITIVE'
  | 'QUANTITY_DECIMALS'
  | 'NOTE_TOO_LONG'
  | 'DECIMAL_INVALID'
  | 'FIELD_NOT_ALLOWED';

/**
 * Raw create/update payload at the domain boundary: decimals as strings
 * (JSON floats would lose precision), dates as `YYYY-MM-DD`. Fields not
 * applicable to `assetType` are rejected if present.
 */
export interface HoldingSubmission {
  assetType: AssetType;
  management: string;
  note?: string | null;
  isin?: string | null;
  name?: string | null;
  metal?: string | null;
  unit?: string | null;
  coinId?: string | null;
  quantity?: string | null;
  purchasePrice?: string | null;
  currentValue?: string | null;
}

export interface FieldError {
  field: string;
  code: HoldingErrorCode;
}

/** The same submission, parsed into exact domain types once validation passes. */
export interface ValidatedHolding {
  assetType: AssetType;
  management: string;
  note: string | null;
  isin: string | null;
  name: string | null;
  metal: MetalCode | null;
  unit: HoldingUnit | null;
  coinId: string | null;
  quantity: Decimal | null;
  purchasePrice: Decimal | null;
  currentValue: Decimal | null;
}

export type ValidationResult =
  { valid: true; value: ValidatedHolding } | { valid: false; fieldErrors: FieldError[] };

/**
 * Standard ISIN checksum: a 2-letter ISO 3166-1 country code, 9 further
 * alphanumeric characters, and a 1-digit mod-10 (Luhn) check digit computed
 * over the numeric expansion of the first 11 characters (each letter A–Z
 * expands to its 1-based-from-10 two-digit value, i.e. A=10 ... Z=35), per
 * spec.md's Assumptions. Pure, no I/O — research.md #1.
 */
export function isValidIsin(isin: string): boolean {
  if (!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin)) {
    return false;
  }

  const expanded = isin
    .split('')
    .map((char) => (/\d/.test(char) ? char : String((char.codePointAt(0) as number) - 55)))
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

function isApplicable(assetType: AssetType, field: HoldingField): boolean {
  const metadata = ASSET_TYPE_FIELDS[assetType];
  return metadata.required.includes(field) || metadata.optional.includes(field);
}

/** Parses an applicable decimal field; `null` when absent or invalid (error recorded). */
function parseDecimal(
  field: 'quantity' | 'purchasePrice' | 'currentValue',
  raw: string | null | undefined,
  errors: FieldError[],
): Decimal | null {
  if (isBlank(raw)) return null;
  let decimal: Decimal;
  try {
    decimal = new Decimal((raw as string).trim());
  } catch {
    errors.push({ field, code: 'DECIMAL_INVALID' });
    return null;
  }
  if (!decimal.isFinite()) {
    errors.push({ field, code: 'DECIMAL_INVALID' });
    return null;
  }
  // currentValue may be 0 (an emptied deposit); everything else must be > 0.
  const bad = field === 'currentValue' ? decimal.isNegative() : decimal.lessThanOrEqualTo(0);
  if (bad) {
    errors.push({
      field,
      code: field === 'quantity' ? 'QUANTITY_NOT_POSITIVE' : 'DECIMAL_INVALID',
    });
    return null;
  }
  return decimal;
}

function has(submission: HoldingSubmission, field: HoldingField): boolean {
  return isApplicable(submission.assetType, field) && !isBlank(submission[field]);
}

/** Management, fields not listed for the type, and required presence. */
function validateStructure(submission: HoldingSubmission, errors: FieldError[]): void {
  const { assetType } = submission;
  if (isBlank(submission.management)) {
    errors.push({ field: 'management', code: 'REQUIRED' });
  }
  for (const field of ALL_HOLDING_FIELDS) {
    if (isApplicable(assetType, field)) continue;
    const raw = submission[field];
    if (raw != null && raw !== '') {
      errors.push({ field, code: field === 'isin' ? 'ISIN_NOT_ALLOWED' : 'FIELD_NOT_ALLOWED' });
    }
  }
  for (const field of ASSET_TYPE_FIELDS[assetType].required) {
    if (isBlank(submission[field])) errors.push({ field, code: 'REQUIRED' });
  }
}

type Identity = Pick<ValidatedHolding, 'isin' | 'metal' | 'unit' | 'coinId'>;

/** ISIN checksum and catalogue/unit membership (value checks only when present). */
function validateIdentity(submission: HoldingSubmission, errors: FieldError[]): Identity {
  const result: Identity = { isin: null, metal: null, unit: null, coinId: null };
  if (has(submission, 'isin')) {
    result.isin = submission.isin as string;
    if (!isValidIsin(result.isin)) errors.push({ field: 'isin', code: 'ISIN_INVALID' });
  }
  if (has(submission, 'metal')) {
    const entry = findMetal(submission.metal as string);
    if (entry) result.metal = entry.code;
    else errors.push({ field: 'metal', code: 'METAL_UNKNOWN' });
  }
  if (has(submission, 'unit')) {
    if ((HOLDING_UNITS as readonly string[]).includes(submission.unit as string)) {
      result.unit = submission.unit as HoldingUnit;
    } else {
      errors.push({ field: 'unit', code: 'UNIT_INVALID' });
    }
  }
  if (has(submission, 'coinId')) {
    if (findCoin(submission.coinId as string)) result.coinId = submission.coinId as string;
    else errors.push({ field: 'coinId', code: 'COIN_UNKNOWN' });
  }
  return result;
}

type Amounts = Pick<ValidatedHolding, 'quantity' | 'purchasePrice' | 'currentValue'>;

function validateAmounts(submission: HoldingSubmission, errors: FieldError[]): Amounts {
  const { assetType } = submission;
  const decimal = (field: 'quantity' | 'purchasePrice' | 'currentValue'): Decimal | null =>
    isApplicable(assetType, field) ? parseDecimal(field, submission[field], errors) : null;
  const quantity = decimal('quantity');
  if (
    quantity &&
    assetType === 'CRYPTO' &&
    quantity.decimalPlaces() > CRYPTO_QUANTITY_MAX_DECIMALS
  ) {
    errors.push({ field: 'quantity', code: 'QUANTITY_DECIMALS' });
  }
  return {
    quantity,
    purchasePrice: decimal('purchasePrice'),
    currentValue: decimal('currentValue'),
  };
}

/**
 * Validates a raw submission, reporting every failing field at once. The single
 * source of truth for "what makes a Holding valid" (server and form, FR-018).
 */
export function validateHoldingSubmission(submission: HoldingSubmission): ValidationResult {
  // At runtime a stale client may send any string as assetType.
  if (!isAssetType(submission.assetType)) {
    return { valid: false, fieldErrors: [{ field: 'assetType', code: 'REQUIRED' }] };
  }

  const errors: FieldError[] = [];
  validateStructure(submission, errors);
  const identity = validateIdentity(submission, errors);
  const amounts = validateAmounts(submission, errors);

  // Count code points, not UTF-16 units, so an emoji is one character.
  const note = submission.note ?? '';
  if (Array.from(note).length > NOTE_MAX_LENGTH) {
    errors.push({ field: 'note', code: 'NOTE_TOO_LONG' });
  }

  if (errors.length > 0) {
    return { valid: false, fieldErrors: errors };
  }

  return {
    valid: true,
    value: {
      assetType: submission.assetType,
      management: submission.management.trim(),
      note: isBlank(note) ? null : note,
      name: has(submission, 'name') ? (submission.name as string).trim() : null,
      ...identity,
      ...amounts,
    },
  };
}
