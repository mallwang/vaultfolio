import { addDays, addMonths, dateInYear, parseDate } from './dates';
import type { CancellationInfo, Contract } from './model';

const MAX_TERMS = 2000;

type Period = NonNullable<Contract['cancellation']['period']>;

function subtractPeriod(termEnd: string, period: Period | undefined): string {
  if (!period) return termEnd;
  return period.unit === 'WEEKS'
    ? addDays(termEnd, -7 * period.value)
    : addMonths(termEnd, -period.value);
}

/** Latest occurrence of day/month on or before `termEnd`. */
function fixedDeadlineFor(termEnd: string, fixed: { day: number; month: number }): string {
  const year = parseDate(termEnd).y;
  const candidate = dateInYear(year, fixed.day, fixed.month);
  return candidate <= termEnd ? candidate : dateInYear(year - 1, fixed.day, fixed.month);
}

function deadlineOf(termEnd: string, c: Contract['cancellation']): string {
  return c.fixedDate ? fixedDeadlineFor(termEnd, c.fixedDate) : subtractPeriod(termEnd, c.period);
}

/** First term end: the explicit end date, else start + minimum term (default 12 months) − 1 day. */
function firstTermEnd(contract: Contract): string {
  if (contract.endDate) return contract.endDate;
  return addDays(addMonths(contract.startDate, contract.cancellation.minimumTermMonths ?? 12), -1);
}

/** Next possible cancellation date derived from term data; pure — same input, same output. */
export function nextCancellationDate(contract: Contract, today: string): CancellationInfo {
  if (contract.status !== 'ACTIVE') return { kind: 'NONE' };
  const c = contract.cancellation;

  if (!c.autoRenew) {
    if (contract.endDate) {
      return contract.endDate >= today
        ? { kind: 'ENDS', date: contract.endDate }
        : { kind: 'NONE' };
    }
    if (c.minimumTermMonths) {
      const termEnd = firstTermEnd(contract);
      const deadline = deadlineOf(termEnd, c);
      if (deadline >= today) return { kind: 'DEADLINE', date: deadline, termEnd };
    }
    return { kind: 'ANYTIME', period: c.period };
  }

  const anchor = firstTermEnd(contract);
  const step = c.renewalMonths ?? 12;
  for (let k = 0; k < MAX_TERMS; k++) {
    const termEnd = addMonths(anchor, k * step);
    const deadline = deadlineOf(termEnd, c);
    if (deadline >= today) return { kind: 'DEADLINE', date: deadline, termEnd };
  }
  return { kind: 'NONE' };
}
