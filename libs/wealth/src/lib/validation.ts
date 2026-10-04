import Decimal from 'decimal.js';
import { groupsOf, isStandardClassId, sideOfStandard } from './classes';
import {
  type ClassGroupAssignment,
  type ClassRef,
  MAX_AMOUNT,
  MAX_CUSTOM_CLASS_LENGTH,
  MAX_ENTRIES,
  MAX_NAME_LENGTH,
  MAX_NOTE_LENGTH,
  MIN_DATE,
  type Side,
  type WealthEntry,
  type WealthSnapshotInput,
} from './model';

export type ValidationCode =
  | 'REQUIRED'
  | 'INVALID_AMOUNT'
  | 'INVALID_DATE'
  | 'INVALID_VALUE'
  | 'OUT_OF_RANGE'
  | 'TOO_LONG'
  | 'UNKNOWN_FIELD'
  | 'LIMIT_EXCEEDED';

/** One problem, naming the field path only — never the offending value (log/response safe). */
export interface ValidationIssue {
  field: string;
  code: ValidationCode;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; issues: ValidationIssue[] };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;
const DAY_MS = 86_400_000;

const SNAPSHOT_FIELDS = new Set(['snapshotDate', 'note', 'entries']);
const ENTRY_FIELDS = new Set(['side', 'class', 'name', 'amount']);
const ASSIGNMENT_FIELDS = new Set(['side', 'class', 'group']);

type Issues = ValidationIssue[];

/** `"12000.5"` → `"12000.50"`; `null` for anything that is not a plain non-negative decimal in range. */
export function normalizeMoney(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!AMOUNT_PATTERN.test(trimmed)) return null;
  const value = new Decimal(trimmed);
  if (value.gt(MAX_AMOUNT)) return null;
  return value.toFixed(2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rejectUnknown(
  obj: Record<string, unknown>,
  allowed: Set<string>,
  path: string,
  issues: Issues,
) {
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key))
      issues.push({ field: path ? `${path}.${key}` : key, code: 'UNKNOWN_FIELD' });
  }
}

