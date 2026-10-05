import Decimal from 'decimal.js';
import { daysInMonth, formatDate, parseDate } from './dates';
import type { Contract, PaymentInterval } from './model';

const PER_YEAR: Record<PaymentInterval, 12 | 4 | 2 | 1> = {
  MONTHLY: 12,
  QUARTERLY: 4,
  HALF_YEARLY: 2,
  YEARLY: 1,
};

export function paymentsPerYear(interval: PaymentInterval): 12 | 4 | 2 | 1 {
  return PER_YEAR[interval];
}

type PremiumFields = Pick<Contract, 'premium' | 'interval'>;

export function yearlyCost(contract: PremiumFields): Decimal {
  return new Decimal(contract.premium).times(paymentsPerYear(contract.interval));
}

export function monthlyCost(contract: PremiumFields): Decimal {
  return yearlyCost(contract).div(12);
}

/** Months (1..12) in which a premium is due; a missing payment month falls back to the start month. */
export function paymentMonths(
  contract: Pick<Contract, 'interval' | 'paymentMonth' | 'startDate'>,
): number[] {
  if (contract.interval === 'MONTHLY') return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const first = contract.paymentMonth ?? parseDate(contract.startDate).m;
  const step = 12 / paymentsPerYear(contract.interval);
  const months: number[] = [];
  for (let k = 0; k < paymentsPerYear(contract.interval); k++)
    months.push(((first - 1 + k * step) % 12) + 1);
  return months.sort((a, b) => a - b);
}

type TermFields = Pick<Contract, 'status' | 'startDate' | 'endDate'>;

/** The contract costs money on `date`: it has started and neither ended nor been deactivated without end date. */
export function isActiveOn(contract: TermFields, date: string): boolean {
  if (contract.startDate > date) return false;
  if (contract.endDate) return contract.endDate >= date;
  return contract.status === 'ACTIVE';
}

export function isActiveIn(contract: TermFields, year: number, month: number): boolean {
  const first = formatDate(year, month, 1);
  const last = formatDate(year, month, daysInMonth(year, month));
  if (contract.startDate > last) return false;
  if (contract.endDate) return contract.endDate >= first;
  return contract.status === 'ACTIVE';
}

/** Monthly cost rounded once for display (`ROUND_HALF_UP`, two digits). */
export function monthlyCostText(contract: PremiumFields): string {
  return monthlyCost(contract).toFixed(2, Decimal.ROUND_HALF_UP);
}

/** Yearly cost rounded once for display (`ROUND_HALF_UP`, two digits). */
export function yearlyCostText(contract: PremiumFields): string {
  return yearlyCost(contract).toFixed(2, Decimal.ROUND_HALF_UP);
}

/** Yearly equivalent of a monthly amount, rounded once for display. */
export function yearlyOfMonthly(monthly: string): string {
  return new Decimal(monthly).times(12).toFixed(2, Decimal.ROUND_HALF_UP);
}
