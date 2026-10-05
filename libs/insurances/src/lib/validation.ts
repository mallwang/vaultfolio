import Decimal from 'decimal.js';
import { isInsuranceTypeId, isRequirementId, isSocialType, typeDef } from './catalog';
import { isRealDate } from './dates';
import {
  type CancellationSettings,
  type Contract,
  type ContractDetails,
  type Employment,
  type InsuranceTypeId,
  MAX_AMOUNT,
  type Profile,
  type RequirementId,
  type Settings,
} from './model';

export type ValidationCode =
  'REQUIRED' | 'INVALID' | 'UNKNOWN_FIELD' | 'OUT_OF_RANGE' | 'DATE_ORDER' | 'LIMIT';

/** One problem, naming the field path only — never the offending value (log/response safe). */
export interface ValidationIssue {
  field: string;
  code: ValidationCode;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; issues: ValidationIssue[] };

type Obj = Record<string, unknown>;
type Issues = ValidationIssue[];

const CONTRACT_FIELDS = new Set([
  'type',
  'alsoCovers',
  'name',
  'insurer',
  'contractNumber',
  'status',
  'startDate',
  'endDate',
  'premium',
  'interval',
  'paymentMonth',
  'cancellation',
  'reminderEnabled',
  'details',
  'note',
]);
const CANCELLATION_FIELDS = new Set([
  'period',
  'autoRenew',
  'renewalMonths',
  'minimumTermMonths',
  'fixedDate',
]);
const PERIOD_FIELDS = new Set(['value', 'unit']);
const FIXED_DATE_FIELDS = new Set(['day', 'month']);
const MONEY_DETAILS = new Set<string>([
  'coverageSum',
  'deductible',
  'insuredMonthlyBenefit',
  'insuredSum',
]);
const DETAIL_FIELDS = new Set<string>([...MONEY_DETAILS, 'licensePlate', 'noClaimsClass']);
const SETTINGS_FIELDS = new Set(['profile', 'reminders', 'dismissedRequirements', 'includeSocial']);
const PROFILE_FIELDS = new Set([
  'ownsProperty',
  'ownsCar',
  'hasChildren',
  'hasPets',
  'travelsAbroad',
  'employment',
]);
const PROFILE_FLAGS = [
  'ownsProperty',
  'ownsCar',
  'hasChildren',
  'hasPets',
  'travelsAbroad',
] as const;
const REMINDER_FIELDS = new Set(['enabled', 'leadDays']);
const STATUSES = ['ACTIVE', 'CANCELLED', 'ENDED'];
const INTERVALS = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'];
const EMPLOYMENTS: Employment[] = ['EMPLOYED', 'SELF_EMPLOYED', 'CIVIL_SERVANT', 'OTHER'];
const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function normalizeMoney(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!AMOUNT_PATTERN.test(trimmed)) return null;
  const value = new Decimal(trimmed);
  return value.gt(MAX_AMOUNT) ? null : value.toFixed(2);
}

function isRecord(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rejectUnknown(obj: Obj, allowed: Set<string>, path: string, issues: Issues) {
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key))
      issues.push({ field: path ? `${path}.${key}` : key, code: 'UNKNOWN_FIELD' });
  }
}

function text(
  obj: Obj,
  key: string,
  max: number,
  required: boolean,
  issues: Issues,
  path = key,
): string | undefined {
  const raw = obj[key];
  const trimmed = typeof raw === 'string' ? raw.trim() : undefined;
  if (raw !== undefined && trimmed === undefined) {
    issues.push({ field: path, code: 'INVALID' });
  } else if (!trimmed) {
    if (required) issues.push({ field: path, code: 'REQUIRED' });
  } else if (trimmed.length > max) {
    issues.push({ field: path, code: 'OUT_OF_RANGE' });
  } else {
    return trimmed;
  }
  return undefined;
}

function integer(
  raw: unknown,
  min: number,
  max: number,
  path: string,
  issues: Issues,
): number | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'number' || !Number.isInteger(raw)) {
    issues.push({ field: path, code: 'INVALID' });
    return undefined;
  }
  if (raw < min || raw > max) {
    issues.push({ field: path, code: 'OUT_OF_RANGE' });
    return undefined;
  }
  return raw;
}

