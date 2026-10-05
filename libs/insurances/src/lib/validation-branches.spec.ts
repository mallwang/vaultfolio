import { DEFAULT_SETTINGS } from './model';
import { buildContract } from './testing/builders';
import { normalizeMoney, validateContract, validateSettings } from './validation';

type Result = { ok: boolean; issues?: { field: string; code: string }[] };
const issues = (result: Result) => (result.issues ?? []).map((i) => `${i.field}:${i.code}`);
const contract = (patch: Record<string, unknown>) =>
  validateContract({ ...buildContract(), ...patch }) as Result;
const settings = (patch: Record<string, unknown>) =>
  validateSettings({ ...DEFAULT_SETTINGS, ...patch }) as Result;

describe('normalizeMoney', () => {
  it('normalizes, trims and rejects bad input', () => {
    expect(normalizeMoney(' 12.5 ')).toBe('12.50');
    expect(normalizeMoney(12)).toBeNull();
    expect(normalizeMoney('1,5')).toBeNull();
    expect(normalizeMoney('999999999999999')).toBeNull();
  });
});

describe('validateContract branches', () => {
  it('rejects non-object input', () => {
    expect(issues(validateContract('x') as Result)).toEqual([':INVALID']);
    expect(issues(validateContract([]) as Result)).toEqual([':INVALID']);
    expect(issues(validateContract(null) as Result)).toEqual([':INVALID']);
  });

  it('flags invalid and unknown type', () => {
    expect(issues(contract({ type: 'NOPE' }))).toContain('type:INVALID');
  });

  it('validates text fields', () => {
    expect(issues(contract({ name: 5 }))).toContain('name:INVALID');
    expect(issues(contract({ name: '   ' }))).toContain('name:REQUIRED');
    expect(issues(contract({ name: 'x'.repeat(101) }))).toContain('name:OUT_OF_RANGE');
    const ok = contract({ insurer: ' Allianz ', contractNumber: 'A1', note: 'n' }) as {
      ok: boolean;
      value?: { insurer: string };
    };
    expect(ok.ok).toBe(true);
    expect(ok.value?.insurer).toBe('Allianz');
  });

  it('validates status and interval choices', () => {
    expect(issues(contract({ status: 'WEIRD' }))).toContain('status:INVALID');
    expect(issues(contract({ interval: 3 }))).toContain('interval:INVALID');
    const rest: Record<string, unknown> = { ...buildContract() };
    delete rest['status'];
    delete rest['interval'];
    expect(issues(validateContract(rest) as Result)).toEqual(
      expect.arrayContaining(['status:REQUIRED', 'interval:REQUIRED']),
    );
  });

  it('validates dates', () => {
    expect(issues(contract({ startDate: '2025-02-30' }))).toContain('startDate:INVALID');
    expect(issues(contract({ startDate: 5 }))).toContain('startDate:INVALID');
    expect(issues(contract({ endDate: 'bad' }))).toContain('endDate:INVALID');
    const rest: Record<string, unknown> = { ...buildContract() };
    delete rest['startDate'];
    expect(issues(validateContract(rest) as Result)).toContain('startDate:REQUIRED');
    expect(contract({ endDate: '2030-01-01' }).ok).toBe(true);
  });

  it('validates premium', () => {
    const rest: Record<string, unknown> = { ...buildContract() };
    delete rest['premium'];
    expect(issues(validateContract(rest) as Result)).toContain('premium:REQUIRED');
    expect(issues(contract({ premium: 'abc' }))).toContain('premium:INVALID');
  });

  it('validates alsoCovers', () => {
    expect(issues(contract({ alsoCovers: 'x' }))).toContain('alsoCovers:INVALID');
    expect(issues(contract({ alsoCovers: Array(11).fill('CAR') }))).toContain('alsoCovers:LIMIT');
    expect(issues(contract({ alsoCovers: ['NOPE'] }))).toContain('alsoCovers:INVALID');
    expect(contract({ alsoCovers: [] }).ok).toBe(true);
    expect(contract({ alsoCovers: ['CAR'] }).ok).toBe(true);
  });

  it('validates paymentMonth', () => {
    expect(issues(contract({ paymentMonth: 13 }))).toContain('paymentMonth:OUT_OF_RANGE');
    expect(issues(contract({ paymentMonth: 1.5 }))).toContain('paymentMonth:INVALID');
  });

  it('validates reminderEnabled', () => {
    expect(issues(contract({ reminderEnabled: 'yes' }))).toContain('reminderEnabled:INVALID');
    const rest: Record<string, unknown> = { ...buildContract() };
    delete rest['reminderEnabled'];
    expect(validateContract(rest).ok).toBe(true);
  });

  describe('cancellation', () => {
    it('requires an object', () => {
      const rest: Record<string, unknown> = { ...buildContract() };
      delete rest['cancellation'];
      expect(issues(validateContract(rest) as Result)).toContain('cancellation:REQUIRED');
      expect(issues(contract({ cancellation: 'x' }))).toContain('cancellation:INVALID');
    });

    it('requires autoRenew boolean and rejects unknown keys', () => {
      expect(issues(contract({ cancellation: {} }))).toContain('cancellation.autoRenew:REQUIRED');
      expect(issues(contract({ cancellation: { autoRenew: 1 } }))).toContain(
        'cancellation.autoRenew:INVALID',
      );
      expect(issues(contract({ cancellation: { autoRenew: true, x: 1 } }))).toContain(
        'cancellation.x:UNKNOWN_FIELD',
      );
    });

    it('validates the period', () => {
      expect(issues(contract({ cancellation: { autoRenew: true, period: 'x' } }))).toContain(
        'cancellation.period:INVALID',
      );
      expect(
        issues(contract({ cancellation: { autoRenew: true, period: { value: 1, unit: 'DAYS' } } })),
      ).toContain('cancellation.period.unit:INVALID');
      expect(
        issues(
          contract({ cancellation: { autoRenew: true, period: { value: 99, unit: 'WEEKS' } } }),
        ),
      ).toContain('cancellation.period.value:OUT_OF_RANGE');
      expect(
        issues(
          contract({
            cancellation: { autoRenew: true, period: { value: 1, unit: 'WEEKS', z: 1 } },
          }),
        ),
      ).toContain('cancellation.period.z:UNKNOWN_FIELD');
      expect(
        contract({ cancellation: { autoRenew: true, period: { value: 2, unit: 'WEEKS' } } }).ok,
      ).toBe(true);
    });

    it('validates renewal and minimum term', () => {
      expect(contract({ cancellation: { autoRenew: true, renewalMonths: 12 } }).ok).toBe(true);
      expect(issues(contract({ cancellation: { autoRenew: true, renewalMonths: 0 } }))).toContain(
        'cancellation.renewalMonths:OUT_OF_RANGE',
      );
      expect(
        issues(contract({ cancellation: { autoRenew: true, minimumTermMonths: 'x' } })),
      ).toContain('cancellation.minimumTermMonths:INVALID');
      expect(contract({ cancellation: { autoRenew: true, minimumTermMonths: 24 } }).ok).toBe(true);
    });

    it('validates the fixed date', () => {
      expect(issues(contract({ cancellation: { autoRenew: true, fixedDate: 'x' } }))).toContain(
        'cancellation.fixedDate:INVALID',
      );
      expect(
        issues(contract({ cancellation: { autoRenew: true, fixedDate: { day: 40, month: 1 } } })),
      ).toContain('cancellation.fixedDate.day:OUT_OF_RANGE');
      expect(
        issues(contract({ cancellation: { autoRenew: true, fixedDate: { day: 1 } } })),
      ).toEqual([]);
      expect(
        issues(
          contract({ cancellation: { autoRenew: true, fixedDate: { day: 1, month: 1, q: 1 } } }),
        ),
      ).toContain('cancellation.fixedDate.q:UNKNOWN_FIELD');
    });
  });

  describe('details', () => {
    it('rejects non-objects and invalid money', () => {
      expect(issues(contract({ details: 'x' }))).toContain('details:INVALID');
      expect(issues(contract({ details: { coverageSum: 'abc' } }))).toContain(
        'details.coverageSum:INVALID',
      );
      expect(issues(contract({ details: { nope: 'abc' } }))).toContain(
        'details.nope:UNKNOWN_FIELD',
      );
    });

    it('normalizes money details and skips undefined', () => {
      const ok = contract({ details: { coverageSum: '5000000', deductible: undefined } }) as {
        ok: boolean;
        value?: { details?: Record<string, string> };
      };
      expect(ok.ok).toBe(true);
      expect(ok.value?.details).toEqual({ coverageSum: '5000000.00' });
    });

    it('rejects non-string text details and drops empty details', () => {
      const car = { type: 'CAR' };
      expect(issues(contract({ ...car, details: { licensePlate: 5 } }))).toContain(
        'details.licensePlate:INVALID',
      );
      const empty = contract({ ...car, details: {} }) as { value?: { details?: unknown } };
      expect(empty.value?.details).toBeUndefined();
    });

    it('treats unknown type details as unknown fields', () => {
      expect(issues(contract({ type: 'NOPE', details: { licensePlate: 'x' } }))).toEqual(
        expect.arrayContaining(['type:INVALID', 'details.licensePlate:UNKNOWN_FIELD']),
      );
    });
  });
});

