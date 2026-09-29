import type { EarningsSourceType } from '@vaultfolio/api-contract';
import {
  CERTIFICATE_KEYS,
  type CertificateInput,
  type ImportFileInput,
  ONE_OFF_KEYS,
  PAY_AMOUNT_KEYS,
  type PayRecordInput,
} from './model';

export interface ImportFileMeta {
  clientFileId: string;
  fileName: string;
  sourceType: EarningsSourceType;
  fileSha256: string;
  parserId: string;
  parserVersion: string;
}

function pick<T extends object>(source: T, keys: readonly string[]): Partial<T> {
  const src = source as Record<string, unknown>;
  return Object.fromEntries(
    keys.filter((k) => src[k] !== undefined).map((k) => [k, src[k]]),
  ) as Partial<T>;
}

function recordBody(r: PayRecordInput): PayRecordInput {
  const a = r.amounts;
  return {
    employer: r.employer,
    period: r.period,
    issued: r.issued,
    kind: r.kind,
    seq: r.seq,
    amounts: {
      ...(pick(a, PAY_AMOUNT_KEYS) as Pick<
        PayRecordInput['amounts'],
        (typeof PAY_AMOUNT_KEYS)[number]
      >),
      payout: a.payout,
      oneOff: pick(a.oneOff, ONE_OFF_KEYS),
      employerSubsidy: a.employerSubsidy
        ? { health: a.employerSubsidy.health, care: a.employerSubsidy.care }
        : null,
      ytd: a.ytd ? pick(a.ytd, ONE_OFF_KEYS) : null,
    },
  };
}

function certificateBody(c: CertificateInput): CertificateInput {
  return {
    employer: c.employer,
    year: c.year,
    amounts: pick(c.amounts, CERTIFICATE_KEYS) as CertificateInput['amounts'],
  };
}

/**
 * Builds the whitelisted import body of one file (FR-008, FR-017): exactly the keys of
 * `EarningsImportFile`, rebuilt key by key so nothing a parser might attach can leak to the server.
 */
export function toImportFile(
  parsed: { records: readonly PayRecordInput[]; certificates: readonly CertificateInput[] },
  meta: ImportFileMeta,
): ImportFileInput {
  return {
    clientFileId: meta.clientFileId,
    fileName: meta.fileName,
    sourceType: meta.sourceType,
    fileSha256: meta.fileSha256,
    parserId: meta.parserId,
    parserVersion: meta.parserVersion,
    records: parsed.records.map(recordBody),
    certificates: parsed.certificates.map(certificateBody),
  };
}
