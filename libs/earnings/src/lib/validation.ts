import { evaluateChecks } from './checks';
import {
  CERTIFICATE_KEYS,
  type CertificateAmounts,
  type CertificateInput,
  type EmployerSubsidy,
  type ImportFileInput,
  isMoney,
  normalizeEmployerName,
  ONE_OFF_KEYS,
  type OneOffAmounts,
  PAY_AMOUNT_KEYS,
  type ParseError,
  type PayRecordAmounts,
  type PayRecordInput,
  PERIOD_PATTERN,
  RECORD_KINDS,
  type RecordKind,
} from './model';

export const MAX_RECORDS_PER_FILE = 2000;
export const MAX_CERTIFICATES_PER_FILE = 2000;
export const MAX_EMPLOYER_LENGTH = 200;
export const MAX_FILE_NAME_LENGTH = 255;

const SOURCE_TYPES = ['PAYSLIP_PDF', 'CERTIFICATE_PDF', 'EXPORT_JSON'] as const;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const CLIENT_FILE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const PARSER_ID_PATTERN = /^[a-z0-9-]{1,64}$/;
const PARSER_VERSION_PATTERN = /^[0-9A-Za-z.-]{1,32}$/;

const FILE_KEYS = [
  'clientFileId',
  'fileName',
  'sourceType',
  'fileSha256',
  'parserId',
  'parserVersion',
  'records',
  'certificates',
] as const;
const RECORD_KEYS = ['employer', 'period', 'issued', 'kind', 'seq', 'amounts'] as const;
const AMOUNT_KEYS = [...PAY_AMOUNT_KEYS, 'payout', 'oneOff', 'employerSubsidy', 'ytd'] as const;
const SUBSIDY_KEYS = ['health', 'care'] as const;
const CERT_KEYS = ['employer', 'year', 'amounts'] as const;

/** Thrown internally to abort the traversal with the first error. */
class ValidationFailure {
  constructor(readonly error: ParseError) {}
}

function fail(code: ParseError['code'], path: string): never {
  throw new ValidationFailure({ code, params: { path } });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Asserts `value` is an object with only `allowed` keys (unknown → EARNINGS_UNKNOWN_FIELD). */
function object(
  value: unknown,
  path: string,
  allowed: readonly string[],
  required: readonly string[] = allowed,
): Record<string, unknown> {
  if (!isPlainObject(value)) fail('INVALID_VALUE', path);
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail('EARNINGS_UNKNOWN_FIELD', join(path, key));
  }
  for (const key of required) {
    if (!(key in value)) fail('INVALID_VALUE', join(path, key));
  }
  return value;
}

function join(path: string, key: string): string {
  return path ? `${path}.${key}` : key;
}

function string(value: unknown, path: string, test: (s: string) => boolean): string {
  if (typeof value !== 'string' || !test(value)) fail('INVALID_VALUE', path);
  return value;
}

function money(value: unknown, path: string): string {
  if (!isMoney(value)) fail('INVALID_VALUE', path);
  return value;
}

function integer(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    fail('INVALID_VALUE', path);
  }
  return value;
}

function array(value: unknown, path: string, max: number): unknown[] {
  if (!Array.isArray(value)) fail('INVALID_VALUE', path);
  if (value.length > max) fail('LIMIT_EXCEEDED', path);
  return value;
}

function employerName(value: unknown, path: string): string {
  const name = normalizeEmployerName(
    string(value, path, (s) => s.trim().length > 0 && s.length <= MAX_EMPLOYER_LENGTH * 2),
  );
  if (name.length > MAX_EMPLOYER_LENGTH) fail('INVALID_VALUE', path);
  return name;
}

function partialMoney(
  value: unknown,
  path: string,
  keys: readonly string[],
): Record<string, string> {
  const o = object(value, path, keys, []);
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, money(v, join(path, k))]));
}

function amounts(value: unknown, path: string): PayRecordAmounts {
  const o = object(value, path, AMOUNT_KEYS);
  const out = Object.fromEntries(
    PAY_AMOUNT_KEYS.map((k) => [k, money(o[k], join(path, k))]),
  ) as Record<(typeof PAY_AMOUNT_KEYS)[number], string>;
  const payout = o['payout'] === null ? null : money(o['payout'], join(path, 'payout'));
  const oneOff = partialMoney(o['oneOff'], join(path, 'oneOff'), ONE_OFF_KEYS) as OneOffAmounts;
  let employerSubsidy: EmployerSubsidy | null = null;
  if (o['employerSubsidy'] !== null) {
    const s = object(o['employerSubsidy'], join(path, 'employerSubsidy'), SUBSIDY_KEYS);
    employerSubsidy = {
      health: money(s['health'], join(path, 'employerSubsidy.health')),
      care: money(s['care'], join(path, 'employerSubsidy.care')),
    };
  }
  const ytd = o['ytd'] === null ? null : partialMoney(o['ytd'], join(path, 'ytd'), ONE_OFF_KEYS);
  return { ...out, payout, oneOff, employerSubsidy, ytd };
}

