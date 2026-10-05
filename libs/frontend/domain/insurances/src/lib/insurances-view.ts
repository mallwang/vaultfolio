import type { InsuranceContract, InsuranceLinkedSocialLine } from '@vaultfolio/api-contract';
import {
  type CancellationInfo,
  type Classification,
  type GapResult,
  type InsuranceGroup,
  type InsuranceTypeId,
  type PaymentInterval,
  SOCIAL_TYPE_BY_KIND,
  daysBetween,
  isActiveOn,
  monthlyCostText,
  nextCancellationDate,
  typeDef,
  yearlyCostText,
  yearlyOfMonthly,
} from '@vaultfolio/insurances';
import { fill, formatDateShort } from './insurances-format';

/** One line of the contract list: a manual contract or a read-only linked statutory line. */
export interface ContractRow {
  id: string;
  kind: 'CONTRACT' | 'LINKED';
  contract?: InsuranceContract;
  linked?: InsuranceLinkedSocialLine;
  typeId: InsuranceTypeId;
  group: InsuranceGroup;
  classification: Classification;
  name: string;
  insurer?: string;
  premium: string;
  interval: PaymentInterval;
  monthly: string;
  yearly: string;
  active: boolean;
  info: CancellationInfo;
  /** `YYYY-MM-DD` of the deadline, for sorting; empty without one. */
  deadline: string;
  daysLeft: number | null;
  withinWindow: boolean;
  overlap: boolean;
  /** Combined `alsoCovers`-style hint of the key detail (licence plate, coverage sum, …). */
  detail?: string;
}

export type Translate = (key: string, params?: Record<string, string | number>) => string;

const NO_INFO: CancellationInfo = { kind: 'NONE' };

export function buildRows(input: {
  contracts: readonly InsuranceContract[];
  linked: readonly InsuranceLinkedSocialLine[];
  gaps: GapResult;
  today: string;
  warnDays: number;
  t: Translate;
}): ContractRow[] {
  const { today, warnDays, t } = input;
  const overlapIds = new Set(
    input.gaps.redundant.flatMap((r) => [r.contractId, r.otherContractId]),
  );

  const rows: ContractRow[] = input.contracts.map((contract) => {
    const def = typeDef(contract.type);
    const info = def.social ? NO_INFO : nextCancellationDate(contract, today);
    const daysLeft = info.kind === 'DEADLINE' ? daysBetween(today, info.date) : null;
    return {
      id: contract.id,
      kind: 'CONTRACT',
      contract,
      typeId: contract.type,
      group: def.group,
      classification: def.classification,
      name: contract.name,
      insurer: contract.insurer,
      premium: contract.premium,
      interval: contract.interval,
      monthly: monthlyCostText(contract),
      yearly: yearlyCostText(contract),
      active: isActiveOn(contract, today),
      info,
      deadline: info.kind === 'DEADLINE' ? info.date : '',
      daysLeft,
      withinWindow: daysLeft !== null && daysLeft <= warnDays,
      overlap: overlapIds.has(contract.id),
      detail: detailOf(contract),
    };
  });

  for (const line of input.linked) {
    const typeId = SOCIAL_TYPE_BY_KIND[line.kind];
    const def = typeDef(typeId);
    rows.push({
      id: `linked-${line.kind}`,
      kind: 'LINKED',
      linked: line,
      typeId,
      group: def.group,
      classification: def.classification,
      name: t(`insurances.social.${line.kind}`),
      premium: line.monthly,
      interval: 'MONTHLY',
      monthly: line.monthly,
      yearly: yearlyOfMonthly(line.monthly),
      active: true,
      info: NO_INFO,
      deadline: '',
      daysLeft: null,
      withinWindow: false,
      overlap: false,
    });
  }
  return rows;
}

function detailOf(contract: InsuranceContract): string | undefined {
  const d = contract.details;
  if (!d) return undefined;
  return d.licensePlate ?? d.noClaimsClass ?? undefined;
}

/** Text of the next-cancellation cell. */
export function cancellationLabel(info: CancellationInfo, t: Translate, lang: string): string {
  switch (info.kind) {
    case 'DEADLINE':
      return t('insurances.cancellation.deadline', { date: formatDateShort(info.date, lang) });
    case 'ENDS':
      return t('insurances.cancellation.ends', { date: formatDateShort(info.date, lang) });
    case 'ANYTIME':
      return info.period
        ? t('insurances.cancellation.anytimeWith', {
            period: fill(t('insurances.cancellation.period'), {
              value: info.period.value,
              unit: t(`insurances.units.${info.period.unit}`),
            }),
          })
        : t('insurances.cancellation.anytime');
    default:
      return t('insurances.cancellation.none');
  }
}

export function daysLeftLabel(days: number, t: Translate): string {
  return days === 0
    ? t('insurances.cancellation.today')
    : t('insurances.cancellation.daysLeft', { days });
}
