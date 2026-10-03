import Decimal from 'decimal.js';
import type {
  RetirementFigures,
  RetirementImportInfo,
  RetirementRecordInput,
  RetirementScenarioMonthly,
  RetirementSupplement,
  RetirementSupplementPatch,
} from '@vaultfolio/api-contract';
import {
  type ContractType,
  type FieldSpec,
  type Origin,
  SCENARIOS,
  STATUSES,
  SUPPLEMENT_FIELDS,
  type SupplementKey,
  figureFieldsOf,
  isContractType,
  needsProviderLabel,
  requiredFiguresOf,
  supplementKeysOf,
  toMoney,
} from './model';

export type ValidationCode =
  | 'REQUIRED'
  | 'INVALID_AMOUNT'
  | 'INVALID_DATE'
  | 'INVALID_VALUE'
  | 'OUT_OF_RANGE'
  | 'INVALID_IDENTIFIER'
  | 'GUARANTEE_ABOVE_EXPECTED'
  | 'UNKNOWN_FIELD'
  | 'NOT_APPLICABLE';

/** One problem, naming the field path only — never the offending value (log/response safe). */
export interface ValidationIssue {
  field: string;
  code: ValidationCode;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; issues: ValidationIssue[] };

export const MAX_PROVIDER_LABEL_LENGTH = 80;
export const MAX_IDENTIFIER_LENGTH = 40;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9 \-/.]+$/;
const PARSER_ID_PATTERN = /^[a-z0-9-]{1,64}$/;
const PARSER_VERSION_PATTERN = /^[0-9A-Za-z.-]{1,32}$/;
const RECORD_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;
// eslint-disable-next-line no-control-regex -- rejects control characters in free text
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

const RECORD_KEYS = [
  'contractType',
  'origin',
  'status',
  'providerLabel',
  'statementDate',
  'payoutStart',
  'identifier',
  'figures',
  'supplement',
  'import',
  'replaces',
] as const;
const IMPORT_KEYS = ['parserId', 'parserVersion', 'ocrRead'] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Parses a strict calendar date; `null` for anything that is not a real `YYYY-MM-DD`. */
function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : d;
}

function addYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d;
}

class Collector {
  readonly issues: ValidationIssue[] = [];
  add(field: string, code: ValidationCode): void {
    this.issues.push({ field, code });
  }
}

function checkAmount(value: unknown, spec: FieldSpec, field: string, c: Collector): unknown {
  const places = spec.kind === 'money' ? 2 : (spec.places ?? 4);
  if (typeof value !== 'string' || !/^\d{1,12}(\.\d+)?$/.test(value)) {
    c.add(field, 'INVALID_AMOUNT');
    return undefined;
  }
  const d = new Decimal(value);
  if (d.decimalPlaces() > places) {
    c.add(field, 'INVALID_AMOUNT');
    return undefined;
  }
  if (spec.max !== undefined && d.greaterThan(spec.max)) {
    c.add(field, 'OUT_OF_RANGE');
    return undefined;
  }
  return spec.kind === 'money' ? toMoney(d) : d.toFixed();
}

function checkInteger(value: unknown, spec: FieldSpec, field: string, c: Collector): unknown {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    c.add(field, 'INVALID_VALUE');
    return undefined;
  }
  if (spec.max !== undefined && value > spec.max) {
    c.add(field, 'OUT_OF_RANGE');
    return undefined;
  }
  return value;
}

/** Validates one value against its spec; returns the canonical form or `undefined` after reporting. */
function checkField(value: unknown, spec: FieldSpec, field: string, c: Collector): unknown {
  switch (spec.kind) {
    case 'money':
    case 'decimal':
      return checkAmount(value, spec, field, c);
    case 'date':
      if (parseDate(value) === null) {
        c.add(field, 'INVALID_DATE');
        return undefined;
      }
      return value;
    case 'int':
      return checkInteger(value, spec, field, c);
    case 'scenarios':
      return checkScenarios(value, field, c);
  }
}