function date(obj: Obj, key: string, required: boolean, issues: Issues): string | undefined {
  const raw = obj[key];
  if (raw === undefined) {
    if (required) issues.push({ field: key, code: 'REQUIRED' });
    return undefined;
  }
  if (typeof raw !== 'string' || !isRealDate(raw)) {
    issues.push({ field: key, code: 'INVALID' });
    return undefined;
  }
  return raw;
}

function bool(raw: unknown, path: string, issues: Issues): boolean | undefined {
  if (raw === undefined) {
    issues.push({ field: path, code: 'REQUIRED' });
    return undefined;
  }
  if (typeof raw !== 'boolean') {
    issues.push({ field: path, code: 'INVALID' });
    return undefined;
  }
  return raw;
}

/** An enum-like string field: required, one of `allowed`. */
function choice<T extends string>(
  obj: Obj,
  key: string,
  allowed: readonly string[],
  issues: Issues,
  path = key,
): T | undefined {
  const raw = obj[key];
  if (raw === undefined) {
    issues.push({ field: path, code: 'REQUIRED' });
    return undefined;
  }
  if (typeof raw !== 'string' || !allowed.includes(raw)) {
    issues.push({ field: path, code: 'INVALID' });
    return undefined;
  }
  return raw as T;
}

function validateDetail(
  raw: Obj,
  key: string,
  allowed: Set<string>,
  out: Record<string, string>,
  issues: Issues,
) {
  const path = `details.${key}`;
  if (!DETAIL_FIELDS.has(key) || !allowed.has(key)) {
    issues.push({ field: path, code: 'UNKNOWN_FIELD' });
  } else if (raw[key] === undefined) {
    // nothing to store
  } else if (MONEY_DETAILS.has(key)) {
    const money = normalizeMoney(raw[key]);
    if (money === null) issues.push({ field: path, code: 'INVALID' });
    else out[key] = money;
  } else {
    const str = text(raw, key, 30, false, issues, path);
    if (str !== undefined) out[key] = str;
  }
}

function validateDetails(
  raw: unknown,
  type: InsuranceTypeId | undefined,
  issues: Issues,
): ContractDetails | undefined {
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) {
    issues.push({ field: 'details', code: 'INVALID' });
    return undefined;
  }
  const allowed = new Set<string>(type ? typeDef(type).detailFields : []);
  const out: Record<string, string> = {};
  for (const key of Object.keys(raw)) validateDetail(raw, key, allowed, out, issues);
  return Object.keys(out).length > 0 ? (out as ContractDetails) : undefined;
}

function validatePeriod(raw: unknown, issues: Issues): CancellationSettings['period'] {
  if (!isRecord(raw)) {
    issues.push({ field: 'cancellation.period', code: 'INVALID' });
    return undefined;
  }
  rejectUnknown(raw, PERIOD_FIELDS, 'cancellation.period', issues);
  const value = integer(raw['value'], 0, 60, 'cancellation.period.value', issues);
  const unit = raw['unit'];
  if (unit !== 'WEEKS' && unit !== 'MONTHS') {
    issues.push({ field: 'cancellation.period.unit', code: 'INVALID' });
    return undefined;
  }
  return value === undefined ? undefined : { value, unit };
}

function validateFixedDate(raw: unknown, issues: Issues): CancellationSettings['fixedDate'] {
  if (!isRecord(raw)) {
    issues.push({ field: 'cancellation.fixedDate', code: 'INVALID' });
    return undefined;
  }
  rejectUnknown(raw, FIXED_DATE_FIELDS, 'cancellation.fixedDate', issues);
  const day = integer(raw['day'], 1, 31, 'cancellation.fixedDate.day', issues);
  const month = integer(raw['month'], 1, 12, 'cancellation.fixedDate.month', issues);
  if (day === undefined || month === undefined) return undefined;
  // Leap day allowed (29.02.), other impossible days rejected.
  if (day > DAYS_IN_MONTH[month - 1]) {
    issues.push({ field: 'cancellation.fixedDate.day', code: 'INVALID' });
    return undefined;
  }
  return { day, month };
}

