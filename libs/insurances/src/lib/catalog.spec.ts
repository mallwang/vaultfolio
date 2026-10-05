import { INSURANCE_TYPES, REQUIREMENTS, isSocialType, typeDef } from './catalog';

describe('catalog', () => {
  it('has unique type ids', () => {
    expect(new Set(INSURANCE_TYPES.map((t) => t.id)).size).toBe(INSURANCE_TYPES.length);
  });

  it('covers the minimum types of FR-004', () => {
    const ids = INSURANCE_TYPES.map((t) => t.id);
    for (const id of [
      'PRIVATE_LIABILITY',
      'HOUSEHOLD',
      'BUILDING',
      'NATURAL_HAZARD',
      'DISABILITY',
      'TERM_LIFE',
      'ACCIDENT',
      'STATUTORY_HEALTH',
      'PRIVATE_HEALTH',
      'SUPPLEMENTARY_HEALTH',
      'TRAVEL_HEALTH',
      'DENTAL_SUPPLEMENT',
      'LONG_TERM_CARE',
      'CAR',
      'BICYCLE',
      'PET_LIABILITY',
      'LEGAL_PROTECTION',
      'PROPERTY_OWNER_LIABILITY',
      'OTHER',
    ])
      expect(ids).toContain(id);
  });

  it('classifies as documented', () => {
    expect(typeDef('PRIVATE_LIABILITY').classification).toBe('ESSENTIAL');
    expect(typeDef('NATURAL_HAZARD').classification).toBe('RECOMMENDED');
    expect(typeDef('LEGAL_PROTECTION').classification).toBe('SITUATIONAL');
    expect(typeDef('GLASS').classification).toBe('OPTIONAL');
  });

  it('flags the four statutory types as social', () => {
    expect(INSURANCE_TYPES.filter((t) => isSocialType(t.id)).map((t) => t.social)).toEqual([
      'HEALTH',
      'CARE',
      'PENSION',
      'UNEMPLOYMENT',
    ]);
  });

  it('lets requirements reference known types only', () => {
    const ids = new Set(INSURANCE_TYPES.map((t) => t.id));
    for (const r of REQUIREMENTS) for (const t of r.satisfiedBy) expect(ids.has(t)).toBe(true);
  });
});
