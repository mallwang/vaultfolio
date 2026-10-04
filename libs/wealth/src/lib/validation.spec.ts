import { buildEntry } from './testing/builders';
import { normalizeMoney, validateClassGroup, validateSnapshotInput } from './validation';

const TODAY = '2025-06-15';
const valid = () => ({ snapshotDate: '2025-06-01', entries: [buildEntry()] });

function issuesOf(input: unknown) {
  const result = validateSnapshotInput(input, TODAY);
  if (result.ok) throw new Error('expected rejection');
  return result.issues;
}

describe('validateSnapshotInput', () => {
  it('accepts a valid snapshot and normalizes amounts, names and note', () => {
    const result = validateSnapshotInput(
      {
        snapshotDate: '2025-06-01',
        note: '  Jahresende ',
        entries: [
          buildEntry({ name: ' Depot ', amount: '12000.5', class: { custom: ' Whisky ' } }),
        ],
      },
      TODAY,
    );
    expect(result).toEqual({
      ok: true,
      value: {
        snapshotDate: '2025-06-01',
        note: 'Jahresende',
        entries: [
          { side: 'ASSET', class: { custom: 'Whisky' }, name: 'Depot', amount: '12000.50' },
        ],
      },
    });
  });

  it('tolerates a date one day after today but not two', () => {
    expect(validateSnapshotInput({ ...valid(), snapshotDate: '2025-06-16' }, TODAY).ok).toBe(true);
    expect(issuesOf({ ...valid(), snapshotDate: '2025-06-17' })).toEqual([
      { field: 'snapshotDate', code: 'OUT_OF_RANGE' },
    ]);
  });

  it('rejects dates before 1900 and impossible dates', () => {
    expect(issuesOf({ ...valid(), snapshotDate: '1899-12-31' })[0].code).toBe('OUT_OF_RANGE');
    expect(issuesOf({ ...valid(), snapshotDate: '2025-02-30' })[0].code).toBe('INVALID_DATE');
    expect(issuesOf({ ...valid(), snapshotDate: 'yesterday' })[0].code).toBe('INVALID_DATE');
    expect(issuesOf({ entries: valid().entries })).toEqual([
      { field: 'snapshotDate', code: 'REQUIRED' },
    ]);
  });

  it('rejects unknown fields at every level', () => {
    const issues = issuesOf({
      ...valid(),
      owner: 'x',
      entries: [{ ...buildEntry(), id: 'e1', class: { standard: 'cash', extra: 1 } }],
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        { field: 'owner', code: 'UNKNOWN_FIELD' },
        { field: 'entries[0].id', code: 'UNKNOWN_FIELD' },
        { field: 'entries[0].class.extra', code: 'UNKNOWN_FIELD' },
      ]),
    );
  });

  it.each(['-1.00', '12,50', 'abc', '1.234', '', '1e3', '1000000000000.00'])(
    'rejects amount %p',
    (amount) => {
      const issues = issuesOf({ ...valid(), entries: [buildEntry({ amount })] });
      expect(issues).toHaveLength(1);
      expect(issues[0].field).toBe('entries[0].amount');
    },
  );

  it('accepts amount 0.00 and the maximum', () => {
    expect(
      validateSnapshotInput(
        {
          ...valid(),
          entries: [buildEntry({ amount: '0' }), buildEntry({ amount: '999999999999.99' })],
        },
        TODAY,
      ).ok,
    ).toBe(true);
  });

  it('rejects missing name, class and side', () => {
    const issues = issuesOf({ ...valid(), entries: [{ amount: '1.00' }] });
    expect(issues).toEqual(
      expect.arrayContaining([
        { field: 'entries[0].side', code: 'REQUIRED' },
        { field: 'entries[0].class', code: 'REQUIRED' },
        { field: 'entries[0].name', code: 'REQUIRED' },
      ]),
    );
  });

  it('rejects over-long name, custom class and note', () => {
    expect(
      issuesOf({
        snapshotDate: '2025-06-01',
        note: 'n'.repeat(501),
        entries: [buildEntry({ name: 'a'.repeat(101), class: { custom: 'c'.repeat(51) } })],
      }),
    ).toEqual(
      expect.arrayContaining([
        { field: 'note', code: 'TOO_LONG' },
        { field: 'entries[0].name', code: 'TOO_LONG' },
        { field: 'entries[0].class.custom', code: 'TOO_LONG' },
      ]),
    );
  });

  it('rejects zero entries and more than 200 entries', () => {
    expect(issuesOf({ ...valid(), entries: [] })).toEqual([{ field: 'entries', code: 'REQUIRED' }]);
    expect(
      issuesOf({ ...valid(), entries: Array.from({ length: 201 }, () => buildEntry()) }),
    ).toEqual([{ field: 'entries', code: 'LIMIT_EXCEEDED' }]);
    expect(
      validateSnapshotInput(
        { ...valid(), entries: Array.from({ length: 200 }, () => buildEntry()) },
        TODAY,
      ).ok,
    ).toBe(true);
  });

  it('rejects a standard class on the wrong side', () => {
    expect(
      issuesOf({
        ...valid(),
        entries: [buildEntry({ side: 'LIABILITY', class: { standard: 'cash' } })],
      }),
    ).toEqual([{ field: 'entries[0].class.standard', code: 'UNKNOWN_FIELD' }]);
    expect(
      issuesOf({
        ...valid(),
        entries: [buildEntry({ side: 'ASSET', class: { standard: 'mortgage' } })],
      }),
    ).toEqual([{ field: 'entries[0].class.standard', code: 'UNKNOWN_FIELD' }]);
  });

  it('rejects non-objects', () => {
    expect(issuesOf(null)).toEqual([{ field: '', code: 'INVALID_VALUE' }]);
    expect(issuesOf({ ...valid(), entries: ['x'] })).toEqual([
      { field: 'entries[0]', code: 'INVALID_VALUE' },
    ]);
  });

  it('never echoes a value in its issues', () => {
    const secret = 'Geheim-Konto-4711';
    const issues = issuesOf({
      snapshotDate: '2025-06-01',
      leak: secret,
      entries: [buildEntry({ name: secret, amount: `-${secret}` })],
    });
    expect(JSON.stringify(issues)).not.toContain(secret);
  });
});