function validateCancellation(raw: unknown, issues: Issues): CancellationSettings {
  const fallback: CancellationSettings = { autoRenew: false };
  if (raw === undefined) {
    issues.push({ field: 'cancellation', code: 'REQUIRED' });
    return fallback;
  }
  if (!isRecord(raw)) {
    issues.push({ field: 'cancellation', code: 'INVALID' });
    return fallback;
  }
  rejectUnknown(raw, CANCELLATION_FIELDS, 'cancellation', issues);
  const out: CancellationSettings = {
    autoRenew: bool(raw['autoRenew'], 'cancellation.autoRenew', issues) ?? false,
  };
  const period = raw['period'] === undefined ? undefined : validatePeriod(raw['period'], issues);
  if (period) out.period = period;
  const renewal = integer(raw['renewalMonths'], 1, 60, 'cancellation.renewalMonths', issues);
  if (renewal !== undefined && !out.autoRenew) {
    issues.push({ field: 'cancellation.renewalMonths', code: 'INVALID' });
  } else if (renewal !== undefined) {
    out.renewalMonths = renewal;
  }
  const minTerm = integer(
    raw['minimumTermMonths'],
    1,
    600,
    'cancellation.minimumTermMonths',
    issues,
  );
  if (minTerm !== undefined) out.minimumTermMonths = minTerm;
  const fixed =
    raw['fixedDate'] === undefined ? undefined : validateFixedDate(raw['fixedDate'], issues);
  if (fixed) out.fixedDate = fixed;
  return out;
}

function validateType(input: Obj, issues: Issues): InsuranceTypeId | undefined {
  const raw = input['type'];
  if (raw === undefined) issues.push({ field: 'type', code: 'REQUIRED' });
  else if (!isInsuranceTypeId(raw)) issues.push({ field: 'type', code: 'INVALID' });
  else return raw;
  return undefined;
}

function validateAlsoCovers(
  raw: unknown,
  type: InsuranceTypeId | undefined,
  issues: Issues,
): InsuranceTypeId[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) {
    issues.push({ field: 'alsoCovers', code: 'INVALID' });
  } else if (raw.length > 10) {
    issues.push({ field: 'alsoCovers', code: 'LIMIT' });
  } else if (
    !raw.every(isInsuranceTypeId) ||
    new Set(raw).size !== raw.length ||
    (type !== undefined && raw.includes(type))
  ) {
    issues.push({ field: 'alsoCovers', code: 'INVALID' });
  } else if (raw.length > 0) {
    return raw as InsuranceTypeId[];
  }
  return undefined;
}

function validatePremium(input: Obj, issues: Issues): string | undefined {
  if (input['premium'] === undefined) {
    issues.push({ field: 'premium', code: 'REQUIRED' });
    return undefined;
  }
  const money = normalizeMoney(input['premium']);
  if (money === null) issues.push({ field: 'premium', code: 'INVALID' });
  return money ?? undefined;
}

/** Cross-field rules that depend on the interval and the type. */
function checkIntervalRules(
  input: Obj,
  type: InsuranceTypeId | undefined,
  interval: Contract['interval'] | undefined,
  issues: Issues,
): number | undefined {
  if (type && isSocialType(type) && interval && interval !== 'MONTHLY') {
    issues.push({ field: 'interval', code: 'INVALID' });
  }
  const paymentMonth = integer(input['paymentMonth'], 1, 12, 'paymentMonth', issues);
  if (paymentMonth !== undefined && interval === 'MONTHLY') {
    issues.push({ field: 'paymentMonth', code: 'INVALID' });
  }
  return paymentMonth;
}

function optionalFields(
  input: Obj,
  issues: Issues,
): Pick<Contract, 'insurer' | 'contractNumber' | 'note'> {
  const out: Pick<Contract, 'insurer' | 'contractNumber' | 'note'> = {};
  const insurer = text(input, 'insurer', 100, false, issues);
  const contractNumber = text(input, 'contractNumber', 50, false, issues);
  const note = text(input, 'note', 500, false, issues);
  if (insurer) out.insurer = insurer;
  if (contractNumber) out.contractNumber = contractNumber;
  if (note) out.note = note;
  return out;
}

