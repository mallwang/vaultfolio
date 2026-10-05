import type { InsuranceContract, InsuranceLinkedSocialLine } from '@vaultfolio/api-contract';
import {
  type CancellationInfo,
  type Classification,
  type GapResult,
  type InsuranceGroup,
  type InsuranceTypeId,
  type PaymentInterval,
  REQUIREMENTS,
  type RequirementId,
  SOCIAL_TYPE_BY_KIND,
  daysBetween,
  isActiveOn,
  isSocialType,
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

/** Finanztip guide per gap-check requirement (general consumer information, opened in a new tab). */
export const FINANZTIP_URLS: Readonly<Record<RequirementId, string>> = {
  HEALTH: 'https://www.finanztip.de/krankenversicherung/',
  LIABILITY: 'https://www.finanztip.de/haftpflichtversicherung/privathaftpflicht/',
  HOUSEHOLD: 'https://www.finanztip.de/hausratversicherung/',
  DISABILITY: 'https://www.finanztip.de/berufsunfaehigkeitsversicherung/',
  BUILDING: 'https://www.finanztip.de/wohngebaeudeversicherungen/',
  NATURAL_HAZARD:
    'https://www.finanztip.de/wohngebaeudeversicherungen/elementarschadenversicherung/',
  CAR: 'https://www.finanztip.de/kfz-versicherung/',
  PET_LIABILITY: 'https://www.finanztip.de/haftpflichtversicherung/tierhalterhaftpflicht/',
  TRAVEL_HEALTH: 'https://www.finanztip.de/krankenversicherung/auslandsreisekrankenversicherung/',
  RISK_LIFE: 'https://www.finanztip.de/risikolebensversicherung/',
  LEGAL: 'https://www.finanztip.de/rechtsschutzversicherung/',
  PROPERTY_OWNER_LIABILITY:
    'https://www.finanztip.de/haftpflichtversicherung/haus-grundbesitzerhaftpflicht/',
};

/** Contract type the "jetzt eintragen" link preselects: the first type that satisfies the requirement. */
export function requirementTypeId(requirement: RequirementId): InsuranceTypeId {
  const def = REQUIREMENTS.find((r) => r.id === requirement);
  if (!def) throw new Error(`Unknown requirement ${requirement}`);
  return def.satisfiedBy[0];
}

export interface BreakdownItem {
  id: string;
  name: string;
  /** Canonical decimal string. */
  yearly: string;
}

export interface GroupBreakdown {
  group: InsuranceGroup;
  /** Canonical decimal string. */
  yearly: string;
  items: BreakdownItem[];
}

/** Yearly cost of the active rows per group and per contract, largest first. */
export function groupBreakdown(
  rows: readonly ContractRow[],
  includeSocial: boolean,
): GroupBreakdown[] {
  const byGroup = new Map<InsuranceGroup, BreakdownItem[]>();
  for (const row of rows) {
    if (!row.active || Number(row.yearly) <= 0) continue;
    if (!includeSocial && isSocialType(row.typeId)) continue;
    const items = byGroup.get(row.group) ?? [];
    items.push({ id: row.id, name: row.name, yearly: row.yearly });
    byGroup.set(row.group, items);
  }
  return [...byGroup.entries()]
    .map(([group, items]) => {
      items.sort((a, b) => Number(b.yearly) - Number(a.yearly));
      const total = items.reduce((sum, item) => sum + Number(item.yearly), 0);
      return { group, yearly: total.toFixed(2), items };
    })
    .sort((a, b) => Number(b.yearly) - Number(a.yearly));
}

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
