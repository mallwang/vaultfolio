import {
  type CertificateAmounts,
  type CertificateInput,
  emptyCertificateAmounts,
  emptyPayRecordAmounts,
  type PayRecordAmounts,
  type PayRecordInput,
  type StoredRecord,
} from '../model';

/**
 * Test builders with invented figures. The default record balances: 5000.00 − (800.00 + 0.00 +
 * 0.00) − (400.00 + 90.00 + 465.00 + 65.00) = 3180.00, payout 3180.00.
 */
export function payRecord(
  overrides: Partial<Omit<PayRecordInput, 'amounts'>> & {
    amounts?: Partial<PayRecordAmounts>;
  } = {},
): PayRecordInput {
  const { amounts, ...rest } = overrides;
  return {
    employer: 'Brightline Software GmbH',
    period: '2026-09',
    issued: '2026-09',
    kind: 'REGULAR',
    seq: 1,
    ...rest,
    amounts: {
      ...emptyPayRecordAmounts(),
      gross: '5000.00',
      taxGross: '5000.00',
      svGrossKv: '5000.00',
      svGrossRv: '5000.00',
      wageTax: '800.00',
      health: '400.00',
      care: '90.00',
      pension: '465.00',
      unemployment: '65.00',
      net: '3180.00',
      payout: '3180.00',
      ...amounts,
    },
  };
}

export function storedRecord(
  overrides: Partial<Omit<StoredRecord, 'amounts'>> & { amounts?: Partial<PayRecordAmounts> } = {},
): StoredRecord {
  const { amounts, id, importId, employerId, ...rest } = overrides;
  const base = payRecord({ ...rest, amounts });
  return {
    id: id ?? `r-${base.period}-${base.kind}-${base.seq}`,
    importId: importId ?? 'imp-1',
    employerId: employerId ?? 'emp-1',
    period: base.period,
    issued: base.issued,
    kind: base.kind,
    seq: base.seq,
    amounts: { ...base.amounts, checks: [] },
  };
}

export function certificate(
  overrides: Partial<Omit<CertificateInput, 'amounts'>> & {
    amounts?: Partial<CertificateAmounts>;
  } = {},
): CertificateInput {
  const { amounts, ...rest } = overrides;
  return {
    employer: 'Brightline Software GmbH',
    year: 2025,
    ...rest,
    amounts: { ...emptyCertificateAmounts(), ...amounts },
  };
}
