import { DASHBOARD_WIDGET_CONTRIBUTIONS } from './dashboard-widgets.registry';

// 022-add-domain-placeholders, US2 (FR-005): the five new placeholder
// domains contribute nothing to the Dashboard — locks in that a future
// domain addition doesn't accidentally start contributing a widget without
// a deliberate registry entry.
const NEW_DOMAIN_IDS = [
  'retirement',
  'insurances',
  'haushaltsplaner',
  'historic-wealth-development',
  'account-overview',
];

describe('DASHBOARD_WIDGET_CONTRIBUTIONS', () => {
  it('contains no entry for any of the five new placeholder domains (FR-005)', () => {
    const domainIds = DASHBOARD_WIDGET_CONTRIBUTIONS.map((c) => c.domainId);
    for (const id of NEW_DOMAIN_IDS) {
      expect(domainIds).not.toContain(id);
    }
  });

  it('only holdings contributes a Dashboard widget', () => {
    expect(DASHBOARD_WIDGET_CONTRIBUTIONS.map((c) => c.domainId)).toEqual(['holdings']);
  });
});