function checkScenarios(value: unknown, field: string, c: Collector): unknown {
  if (!isPlainObject(value)) {
    c.add(field, 'INVALID_VALUE');
    return undefined;
  }
  const out: RetirementScenarioMonthly = {};
  for (const [key, v] of Object.entries(value)) {
    if (!(SCENARIOS as readonly string[]).includes(key)) {
      c.add(`${field}.${key}`, 'UNKNOWN_FIELD');
      continue;
    }
    const checked = checkField(v, { kind: 'money', max: 100_000 }, `${field}.${key}`, c);
    if (checked !== undefined) out[key as keyof RetirementScenarioMonthly] = checked as string;
  }
  return out;
}

/** Whitelist-checks `body` against `fields`; unknown or inapplicable keys → `UNKNOWN_FIELD`. */
function checkObject(
  body: unknown,
  fields: Readonly<Record<string, FieldSpec>>,
  path: string,
  c: Collector,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!isPlainObject(body)) {
    c.add(path, 'INVALID_VALUE');
    return out;
  }
  for (const [key, value] of Object.entries(body)) {
    const spec = fields[key];
    if (!spec) {
      c.add(`${path}.${key}`, 'UNKNOWN_FIELD');
      continue;
    }
    const checked = checkField(value, spec, `${path}.${key}`, c);
    if (checked !== undefined) out[key] = checked;
  }
  return out;
}