describe('validateClassGroup', () => {
  it('accepts a group of the own side', () => {
    expect(
      validateClassGroup({ side: 'ASSET', class: { custom: 'Whisky' }, group: 'TANGIBLE' }),
    ).toEqual({
      ok: true,
      value: { side: 'ASSET', class: { custom: 'Whisky' }, group: 'TANGIBLE' },
    });
  });

  it('rejects a group of the other side and unknown fields', () => {
    const result = validateClassGroup({
      side: 'ASSET',
      class: { custom: 'Whisky' },
      group: 'LONG_TERM',
      x: 1,
    });
    expect(result).toEqual({
      ok: false,
      issues: [
        { field: 'x', code: 'UNKNOWN_FIELD' },
        { field: 'group', code: 'UNKNOWN_FIELD' },
      ],
    });
  });

  it('rejects missing group, bad side and non-objects', () => {
    expect(validateClassGroup({ side: 'ASSET', class: { custom: 'a' } })).toEqual({
      ok: false,
      issues: [{ field: 'group', code: 'REQUIRED' }],
    });
    expect(validateClassGroup({ side: 'X', class: { custom: 'a' }, group: 'LIQUID' }).ok).toBe(
      false,
    );
    expect(validateClassGroup(undefined).ok).toBe(false);
  });
});

describe('normalizeMoney', () => {
  it('canonicalizes plain decimals and rejects anything else', () => {
    expect(normalizeMoney('12000.5')).toBe('12000.50');
    expect(normalizeMoney(' 7 ')).toBe('7.00');
    expect(normalizeMoney('0.1')).toBe('0.10');
    expect(normalizeMoney('12.000,50')).toBeNull();
    expect(normalizeMoney(5)).toBeNull();
  });
});
