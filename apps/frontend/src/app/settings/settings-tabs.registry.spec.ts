import { SETTINGS_TAB_CONTRIBUTIONS } from './settings-tabs.registry';

// 022-add-domain-placeholders, US2 (FR-005): the five new placeholder
// domains contribute nothing to Settings — locks in that a future domain
// addition doesn't accidentally start contributing a tab without a
// deliberate registry entry.
const NEW_DOMAIN_IDS = [
  'retirement',
  'insurances',
  'haushaltsplaner',
  'historic-wealth-development',
  'account-overview',
];

describe('SETTINGS_TAB_CONTRIBUTIONS', () => {
  it('contains no entry for any of the five new placeholder domains (FR-005)', () => {
    const domainIds = SETTINGS_TAB_CONTRIBUTIONS.map((c) => c.domainId);
    for (const id of NEW_DOMAIN_IDS) {
      expect(domainIds).not.toContain(id);
    }
  });

  it('is empty — no domain contributes a Settings tab yet', () => {
    expect(SETTINGS_TAB_CONTRIBUTIONS).toEqual([]);
  });
});
