import Decimal from 'decimal.js';
import { oneOffOf, parseMoney, type StoredRecord, toMoney } from '../model';

/** Every summed figure of a set of records (exact decimals, formatted only at the edge). */
export interface Totals {
  gross: Decimal;
  regular: Decimal;
  bonus: Decimal;
  taxGross: Decimal;
  wageTax: Decimal;
  soli: Decimal;
  churchTax: Decimal;
  taxes: Decimal;
  health: Decimal;
  care: Decimal;
  pension: Decimal;
  unemployment: Decimal;
  social: Decimal;
  net: Decimal;
  payout: Decimal;
}

export function emptyTotals(): Totals {
  const z = new Decimal(0);
  return {
    gross: z,
    regular: z,
    bonus: z,
    taxGross: z,
    wageTax: z,
    soli: z,
    churchTax: z,
    taxes: z,
    health: z,
    care: z,
    pension: z,
    unemployment: z,
    social: z,
    net: z,
    payout: z,
  };
}

/**
 * Totals of records: `regular = gross − oneOff.gross`, `bonus = oneOff.gross`,
 * `taxes = wageTax + soli + churchTax`, `social = health + care + pension + unemployment`
 * (data-model.md "Derived read models").
 */
export function totalsOf(records: readonly StoredRecord[]): Totals {
  const t = emptyTotals();
  for (const r of records) {
    const a = r.amounts;
    const m = (v: string) => parseMoney(v);
    const bonus = m(oneOffOf(a, 'gross'));
    t.gross = t.gross.plus(m(a.gross));
    t.bonus = t.bonus.plus(bonus);
    t.regular = t.regular.plus(m(a.gross).minus(bonus));
    t.taxGross = t.taxGross.plus(m(a.taxGross));
    for (const k of ['wageTax', 'soli', 'churchTax'] as const) {
      t[k] = t[k].plus(m(a[k]));
      t.taxes = t.taxes.plus(m(a[k]));
    }
    for (const k of ['health', 'care', 'pension', 'unemployment'] as const) {
      t[k] = t[k].plus(m(a[k]));
      t.social = t.social.plus(m(a[k]));
    }
    t.net = t.net.plus(m(a.net));
    if (a.payout !== null) t.payout = t.payout.plus(m(a.payout));
  }
  return t;
}

export function money(value: Decimal): string {
  return toMoney(value);
}

/** `numerator / denominator` to 4 dp; `"0.0000"` when the denominator is zero. */
export function ratioOf(numerator: Decimal, denominator: Decimal): string {
  if (denominator.isZero()) return '0.0000';
  const r = numerator.dividedBy(denominator).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  return r.isZero() ? '0.0000' : r.toFixed(4);
}

/** Totals divided by `count`, as money; zero for a zero count. */
export function perMonth(value: Decimal, count: number): string {
  return count === 0 ? '0.00' : toMoney(value.dividedBy(count));
}

/** Distinct periods with a REGULAR record with positive gross (payout-only months excluded). */
export function employedPeriods(records: readonly StoredRecord[]): string[] {
  const set = new Set(
    records
      .filter((r) => r.kind === 'REGULAR' && parseMoney(r.amounts.gross).greaterThan(0))
      .map((r) => r.period),
  );
  return [...set].sort();
}

export function groupBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k) ?? [];
    list.push(item);
    map.set(k, list);
  }
  return map;
}
