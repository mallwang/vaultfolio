import { DEFAULT_SETTINGS } from './model';
import { validateContract, validateSettings } from './validation';
import { buildContract } from './testing/builders';

const fields = (result: ReturnType<typeof validateContract>) =>
  result.ok ? [] : result.issues.map((i) => `${i.field}:${i.code}`);

describe('validateContract', () => {
  it('accepts a valid contract and normalizes money', () => {
    const result = validateContract(buildContract({ premium: '96.5' }));
    expect(result.ok && result.value.premium).toBe('96.50');
  });

  it('rejects unknown fields', () => {
    expect(fields(validateContract({ ...buildContract(), extra: 1 }))).toContain(
      'extra:UNKNOWN_FIELD',
    );
  });

  it('rejects negative premium', () => {
    expect(fields(validateContract(buildContract({ premium: '-1' })))).toContain('premium:INVALID');
  });

  it('rejects end before start', () => {
    expect(fields(validateContract(buildContract({ endDate: '2024-12-31' })))).toContain(
      'endDate:DATE_ORDER',
    );
  });

  it('requires name and type', () => {
    const rest: Record<string, unknown> = { ...buildContract() };
    delete rest['name'];
    delete rest['type'];
    expect(fields(validateContract(rest))).toEqual(
      expect.arrayContaining(['name:REQUIRED', 'type:REQUIRED']),
    );
  });

  it('allows paymentMonth only for non-monthly intervals', () => {
    expect(
      fields(validateContract(buildContract({ interval: 'MONTHLY', paymentMonth: 3 }))),
    ).toContain('paymentMonth:INVALID');
    expect(validateContract(buildContract({ interval: 'YEARLY', paymentMonth: 3 })).ok).toBe(true);
  });

  it('accepts 29.02. and rejects 30.02. as fixed date', () => {
    const fixed = (day: number, month: number) =>
      buildContract({ cancellation: { autoRenew: true, fixedDate: { day, month } } });
    expect(validateContract(fixed(29, 2)).ok).toBe(true);
    expect(fields(validateContract(fixed(30, 2)))).toContain('cancellation.fixedDate.day:INVALID');
  });

  it('rejects alsoCovers with the own type or duplicates', () => {
    expect(
      fields(validateContract(buildContract({ alsoCovers: ['PRIVATE_LIABILITY'] }))),
    ).toContain('alsoCovers:INVALID');
    expect(fields(validateContract(buildContract({ alsoCovers: ['CAR', 'CAR'] })))).toContain(
      'alsoCovers:INVALID',
    );
  });

  it('allows social types only monthly', () => {
    expect(
      fields(validateContract(buildContract({ type: 'STATUTORY_HEALTH', interval: 'YEARLY' }))),
    ).toContain('interval:INVALID');
  });

  it('allows detail keys per type only', () => {
    expect(
      validateContract(buildContract({ type: 'CAR', details: { licensePlate: 'B-AB 123' } })).ok,
    ).toBe(true);
    expect(
      fields(
        validateContract(
          buildContract({ type: 'PRIVATE_LIABILITY', details: { licensePlate: 'x' } }),
        ),
      ),
    ).toContain('details.licensePlate:UNKNOWN_FIELD');
  });

  it('allows renewalMonths only with autoRenew', () => {
    expect(
      fields(
        validateContract(buildContract({ cancellation: { autoRenew: false, renewalMonths: 12 } })),
      ),
    ).toContain('cancellation.renewalMonths:INVALID');
  });

  it('never echoes values in issues', () => {
    const result = validateContract(buildContract({ name: 'Secret', premium: 'abc' }));
    expect(JSON.stringify(result)).not.toContain('Secret');
  });
});

describe('validateSettings', () => {
  it('accepts the defaults', () => {
    expect(validateSettings(DEFAULT_SETTINGS).ok).toBe(true);
  });

  it('rejects lead days out of range', () => {
    const result = validateSettings({
      ...DEFAULT_SETTINGS,
      reminders: { enabled: true, leadDays: 3 },
    });
    expect(!result.ok && result.issues[0]).toEqual({
      field: 'reminders.leadDays',
      code: 'OUT_OF_RANGE',
    });
  });

  it('rejects unknown requirement ids and unknown fields', () => {
    const result = validateSettings({
      ...DEFAULT_SETTINGS,
      dismissedRequirements: ['NOPE'],
      extra: true,
    });
    expect(!result.ok && result.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(['UNKNOWN_FIELD', 'INVALID']),
    );
  });

  it('rejects more than 50 dismissals', () => {
    const many = Array.from({ length: 51 }, () => 'HEALTH');
    const result = validateSettings({ ...DEFAULT_SETTINGS, dismissedRequirements: many });
    expect(!result.ok && result.issues[0].code).toBe('LIMIT');
  });
});