function isRealDate(text: string): boolean {
  if (!DATE_PATTERN.test(text)) return false;
  const [y, m, d] = text.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function latestAllowedDate(today: string): string {
  return new Date(Date.parse(`${today}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
}

function checkDate(value: unknown, today: string, field: string, issues: Issues): string | null {
  if (value === undefined || value === null || value === '') {
    issues.push({ field, code: 'REQUIRED' });
    return null;
  }
  if (typeof value !== 'string' || !isRealDate(value)) {
    issues.push({ field, code: 'INVALID_DATE' });
    return null;
  }
  if (value < MIN_DATE || value > latestAllowedDate(today)) {
    issues.push({ field, code: 'OUT_OF_RANGE' });
    return null;
  }
  return value;
}

function checkText(
  value: unknown,
  max: number,
  field: string,
  issues: Issues,
  required: boolean,
): string | null {
  if (value === undefined || value === null) {
    if (required) issues.push({ field, code: 'REQUIRED' });
    return null;
  }
  if (typeof value !== 'string') {
    issues.push({ field, code: 'INVALID_VALUE' });
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    if (required) issues.push({ field, code: 'REQUIRED' });
    return null;
  }
  if (trimmed.length > max) {
    issues.push({ field, code: 'TOO_LONG' });
    return null;
  }
  return trimmed;
}

function checkSide(value: unknown, field: string, issues: Issues): Side | null {
  if (value === undefined || value === null || value === '') {
    issues.push({ field, code: 'REQUIRED' });
    return null;
  }
  if (value !== 'ASSET' && value !== 'LIABILITY') {
    issues.push({ field, code: 'INVALID_VALUE' });
    return null;
  }
  return value;
}

function checkClass(
  value: unknown,
  side: Side | null,
  field: string,
  issues: Issues,
): ClassRef | null {
  if (value === undefined || value === null) {
    issues.push({ field, code: 'REQUIRED' });
    return null;
  }
  if (!isRecord(value)) {
    issues.push({ field, code: 'INVALID_VALUE' });
    return null;
  }
  const keys = Object.keys(value);
  const unknown = keys.filter((k) => k !== 'standard' && k !== 'custom');
  for (const key of unknown) issues.push({ field: `${field}.${key}`, code: 'UNKNOWN_FIELD' });
  if (unknown.length > 0) return null;
  if (keys.length !== 1) {
    issues.push({ field, code: keys.length === 0 ? 'REQUIRED' : 'INVALID_VALUE' });
    return null;
  }
  if ('standard' in value) {
    const id = value['standard'];
    if (!isStandardClassId(id)) {
      issues.push({ field: `${field}.standard`, code: 'INVALID_VALUE' });
      return null;
    }
    if (side && sideOfStandard(id) !== side) {
      issues.push({ field: `${field}.standard`, code: 'UNKNOWN_FIELD' });
      return null;
    }
    return { standard: id };
  }
  const custom = checkText(
    value['custom'],
    MAX_CUSTOM_CLASS_LENGTH,
    `${field}.custom`,
    issues,
    true,
  );
  return custom === null ? null : { custom };
}

function checkEntry(value: unknown, index: number, issues: Issues): WealthEntry | null {
  const path = `entries[${index}]`;
  if (!isRecord(value)) {
    issues.push({ field: path, code: 'INVALID_VALUE' });
    return null;
  }
  const before = issues.length;
  rejectUnknown(value, ENTRY_FIELDS, path, issues);
  const side = checkSide(value['side'], `${path}.side`, issues);
  const classRef = checkClass(value['class'], side, `${path}.class`, issues);
  const name = checkText(value['name'], MAX_NAME_LENGTH, `${path}.name`, issues, true);
  let amount: string | null = null;
  if (value['amount'] === undefined || value['amount'] === null || value['amount'] === '') {
    issues.push({ field: `${path}.amount`, code: 'REQUIRED' });
  } else {
    amount = normalizeMoney(value['amount']);
    if (amount === null) issues.push({ field: `${path}.amount`, code: 'INVALID_AMOUNT' });
  }
  if (issues.length > before || !side || !classRef || name === null || amount === null) return null;
  return { side, class: classRef, name, amount };
}

/**
 * Strict whitelist validation of a snapshot body. `today` is `YYYY-MM-DD` (the only clock input);
 * a snapshot dated up to one day after it is accepted to tolerate time zones.
 */
export function validateSnapshotInput(
  input: unknown,
  today: string,
): ValidationResult<WealthSnapshotInput> {
  const issues: Issues = [];
  if (!isRecord(input)) return { ok: false, issues: [{ field: '', code: 'INVALID_VALUE' }] };
  rejectUnknown(input, SNAPSHOT_FIELDS, '', issues);

  const snapshotDate = checkDate(input['snapshotDate'], today, 'snapshotDate', issues);
  const note = checkText(input['note'], MAX_NOTE_LENGTH, 'note', issues, false);

  const entries: WealthEntry[] = [];
  if (!Array.isArray(input['entries'])) {
    issues.push({
      field: 'entries',
      code: input['entries'] === undefined ? 'REQUIRED' : 'INVALID_VALUE',
    });
  } else if (input['entries'].length === 0) {
    issues.push({ field: 'entries', code: 'REQUIRED' });
  } else if (input['entries'].length > MAX_ENTRIES) {
    issues.push({ field: 'entries', code: 'LIMIT_EXCEEDED' });
  } else {
    input['entries'].forEach((raw: unknown, index: number) => {
      const entry = checkEntry(raw, index, issues);
      if (entry) entries.push(entry);
    });
  }

  if (issues.length > 0 || snapshotDate === null) return { ok: false, issues };
  const value: WealthSnapshotInput = { snapshotDate, entries };
  if (note !== null) value['note'] = note;
  return { ok: true, value };
}

export function validateClassGroup(input: unknown): ValidationResult<ClassGroupAssignment> {
  const issues: Issues = [];
  if (!isRecord(input)) return { ok: false, issues: [{ field: '', code: 'INVALID_VALUE' }] };
  rejectUnknown(input, ASSIGNMENT_FIELDS, '', issues);
  const side = checkSide(input['side'], 'side', issues);
  const classRef = checkClass(input['class'], side, 'class', issues);
  let group: ClassGroupAssignment['group'] | null = null;
  if (input['group'] === undefined || input['group'] === null || input['group'] === '') {
    issues.push({ field: 'group', code: 'REQUIRED' });
  } else if (side && (groupsOf(side) as readonly unknown[]).includes(input['group'])) {
    group = input['group'] as ClassGroupAssignment['group'];
  } else {
    issues.push({ field: 'group', code: side ? 'UNKNOWN_FIELD' : 'INVALID_VALUE' });
  }
  if (issues.length > 0 || !side || !classRef || !group) return { ok: false, issues };
  return { ok: true, value: { side, class: classRef, group } };
}
