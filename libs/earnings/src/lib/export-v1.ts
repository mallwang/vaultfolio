import {
  CERTIFICATE_KEYS,
  type CertificateAmounts,
  type CertificateInput,
  centsToMoney,
  type OneOffKey,
  type ParseError,
  type ParseOutcome,
  type PayRecordAmounts,
  type PayRecordInput,
  type RecordKind,
} from './model';
import { validateImportFile } from './validation';

/**
 * Reader for the companion tool's `earnings-export` JSON, version 1
 * (contracts/earnings-export-v1.md). Validation is closed: any key not listed there, at any
 * level, rejects the file (`EXPORT_UNKNOWN_FIELD`); an unknown schema/version rejects it
 * (`EXPORT_UNSUPPORTED_VERSION`). Integer cents are converted exactly; afterwards the mapped file
 * goes through the same whitelist validation and checks as every PDF import (FR-007, FR-012).
 */

export const EXPORT_PARSER_ID = 'earnings-export';
export const EXPORT_PARSER_VERSION = '1';

const TOP_KEYS = ['schema', 'version', 'generated', 'records', 'certificates'];
const RECORD_KEYS = [
  'employer',
  'period',
  'issued',
  'kind',
  'seq',
  'amounts',
  'one_off',
  'employer_share',
  'ytd',
];
const REQUIRED_RECORD_KEYS = ['employer', 'period', 'issued', 'kind', 'seq', 'amounts'];

/** snake_case amount key → `PayRecordAmounts` key. */
const AMOUNT_KEYS: Record<string, keyof PayRecordAmounts> = {
  gross: 'gross',
  tax_gross: 'taxGross',
  sv_gross_kv: 'svGrossKv',
  sv_gross_rv: 'svGrossRv',
  wage_tax: 'wageTax',
  soli: 'soli',
  church_tax: 'churchTax',
  health: 'health',
  care: 'care',
  pension: 'pension',
  unemployment: 'unemployment',
  net: 'net',
  other: 'other',
  payout: 'payout',
};

/** Keys allowed in `one_off` and `ytd`; `sv_gross_*` one-off parts are accepted but not stored. */
const PART_KEYS: Record<string, OneOffKey | null> = {
  gross: 'gross',
  tax_gross: 'taxGross',
  wage_tax: 'wageTax',
  soli: 'soli',
  church_tax: 'churchTax',
  health: 'health',
  care: 'care',
  pension: 'pension',
  unemployment: 'unemployment',
};
const ONE_OFF_EXTRA: Record<string, null> = { sv_gross_kv: null, sv_gross_rv: null };

const SUBSIDY_KEYS: Record<string, 'health' | 'care'> = {
  health_subsidy: 'health',
  care_subsidy: 'care',
};