export function validateContract(input: unknown): ValidationResult<Contract> {
  if (!isRecord(input)) return { ok: false, issues: [{ field: '', code: 'INVALID' }] };
  const issues: Issues = [];
  rejectUnknown(input, CONTRACT_FIELDS, '', issues);

  const type = validateType(input, issues);
  const alsoCovers = validateAlsoCovers(input['alsoCovers'], type, issues);
  const name = text(input, 'name', 100, true, issues);
  const optional = optionalFields(input, issues);
  const status = choice<Contract['status']>(input, 'status', STATUSES, issues);
  const startDate = date(input, 'startDate', true, issues);
  const endDate = date(input, 'endDate', false, issues);
  if (startDate && endDate && endDate < startDate)
    issues.push({ field: 'endDate', code: 'DATE_ORDER' });
  const premium = validatePremium(input, issues);
  const interval = choice<Contract['interval']>(input, 'interval', INTERVALS, issues);
  const paymentMonth = checkIntervalRules(input, type, interval, issues);
  const cancellation = validateCancellation(input['cancellation'], issues);
  const reminderEnabled =
    input['reminderEnabled'] === undefined
      ? true
      : bool(input['reminderEnabled'], 'reminderEnabled', issues);
  const details = validateDetails(input['details'], type, issues);

  if (issues.length > 0 || !type || !name || !status || !startDate || !premium || !interval) {
    return { ok: false, issues };
  }
  const value: Contract = {
    ...optional,
    type,
    name,
    status,
    startDate,
    premium,
    interval,
    cancellation,
    reminderEnabled: reminderEnabled ?? true,
  };
  if (alsoCovers) value.alsoCovers = alsoCovers;
  if (endDate) value.endDate = endDate;
  if (paymentMonth !== undefined) value.paymentMonth = paymentMonth;
  if (details) value.details = details;
  return { ok: true, value };
}

function validateProfile(raw: unknown, issues: Issues): Profile {
  const profile: Profile = {
    ownsProperty: false,
    ownsCar: false,
    hasChildren: false,
    hasPets: false,
    travelsAbroad: false,
    employment: 'EMPLOYED',
  };
  if (raw === undefined) {
    issues.push({ field: 'profile', code: 'REQUIRED' });
  } else if (!isRecord(raw)) {
    issues.push({ field: 'profile', code: 'INVALID' });
  } else {
    rejectUnknown(raw, PROFILE_FIELDS, 'profile', issues);
    for (const key of PROFILE_FLAGS)
      profile[key] = bool(raw[key], `profile.${key}`, issues) ?? false;
    profile.employment =
      choice<Employment>(raw, 'employment', EMPLOYMENTS, issues, 'profile.employment') ??
      'EMPLOYED';
  }
  return profile;
}

function validateReminders(raw: unknown, issues: Issues): Settings['reminders'] {
  const reminders = { enabled: false, leadDays: 30 };
  if (raw === undefined) {
    issues.push({ field: 'reminders', code: 'REQUIRED' });
  } else if (!isRecord(raw)) {
    issues.push({ field: 'reminders', code: 'INVALID' });
  } else {
    rejectUnknown(raw, REMINDER_FIELDS, 'reminders', issues);
    reminders.enabled = bool(raw['enabled'], 'reminders.enabled', issues) ?? false;
    if (raw['leadDays'] === undefined)
      issues.push({ field: 'reminders.leadDays', code: 'REQUIRED' });
    else reminders.leadDays = integer(raw['leadDays'], 7, 120, 'reminders.leadDays', issues) ?? 30;
  }
  return reminders;
}

function validateDismissed(raw: unknown, issues: Issues): RequirementId[] {
  if (raw === undefined) issues.push({ field: 'dismissedRequirements', code: 'REQUIRED' });
  else if (!Array.isArray(raw)) issues.push({ field: 'dismissedRequirements', code: 'INVALID' });
  else if (raw.length > 50) issues.push({ field: 'dismissedRequirements', code: 'LIMIT' });
  else if (!raw.every(isRequirementId))
    issues.push({ field: 'dismissedRequirements', code: 'INVALID' });
  else return [...new Set(raw as RequirementId[])];
  return [];
}

export function validateSettings(input: unknown): ValidationResult<Settings> {
  if (!isRecord(input)) return { ok: false, issues: [{ field: '', code: 'INVALID' }] };
  const issues: Issues = [];
  rejectUnknown(input, SETTINGS_FIELDS, '', issues);
  const profile = validateProfile(input['profile'], issues);
  const reminders = validateReminders(input['reminders'], issues);
  const dismissedRequirements = validateDismissed(input['dismissedRequirements'], issues);
  const includeSocial = bool(input['includeSocial'], 'includeSocial', issues) ?? true;
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: { profile, reminders, dismissedRequirements, includeSocial } };
}