function checkIdentifier(value: unknown, c: Collector): string | undefined {
  if (typeof value !== 'string') {
    c.add('identifier', 'INVALID_IDENTIFIER');
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  if (trimmed.length > MAX_IDENTIFIER_LENGTH || !IDENTIFIER_PATTERN.test(trimmed)) {
    c.add('identifier', 'INVALID_IDENTIFIER');
    return undefined;
  }
  return trimmed;
}

function checkProviderLabel(value: unknown, c: Collector): string | undefined {
  if (typeof value !== 'string') {
    c.add('providerLabel', 'INVALID_VALUE');
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_PROVIDER_LABEL_LENGTH || CONTROL_CHARS.test(trimmed)) {
    c.add('providerLabel', 'OUT_OF_RANGE');
    return undefined;
  }
  return trimmed === '' ? undefined : trimmed;
}

function checkImportInfo(value: unknown, c: Collector): RetirementImportInfo | undefined {
  if (!isPlainObject(value)) {
    c.add('import', 'INVALID_VALUE');
    return undefined;
  }
  let ok = true;
  for (const key of Object.keys(value)) {
    if (!(IMPORT_KEYS as readonly string[]).includes(key)) {
      c.add(`import.${key}`, 'UNKNOWN_FIELD');
      ok = false;
    }
  }
  const { parserId, parserVersion, ocrRead } = value;
  if (typeof parserId !== 'string' || !PARSER_ID_PATTERN.test(parserId)) {
    c.add('import.parserId', 'INVALID_VALUE');
    ok = false;
  }
  if (typeof parserVersion !== 'string' || !PARSER_VERSION_PATTERN.test(parserVersion)) {
    c.add('import.parserVersion', 'INVALID_VALUE');
    ok = false;
  }
  if (typeof ocrRead !== 'boolean') {
    c.add('import.ocrRead', 'INVALID_VALUE');
    ok = false;
  }
  return ok ? (value as unknown as RetirementImportInfo) : undefined;
}

function checkScenarioChoice(value: unknown, field: string, c: Collector): string | undefined {
  if (typeof value !== 'string' || !(SCENARIOS as readonly string[]).includes(value)) {
    c.add(field, 'INVALID_VALUE');
    return undefined;
  }
  return value;
}

function checkSupplementObject(
  type: ContractType,
  body: unknown,
  path: string,
  c: Collector,
): RetirementSupplement {
  const out: Record<string, unknown> = {};
  if (!isPlainObject(body)) {
    c.add(path, 'INVALID_VALUE');
    return out;
  }
  const allowed = supplementKeysOf(type);
  for (const [key, value] of Object.entries(body)) {
    const field = `${path}.${key}`.replace(/^\./, '');
    if (!(key in SUPPLEMENT_FIELDS) || !allowed.includes(key as SupplementKey)) {
      c.add(field, 'UNKNOWN_FIELD');
    } else if (key === 'expectedScenario') {
      const choice = checkScenarioChoice(value, field, c);
      if (choice !== undefined) out[key] = choice;
    } else {
      const checked = checkField(value, SUPPLEMENT_FIELDS[key as SupplementKey], field, c);
      if (checked !== undefined) out[key] = checked;
    }
  }
  return out;
}

/** `guaranteedMonthly ≤ expectedMonthly` when both are present (spec FR-006). */
function checkGuarantee(figures: Record<string, unknown>, c: Collector): void {
  const g = figures['guaranteedMonthly'];
  const e = figures['expectedMonthly'];
  if (typeof g === 'string' && typeof e === 'string' && new Decimal(g).greaterThan(e)) {
    c.add('figures.guaranteedMonthly', 'GUARANTEE_ABOVE_EXPECTED');
  }
}

function checkStatementDate(value: unknown, now: Date, c: Collector): Date | null {
  const statement = parseDate(value);
  if (value === undefined) c.add('statementDate', 'REQUIRED');
  else if (statement === null) c.add('statementDate', 'INVALID_DATE');
  else if (
    statement.getTime() > Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  ) {
    c.add('statementDate', 'OUT_OF_RANGE');
  }
  return statement;
}

function checkDates(
  statementDate: unknown,
  payoutStart: unknown,
  type: ContractType | undefined,
  now: Date,
  c: Collector,
): void {
  const statement = checkStatementDate(statementDate, now, c);
  if (payoutStart === undefined) {
    if (type === 'STATUTORY_PENSION') c.add('payoutStart', 'REQUIRED');
    return;
  }
  const payout = parseDate(payoutStart);
  if (payout === null) {
    c.add('payoutStart', 'INVALID_DATE');
  } else if (statement && (payout < addYears(statement, -1) || payout > addYears(statement, 80))) {
    c.add('payoutStart', 'OUT_OF_RANGE');
  }
}

function checkRequiredFigures(
  type: ContractType,
  figures: Record<string, unknown>,
  c: Collector,
): void {
  for (const key of requiredFiguresOf(type)) {
    if (figures[key] === undefined) c.add(`figures.${key}`, 'REQUIRED');
  }
}

function checkEnvelope(
  body: Record<string, unknown>,
  c: Collector,
): { type?: ContractType; origin?: Origin } {
  for (const key of Object.keys(body)) {
    if (!(RECORD_KEYS as readonly string[]).includes(key)) c.add(key, 'UNKNOWN_FIELD');
  }
  const type = isContractType(body['contractType']) ? body['contractType'] : undefined;
  if (body['contractType'] === undefined) c.add('contractType', 'REQUIRED');
  else if (!type) c.add('contractType', 'INVALID_VALUE');

  const origin: Origin | undefined =
    body['origin'] === 'IMPORTED' || body['origin'] === 'MANUAL' ? body['origin'] : undefined;
  if (body['origin'] === undefined) c.add('origin', 'REQUIRED');
  else if (!origin) c.add('origin', 'INVALID_VALUE');

  const status = body['status'];
  if (status === undefined) c.add('status', 'REQUIRED');
  else if (!(STATUSES as readonly unknown[]).includes(status)) c.add('status', 'INVALID_VALUE');
  else if (type === 'STATUTORY_PENSION' && status !== 'ACTIVE') c.add('status', 'INVALID_VALUE');
  return { type, origin };
}

function checkLabel(
  value: unknown,
  type: ContractType | undefined,
  c: Collector,
): string | undefined {
  const required = type !== undefined && needsProviderLabel(type);
  if (value === undefined) {
    if (required) c.add('providerLabel', 'REQUIRED');
    return undefined;
  }
  if (type !== undefined && !required) {
    c.add('providerLabel', 'NOT_APPLICABLE');
    return undefined;
  }
  const label = checkProviderLabel(value, c);
  if (label === undefined && required && c.issues.every((i) => i.field !== 'providerLabel')) {
    c.add('providerLabel', 'REQUIRED');
  }
  return label;
}

function checkFigures(
  value: unknown,
  type: ContractType | undefined,
  origin: Origin | undefined,
  c: Collector,
): Record<string, unknown> {
  if (value === undefined) {
    c.add('figures', 'REQUIRED');
    return {};
  }
  if (!type || !origin) {
    if (!isPlainObject(value)) c.add('figures', 'INVALID_VALUE');
    return {};
  }
  const figures = checkObject(value, figureFieldsOf(type, origin), 'figures', c);
  checkRequiredFigures(type, figures, c);
  checkGuarantee(figures, c);
  return figures;
}

interface OriginParts {
  supplement?: RetirementSupplement;
  importInfo?: RetirementImportInfo;
  replaces?: string;
}

function checkImportedParts(
  body: Record<string, unknown>,
  type: ContractType | undefined,
  c: Collector,
): OriginParts {
  const parts: OriginParts = {};
  if (body['import'] === undefined) c.add('import', 'REQUIRED');
  else parts.importInfo = checkImportInfo(body['import'], c);
  if (body['supplement'] !== undefined && type) {
    parts.supplement = checkSupplementObject(type, body['supplement'], 'supplement', c);
  }
  const replaces = body['replaces'];
  if (replaces !== undefined) {
    if (typeof replaces === 'string' && RECORD_ID_PATTERN.test(replaces)) parts.replaces = replaces;
    else c.add('replaces', 'INVALID_VALUE');
  }
  return parts;
}

/** `supplement` / `import` / `replaces`: imports only; manual records must not carry them. */
function checkOriginParts(
  body: Record<string, unknown>,
  type: ContractType | undefined,
  origin: Origin | undefined,
  c: Collector,
): OriginParts {
  if (origin === 'IMPORTED') return checkImportedParts(body, type, c);
  if (origin === 'MANUAL') {
    for (const key of ['supplement', 'import', 'replaces']) {
      if (body[key] !== undefined) c.add(key, 'NOT_APPLICABLE');
    }
  }
  return {};
}

/**
 * Validates a record body (POST; PUT uses the same shape with `origin: 'MANUAL'`). Strict
 * whitelist per contract type; never throws for user input; returns canonicalised decimals.
 */
export function validateRecordInput(
  body: unknown,
  opts: { now: Date },
): ValidationResult<RetirementRecordInput> {
  if (!isPlainObject(body)) return { ok: false, issues: [{ field: '', code: 'INVALID_VALUE' }] };
  const c = new Collector();
  const { type, origin } = checkEnvelope(body, c);
  checkDates(body['statementDate'], body['payoutStart'], type, opts.now, c);
  const providerLabel = checkLabel(body['providerLabel'], type, c);
  const identifier =
    body['identifier'] === undefined ? undefined : checkIdentifier(body['identifier'], c);
  const figures = checkFigures(body['figures'], type, origin, c);
  const parts = checkOriginParts(body, type, origin, c);

  if (c.issues.length > 0 || !type || !origin) return { ok: false, issues: c.issues };

  const value: RetirementRecordInput = {
    contractType: type,
    origin,
    status: body['status'] as RetirementRecordInput['status'],
    statementDate: body['statementDate'] as string,
    figures: figures as unknown as RetirementFigures,
  };
  if (providerLabel !== undefined) value.providerLabel = providerLabel;
  if (body['payoutStart'] !== undefined) value.payoutStart = body['payoutStart'] as string;
  if (identifier !== undefined) value.identifier = identifier;
  if (parts.supplement !== undefined) value.supplement = parts.supplement;
  if (parts.importInfo !== undefined) value.import = parts.importInfo;
  if (parts.replaces !== undefined) value.replaces = parts.replaces;
  return { ok: true, value };
}

/** Validates the supplement of an imported record (fields the document does not print). */
export function validateSupplement(
  type: ContractType,
  body: unknown,
): ValidationResult<RetirementSupplement> {
  const c = new Collector();
  const value = checkSupplementObject(type, body, '', c);
  return c.issues.length > 0 ? { ok: false, issues: c.issues } : { ok: true, value };
}

/** Validates a `PATCH …/supplement` body: the supplement fields plus the plain `status` column. */
export function validateSupplementPatch(
  type: ContractType,
  body: unknown,
): ValidationResult<RetirementSupplementPatch> {
  if (!isPlainObject(body)) return { ok: false, issues: [{ field: '', code: 'INVALID_VALUE' }] };
  const { status, ...rest } = body;
  const c = new Collector();
  const value: RetirementSupplementPatch = checkSupplementObject(type, rest, '', c);
  if (status !== undefined) {
    if ((STATUSES as readonly unknown[]).includes(status)) {
      value.status = status as RetirementSupplementPatch['status'];
    } else c.add('status', 'INVALID_VALUE');
  }
  return c.issues.length > 0 ? { ok: false, issues: c.issues } : { ok: true, value };
}