const CERTIFICATE_SNAKE: Record<string, keyof CertificateAmounts> = Object.fromEntries(
  CERTIFICATE_KEYS.map((k) => [k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`), k]),
);

const KINDS: Record<string, RecordKind> = {
  regular: 'REGULAR',
  correction: 'CORRECTION',
  payout_only: 'PAYOUT_ONLY',
};

class ExportFailure {
  constructor(readonly error: ParseError) {}
}

function fail(code: ParseError['code'], params?: Record<string, string>): never {
  throw new ExportFailure(params ? { code, params } : { code });
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function object(
  value: unknown,
  path: string,
  allowed: readonly string[],
  required: readonly string[] = [],
) {
  if (!isObject(value)) fail('INVALID_VALUE', { path });
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key))
      fail('EXPORT_UNKNOWN_FIELD', { path: path ? `${path}.${key}` : key });
  }
  for (const key of required) {
    if (!(key in value)) fail('INVALID_VALUE', { path: path ? `${path}.${key}` : key });
  }
  return value;
}

function cents(value: unknown, path: string): string {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) fail('INVALID_VALUE', { path });
  return centsToMoney(value);
}

function parts(
  value: unknown,
  path: string,
  keys: Record<string, OneOffKey | null>,
): Partial<Record<OneOffKey, string>> {
  const o = object(value, path, Object.keys(keys));
  const out: Partial<Record<OneOffKey, string>> = {};
  for (const [k, v] of Object.entries(o)) {
    const money = cents(v, `${path}.${k}`);
    const target = keys[k];
    if (target) out[target] = money;
  }
  return out;
}

function record(value: unknown, path: string): PayRecordInput {
  const o = object(value, path, RECORD_KEYS, REQUIRED_RECORD_KEYS);
  const kind = typeof o['kind'] === 'string' ? KINDS[o['kind']] : undefined;
  if (!kind) fail('INVALID_VALUE', { path: `${path}.kind` });

  const rawAmounts = object(o['amounts'], `${path}.amounts`, Object.keys(AMOUNT_KEYS));
  const amounts = Object.fromEntries(
    Object.values(AMOUNT_KEYS).map((k) => [k, '0.00']),
  ) as unknown as PayRecordAmounts;
  amounts.payout = kind === 'CORRECTION' ? null : '0.00';
  for (const [k, v] of Object.entries(rawAmounts)) {
    const key = AMOUNT_KEYS[k];
    if (key === 'payout' && v === null) {
      amounts.payout = null;
      continue;
    }
    (amounts as unknown as Record<string, string>)[key] = cents(v, `${path}.amounts.${k}`);
  }

  amounts.oneOff =
    o['one_off'] === undefined
      ? {}
      : parts(o['one_off'], `${path}.one_off`, { ...PART_KEYS, ...ONE_OFF_EXTRA });
  amounts.employerSubsidy = null;
  if (o['employer_share'] !== undefined) {
    const s = object(o['employer_share'], `${path}.employer_share`, Object.keys(SUBSIDY_KEYS));
    const subsidy = { health: '0.00', care: '0.00' };
    for (const [k, v] of Object.entries(s))
      subsidy[SUBSIDY_KEYS[k]] = cents(v, `${path}.employer_share.${k}`);
    amounts.employerSubsidy = subsidy;
  }
  amounts.ytd = null;
  if (o['ytd'] !== undefined) {
    if (kind !== 'REGULAR') fail('INVALID_VALUE', { path: `${path}.ytd` });
    amounts.ytd = parts(o['ytd'], `${path}.ytd`, PART_KEYS);
  }

  return {
    employer: o['employer'] as string,
    period: o['period'] as string,
    issued: o['issued'] as string,
    kind,
    seq: o['seq'] as number,
    amounts,
  };
}

function certificate(value: unknown, path: string): CertificateInput {
  const o = object(value, path, ['employer', 'year', 'amounts'], ['employer', 'year', 'amounts']);
  const raw = object(o['amounts'], `${path}.amounts`, Object.keys(CERTIFICATE_SNAKE));
  const amounts = Object.fromEntries(
    CERTIFICATE_KEYS.map((k) => [k, '0.00']),
  ) as unknown as CertificateAmounts;
  for (const [k, v] of Object.entries(raw))
    amounts[CERTIFICATE_SNAKE[k]] = cents(v, `${path}.amounts.${k}`);
  return { employer: o['employer'] as string, year: o['year'] as number, amounts };
}

function read(json: unknown): ParseOutcome {
  if (!isObject(json)) fail('INVALID_VALUE', { path: '' });
  if (json['schema'] !== 'earnings-export' || json['version'] !== 1) {
    fail('EXPORT_UNSUPPORTED_VERSION', { version: String(json['version'] ?? '') });
  }
  object(json, '', TOP_KEYS, TOP_KEYS);
  if (
    typeof json['generated'] !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?/.test(json['generated'])
  ) {
    fail('INVALID_VALUE', { path: 'generated' });
  }
  if (!Array.isArray(json['records'])) fail('INVALID_VALUE', { path: 'records' });
  if (!Array.isArray(json['certificates'])) fail('INVALID_VALUE', { path: 'certificates' });
  const records = json['records'].map((r, i) => record(r, `records[${i}]`));
  const certificates = json['certificates'].map((c, i) => certificate(c, `certificates[${i}]`));

  // Same whitelist rules and checks as every PDF import (FR-013 mirrors this on the server).
  const validated = validateImportFile({
    clientFileId: 'export',
    fileName: 'export.json',
    sourceType: 'EXPORT_JSON',
    fileSha256: '0'.repeat(64),
    parserId: EXPORT_PARSER_ID,
    parserVersion: EXPORT_PARSER_VERSION,
    records,
    certificates,
  });
  if (!validated.ok) fail(validated.error.code, validated.error.params);
  const { records: r, certificates: c } = validated.value;
  return {
    ok: true,
    employer: r[0]?.employer ?? c[0]?.employer ?? '',
    records: r,
    certificates: c,
  };
}

/** Reads an `earnings-export` v1 document (already `JSON.parse`d). */
export function readEarningsExport(json: unknown): ParseOutcome & {
  parserId: typeof EXPORT_PARSER_ID;
  parserVersion: typeof EXPORT_PARSER_VERSION;
} {
  const meta = { parserId: EXPORT_PARSER_ID, parserVersion: EXPORT_PARSER_VERSION } as const;
  try {
    return { ...read(json), ...meta };
  } catch (e) {
    if (e instanceof ExportFailure) return { ok: false, error: e.error, ...meta };
    throw e;
  }
}
