import { checkGaps } from './gap-check';
import { DEFAULT_SETTINGS, type Profile } from './model';
import { buildInsuranceContract as build } from './testing/builders';

const profile = (over: Partial<Profile> = {}): Profile => ({
  ...DEFAULT_SETTINGS.profile,
  ...over,
});
const ids = (items: { requirement: string }[]) => items.map((i) => i.requirement);

describe('checkGaps', () => {
  it('reports natural hazard missing for owners and covered once added', () => {
    const missing = checkGaps({
      contracts: [],
      profile: profile({ ownsProperty: true }),
      dismissedRequirements: [],
    });
    expect(ids(missing.missing)).toContain('NATURAL_HAZARD');
    const covered = checkGaps({
      contracts: [build({ type: 'NATURAL_HAZARD' })],
      profile: profile({ ownsProperty: true }),
      dismissedRequirements: [],
    });
    expect(ids(covered.covered)).toContain('NATURAL_HAZARD');
    expect(ids(covered.missing)).not.toContain('NATURAL_HAZARD');
  });

  it('does not report car without a car', () => {
    const r = checkGaps({ contracts: [], profile: profile(), dismissedRequirements: [] });
    expect(ids(r.missing)).not.toContain('CAR');
    expect(
      ids(
        checkGaps({ contracts: [], profile: profile({ ownsCar: true }), dismissedRequirements: [] })
          .missing,
      ),
    ).toContain('CAR');
  });

  it('sorts essential before recommended and situational', () => {
    const r = checkGaps({
      contracts: [],
      profile: profile({ ownsProperty: true, ownsCar: true }),
      dismissedRequirements: [],
    });
    const order = r.missing.map((m) => m.classification);
    expect(order).toEqual(
      [...order].sort(
        (a, b) =>
          ['ESSENTIAL', 'RECOMMENDED', 'SITUATIONAL'].indexOf(a) -
          ['ESSENTIAL', 'RECOMMENDED', 'SITUATIONAL'].indexOf(b),
      ),
    );
    expect(order[0]).toBe('ESSENTIAL');
  });

  it('requires disability only for employed or self-employed', () => {
    expect(
      ids(
        checkGaps({
          contracts: [],
          profile: profile({ employment: 'OTHER' }),
          dismissedRequirements: [],
        }).missing,
      ),
    ).not.toContain('DISABILITY');
    expect(
      ids(
        checkGaps({
          contracts: [],
          profile: profile({ employment: 'SELF_EMPLOYED' }),
          dismissedRequirements: [],
        }).missing,
      ),
    ).toContain('DISABILITY');
  });

  it('accepts statutory or private health', () => {
    for (const type of ['STATUTORY_HEALTH', 'PRIVATE_HEALTH'] as const) {
      const r = checkGaps({
        contracts: [build({ type })],
        profile: profile(),
        dismissedRequirements: [],
      });
      expect(ids(r.covered)).toContain('HEALTH');
    }
  });

  it('counts linked statutory health as covered from Earnings', () => {
    const r = checkGaps({
      contracts: [],
      profile: profile(),
      dismissedRequirements: [],
      linkedKinds: ['HEALTH'],
    });
    expect(r.covered.find((c) => c.requirement === 'HEALTH')?.linked).toBe(true);
  });

  it('treats alsoCovers of combination products as covered and flags overlap', () => {
    const r = checkGaps({
      contracts: [
        build({ id: 'combo', type: 'HOUSEHOLD', alsoCovers: ['PRIVATE_LIABILITY'] }),
        build({ id: 'liab', type: 'PRIVATE_LIABILITY' }),
      ],
      profile: profile(),
      dismissedRequirements: [],
    });
    expect(ids(r.covered)).toContain('LIABILITY');
    expect(r.redundant).toEqual([
      {
        contractId: 'liab',
        type: 'PRIVATE_LIABILITY',
        otherContractId: 'combo',
        reason: 'COMBINATION',
      },
    ]);
  });

  it('flags types usually included in another contract', () => {
    const r = checkGaps({
      contracts: [build({ id: 'h', type: 'HOUSEHOLD' }), build({ id: 'g', type: 'GLASS' })],
      profile: profile(),
      dismissedRequirements: [],
    });
    expect(r.redundant).toEqual([
      { contractId: 'g', type: 'GLASS', otherContractId: 'h', reason: 'INCLUDED_IN' },
    ]);
  });

  it('lists dismissed requirements only under dismissed', () => {
    const r = checkGaps({ contracts: [], profile: profile(), dismissedRequirements: ['LEGAL'] });
    expect(ids(r.dismissed)).toEqual(['LEGAL']);
    expect(ids(r.missing)).not.toContain('LEGAL');
  });

  it('ignores inactive contracts', () => {
    const r = checkGaps({
      contracts: [build({ type: 'HOUSEHOLD', status: 'CANCELLED' })],
      profile: profile(),
      dismissedRequirements: [],
    });
    expect(ids(r.missing)).toContain('HOUSEHOLD');
  });
});
