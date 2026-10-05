import Decimal from 'decimal.js';
import {
  SOCIAL_TYPE_BY_KIND,
  type InsuranceContract,
  type LinkedSocialLine,
  type SocialKind,
} from './model';

/** Minimal structural view of an Earnings pay record (the backend maps its stored record to this). */
export interface EarningsRecordLike {
  /** `YYYY-MM`. */
  period: string;
  amounts: {
    health: string;
    care: string;
    pension: string;
    unemployment: string;
    oneOff?: Partial<Record<'health' | 'care' | 'pension' | 'unemployment', string>>;
  };
}

const KINDS: { kind: SocialKind; key: 'health' | 'care' | 'pension' | 'unemployment' }[] = [
  { kind: 'HEALTH', key: 'health' },
  { kind: 'CARE', key: 'care' },
  { kind: 'PENSION', key: 'pension' },
  { kind: 'UNEMPLOYMENT', key: 'unemployment' },
];

/** Regular employee contribution of the latest period that has records, summed over all records of it. */
export function linkedLinesFromEarnings(
  records: readonly EarningsRecordLike[],
): LinkedSocialLine[] {
  if (records.length === 0) return [];
  const latest = records.reduce((max, r) => (r.period > max ? r.period : max), records[0].period);
  const inPeriod = records.filter((r) => r.period === latest);
  const lines: LinkedSocialLine[] = [];
  for (const { kind, key } of KINDS) {
    const total = inPeriod.reduce(
      (sum, r) => sum.plus(r.amounts[key]).minus(r.amounts.oneOff?.[key] ?? 0),
      new Decimal(0),
    );
    if (total.gt(0))
      lines.push({ kind, monthly: total.toFixed(2, Decimal.ROUND_HALF_UP), period: latest });
  }
  return lines;
}

/** Drops linked lines suppressed by a manual contract of the same statutory type that is not deactivated. */
export function effectiveSocialLines(
  contracts: readonly Pick<InsuranceContract, 'type' | 'status'>[],
  linked: readonly LinkedSocialLine[],
): LinkedSocialLine[] {
  return linked.filter(
    (line) =>
      !contracts.some((c) => c.type === SOCIAL_TYPE_BY_KIND[line.kind] && c.status === 'ACTIVE'),
  );
}
