import {
  RetirementCheckFailedException,
  RetirementImportedReadonlyException,
  RetirementNotImportedException,
  RetirementRecordNotFoundException,
  RetirementStatutoryExistsException,
  RetirementValidationException,
} from './retirement.exceptions';

describe('retirement exceptions', () => {
  it('maps validation issues to field names and codes only', () => {
    const e = new RetirementValidationException([
      { field: 'figures.guaranteedMonthly', code: 'INVALID_AMOUNT' },
    ]);
    expect(e.getStatus()).toBe(400);
    expect(e.getResponse()).toMatchObject({ error: 'RETIREMENT_VALIDATION' });
    expect(e.details).toEqual([{ field: 'figures.guaranteedMonthly', message: 'INVALID_AMOUNT' }]);
  });

  it.each(['UNKNOWN_FIELD', 'NOT_APPLICABLE'] as const)(
    'maps %s to RETIREMENT_UNKNOWN_FIELD',
    (code) => {
      const e = new RetirementValidationException([{ field: 'x', code }]);
      expect(e.getResponse()).toMatchObject({ error: 'RETIREMENT_UNKNOWN_FIELD' });
    },
  );

  it('lists failed check ids only', () => {
    const e = new RetirementCheckFailedException(['STATUTORY_ORDER']);
    expect(e.getStatus()).toBe(400);
    expect(e.getResponse()).toMatchObject({ error: 'RETIREMENT_CHECK_FAILED' });
    expect(e.details).toEqual([{ field: 'STATUTORY_ORDER', message: 'CHECK_FAILED' }]);
  });

  it('uses the documented statuses and codes', () => {
    const cases: [{ getStatus(): number; getResponse(): unknown }, number, string][] = [
      [new RetirementRecordNotFoundException(), 404, 'RETIREMENT_RECORD_NOT_FOUND'],
      [new RetirementImportedReadonlyException(), 409, 'RETIREMENT_IMPORTED_READONLY'],
      [new RetirementNotImportedException(), 409, 'RETIREMENT_NOT_IMPORTED'],
      [new RetirementStatutoryExistsException(), 409, 'RETIREMENT_STATUTORY_EXISTS'],
    ];
    for (const [e, status, code] of cases) {
      expect(e.getStatus()).toBe(status);
      expect(e.getResponse()).toMatchObject({ error: code });
    }
  });
});