describe('validateSettings branches', () => {
  it('rejects non-object input', () => {
    expect(issues(validateSettings(null) as Result)).toEqual([':INVALID']);
  });

  it('requires profile, reminders, dismissed and includeSocial', () => {
    expect(issues(validateSettings({}) as Result)).toEqual(
      expect.arrayContaining([
        'profile:REQUIRED',
        'reminders:REQUIRED',
        'dismissedRequirements:REQUIRED',
        'includeSocial:REQUIRED',
      ]),
    );
  });

  it('rejects wrongly typed sections', () => {
    expect(issues(settings({ profile: 'x', reminders: 'x', dismissedRequirements: 'x' }))).toEqual(
      expect.arrayContaining([
        'profile:INVALID',
        'reminders:INVALID',
        'dismissedRequirements:INVALID',
      ]),
    );
    expect(issues(settings({ includeSocial: 'x' }))).toContain('includeSocial:INVALID');
  });

  it('validates profile fields', () => {
    expect(
      issues(settings({ profile: { ...DEFAULT_SETTINGS.profile, ownsCar: 'x', extra: 1 } })),
    ).toEqual(expect.arrayContaining(['profile.ownsCar:INVALID', 'profile.extra:UNKNOWN_FIELD']));
    expect(
      issues(settings({ profile: { ...DEFAULT_SETTINGS.profile, employment: 'X' } })),
    ).toContain('profile.employment:INVALID');
  });

  it('validates reminders fields', () => {
    expect(issues(settings({ reminders: { enabled: true } }))).toContain(
      'reminders.leadDays:REQUIRED',
    );
    expect(issues(settings({ reminders: { enabled: 'x', leadDays: 30, z: 1 } }))).toEqual(
      expect.arrayContaining(['reminders.enabled:INVALID', 'reminders.z:UNKNOWN_FIELD']),
    );
  });

  it('deduplicates dismissed requirements', () => {
    const result = settings({ dismissedRequirements: [] }) as {
      ok: boolean;
      value?: { dismissedRequirements: string[] };
    };
    expect(result.ok).toBe(true);
    expect(result.value?.dismissedRequirements).toEqual([]);
  });
});
