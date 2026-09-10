import { FeatureExportRegistry } from './feature-export-registry.js';
import type { FeatureExportDefinition } from './feature-export-definition.js';

function makeDefinition(featureId: string): FeatureExportDefinition {
  return {
    featureId,
    titleKey: `${featureId}.title`,
    infoboxKey: `${featureId}.infobox`,
    columns: [],
    fetchData: () => Promise.resolve([]),
  };
}

describe('FeatureExportRegistry', () => {
  it('registers and returns all definitions', () => {
    const registry = new FeatureExportRegistry();
    const holdings = makeDefinition('holdings');
    const accountOverview = makeDefinition('account-overview');

    registry.register(holdings);
    registry.register(accountOverview);

    expect(registry.getAll()).toEqual([holdings, accountOverview]);
  });

  it('looks up a definition by featureId', () => {
    const registry = new FeatureExportRegistry();
    const holdings = makeDefinition('holdings');
    registry.register(holdings);

    expect(registry.getById('holdings')).toBe(holdings);
    expect(registry.getById('missing')).toBeUndefined();
  });

  it('throws when registering a duplicate featureId', () => {
    const registry = new FeatureExportRegistry();
    registry.register(makeDefinition('holdings'));

    expect(() => registry.register(makeDefinition('holdings'))).toThrow();
  });
});
