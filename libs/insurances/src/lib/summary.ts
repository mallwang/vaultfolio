import Decimal from 'decimal.js';
import { isSocialType, typeDef } from './catalog';
import { daysBetween, parseDate } from './dates';
import { nextCancellationDate } from './deadline';
import type { Classification, InsuranceContract, InsuranceGroup, LinkedSocialLine } from './model';
import { isActiveIn, isActiveOn, monthlyCost, paymentMonths, yearlyCost } from './premium';
import { effectiveSocialLines } from './social';

export interface SummaryInput {
  contracts: readonly InsuranceContract[];
  linkedSocial: readonly LinkedSocialLine[];
  includeSocial: boolean;
  year: number;
  today: string;
  warnDays: number;
}

export interface UpcomingDeadline {
  id: string;
  name: string;
  date: string;
  daysLeft: number;
  withinWindow: boolean;
}

export interface Summary {
  monthlyPrivate: string;
  yearlyPrivate: string;
  monthlyStatutory: string;
  yearlyStatutory: string;
  monthlyTotal: string;
  yearlyTotal: string;
  activeCount: number;
  statutoryCount: number;
  byGroup: { group: InsuranceGroup; yearly: string; share: number }[];
  timeline: { month: number; amount: string }[];
  upcoming: UpcomingDeadline[];
}

const fmt = (value: Decimal) => value.toFixed(2, Decimal.ROUND_HALF_UP);

/** Totals are summed unrounded and rounded once at the edge. */
export function summarize(input: SummaryInput): Summary {
  const { contracts, includeSocial, year, today, warnDays } = input;
  const linked = includeSocial ? effectiveSocialLines(contracts, input.linkedSocial) : [];

  const counted = contracts.filter((c) => includeSocial || !isSocialType(c.type));
  const active = counted.filter((c) => isActiveOn(c, today));

  let monthlyPrivate = new Decimal(0);
  let monthlyStatutory = new Decimal(0);
  let statutoryCount = linked.length;
  let activeCount = 0;
  const groupYearly = new Map<InsuranceGroup, Decimal>();
  const add = (group: InsuranceGroup, yearly: Decimal) =>
    groupYearly.set(group, (groupYearly.get(group) ?? new Decimal(0)).plus(yearly));

  for (const c of active) {
    if (isSocialType(c.type)) {
      monthlyStatutory = monthlyStatutory.plus(monthlyCost(c));
      statutoryCount += 1;
    } else {
      monthlyPrivate = monthlyPrivate.plus(monthlyCost(c));
      activeCount += 1;
    }
    add(typeDef(c.type).group, yearlyCost(c));
  }
  for (const line of linked) {
    monthlyStatutory = monthlyStatutory.plus(line.monthly);
    add('PERSONS', new Decimal(line.monthly).times(12));
  }

  const totalYearly = [...groupYearly.values()].reduce((s, v) => s.plus(v), new Decimal(0));
  const byGroup = [...groupYearly.entries()]
    .filter(([, v]) => v.gt(0))
    .sort((a, b) => b[1].comparedTo(a[1]))
    .map(([group, yearly]) => ({
      group,
      yearly: fmt(yearly),
      share: totalYearly.gt(0)
        ? yearly.div(totalYearly).times(100).toDecimalPlaces(1).toNumber()
        : 0,
    }));

  const timeline = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    let amount = new Decimal(0);
    for (const c of counted) {
      if (isActiveIn(c, year, month) && paymentMonths(c).includes(month))
        amount = amount.plus(c.premium);
    }
    for (const line of linked) amount = amount.plus(line.monthly);
    return { month, amount: fmt(amount) };
  });

  const upcoming: UpcomingDeadline[] = [];
  for (const c of contracts) {
    if (isSocialType(c.type)) continue;
    const info = nextCancellationDate(c, today);
    if (info.kind !== 'DEADLINE') continue;
    const daysLeft = daysBetween(today, info.date);
    upcoming.push({
      id: c.id,
      name: c.name,
      date: info.date,
      daysLeft,
      withinWindow: daysLeft <= warnDays,
    });
  }
  upcoming.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));

  return {
    monthlyPrivate: fmt(monthlyPrivate),
    yearlyPrivate: fmt(monthlyPrivate.times(12)),
    monthlyStatutory: fmt(monthlyStatutory),
    yearlyStatutory: fmt(monthlyStatutory.times(12)),
    monthlyTotal: fmt(monthlyPrivate.plus(monthlyStatutory)),
    yearlyTotal: fmt(monthlyPrivate.plus(monthlyStatutory).times(12)),
    activeCount,
    statutoryCount,
    byGroup,
    timeline,
    upcoming,
  };
}

export function classificationOf(contract: Pick<InsuranceContract, 'type'>): Classification {
  return typeDef(contract.type).classification;
}

export function yearOf(date: string): number {
  return parseDate(date).y;
}
