import { MAINTENANCE_DOMAIN_IDS } from '@vaultfolio/api-contract';
import { DOMAIN_REGISTRY } from './domain-registry';

describe('DOMAIN_REGISTRY', () => {
  it('lists exactly the domains that can be put into maintenance (041)', () => {
    expect(DOMAIN_REGISTRY.map((d) => d.id).sort()).toEqual([...MAINTENANCE_DOMAIN_IDS].sort());
  });
});