function record(value: unknown, path: string): PayRecordInput {
  const o = object(value, path, RECORD_KEYS);
  const period = string(o['period'], join(path, 'period'), (s) => PERIOD_PATTERN.test(s));
  const issued = string(o['issued'], join(path, 'issued'), (s) => PERIOD_PATTERN.test(s));
  const kind = string(o['kind'], join(path, 'kind'), (s) =>
    RECORD_KINDS.includes(s as RecordKind),
  ) as RecordKind;
  const consistent =
    (kind === 'REGULAR' && issued === period) ||
    (kind === 'CORRECTION' && issued > period) ||
    (kind === 'PAYOUT_ONLY' && issued >= period);
  if (!consistent) fail('INVALID_VALUE', join(path, 'issued'));
  return {
    employer: employerName(o['employer'], join(path, 'employer')),
    period,
    issued,
    kind,
    seq: integer(o['seq'], join(path, 'seq'), 1, 999),
    amounts: amounts(o['amounts'], join(path, 'amounts')),
  };
}

function certificate(value: unknown, path: string): CertificateInput {
  const o = object(value, path, CERT_KEYS);
  const a = object(o['amounts'], join(path, 'amounts'), CERTIFICATE_KEYS);
  return {
    employer: employerName(o['employer'], join(path, 'employer')),
    year: integer(o['year'], join(path, 'year'), 1900, 2999),
    amounts: Object.fromEntries(
      CERTIFICATE_KEYS.map((k) => [k, money(a[k], join(path, `amounts.${k}`))]),
    ) as unknown as CertificateAmounts,
  };
}

/** Identity of a record within one owner's data (FR-016). */
export function recordIdentity(
  r: Pick<PayRecordInput, 'employer' | 'period' | 'kind' | 'seq'>,
): string {
  return `${r.employer}|${r.period}|${r.kind}|${r.seq}`;
}

export function certificateIdentity(c: Pick<CertificateInput, 'employer' | 'year'>): string {
  return `${c.employer}|${c.year}`;
}

function parse(file: unknown): ImportFileInput {
  const o = object(file, '', FILE_KEYS);
  const value: ImportFileInput = {
    clientFileId: string(o['clientFileId'], 'clientFileId', (s) => CLIENT_FILE_ID_PATTERN.test(s)),
    fileName: string(
      o['fileName'],
      'fileName',
      (s) => s.length > 0 && s.length <= MAX_FILE_NAME_LENGTH && !/[/\\]/.test(s),
    ),
    sourceType: string(o['sourceType'], 'sourceType', (s) =>
      (SOURCE_TYPES as readonly string[]).includes(s),
    ) as ImportFileInput['sourceType'],
    fileSha256: string(o['fileSha256'], 'fileSha256', (s) => SHA256_PATTERN.test(s)),
    parserId: string(o['parserId'], 'parserId', (s) => PARSER_ID_PATTERN.test(s)),
    parserVersion: string(o['parserVersion'], 'parserVersion', (s) =>
      PARSER_VERSION_PATTERN.test(s),
    ),
    records: array(o['records'], 'records', MAX_RECORDS_PER_FILE).map((r, i) =>
      record(r, `records[${i}]`),
    ),
    certificates: array(o['certificates'], 'certificates', MAX_CERTIFICATES_PER_FILE).map((c, i) =>
      certificate(c, `certificates[${i}]`),
    ),
  };
  if (value.records.length === 0 && value.certificates.length === 0)
    fail('INVALID_VALUE', 'records');
  const seen = new Set<string>();
  value.records.forEach((r, i) => {
    const id = recordIdentity(r);
    if (seen.has(id)) fail('INVALID_VALUE', `records[${i}].seq`);
    seen.add(id);
  });
  const seenCerts = new Set<string>();
  value.certificates.forEach((c, i) => {
    const id = certificateIdentity(c);
    if (seenCerts.has(id)) fail('INVALID_VALUE', `certificates[${i}].year`);
    seenCerts.add(id);
  });
  return value;
}

/**
 * Strict whitelist validation of one import file (FR-009, FR-013): any unknown key at any depth is
 * rejected with `EARNINGS_UNKNOWN_FIELD` (`params.path`), malformed values with `INVALID_VALUE`,
 * oversized arrays with `LIMIT_EXCEEDED`, and a file with any failing check with `CHECK_FAILED`.
 * The returned value is a fresh copy holding only whitelisted keys, employer names normalized.
 */
export function validateImportFile(
  file: unknown,
): { ok: true; value: ImportFileInput } | { ok: false; error: ParseError } {
  let value: ImportFileInput;
  try {
    value = parse(file);
  } catch (e) {
    if (e instanceof ValidationFailure) return { ok: false, error: e.error };
    throw e;
  }
  const { failure } = evaluateChecks(value.records);
  return failure ? { ok: false, error: failure } : { ok: true, value };
}
