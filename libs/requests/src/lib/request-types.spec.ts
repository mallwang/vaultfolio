import { findRequestType, requestTypeLabel, REQUEST_TYPES } from './request-types.js';

describe('request types', () => {
  it('registers earnings/new-parser first', () => {
    expect(REQUEST_TYPES[0]).toEqual({
      feature: 'earnings',
      type: 'new-parser',
      names: { en: 'New parser', de: 'Neuer Parser' },
      featureNames: { en: 'Earnings', de: 'Einkommen' },
      requiredDomain: 'earnings',
      attachment: { allowed: true, contentType: 'application/pdf', maxBytes: 512 * 1024 },
    });
  });

  it('finds a type by feature and type key', () => {
    expect(findRequestType('earnings', 'new-parser')).toBe(REQUEST_TYPES[0]);
  });

  it('returns undefined for unknown combinations', () => {
    expect(findRequestType('earnings', 'nope')).toBeUndefined();
    expect(findRequestType('nope', 'new-parser')).toBeUndefined();
  });

  it('labels a type in English and German', () => {
    const def = REQUEST_TYPES[0];
    expect(requestTypeLabel(def, 'en')).toEqual({ feature: 'Earnings', type: 'New parser' });
    expect(requestTypeLabel(def, 'de')).toEqual({ feature: 'Einkommen', type: 'Neuer Parser' });
  });
});
