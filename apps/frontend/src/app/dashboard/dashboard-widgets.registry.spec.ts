import { DASHBOARD_WIDGET_CONTRIBUTIONS } from './dashboard-widgets.registry';

// 022-add-domain-placeholders, US2 (FR-005): the placeholder domains
// contribute nothing to the Dashboard — locks in that a future domain
// addition doesn't accidentally start contributing a widget without a
// deliberate registry entry. (`retirement` left this list in 037, US3.)
const NEW_DOMAIN_IDS = [
  'insurances',
  'haushaltsplaner',
  'historic-wealth-development',
  'account-overview',
];

describe('DASHBOARD_WIDGET_CONTRIBUTIONS', () => {
  it('contains no entry for any of any placeholder domain (FR-005)', () => {
    const domainIds = DASHBOARD_WIDGET_CONTRIBUTIONS.map((c) => c.domainId);
    for (const id of NEW_DOMAIN_IDS) {
      expect(domainIds).not.toContain(id);
    }
  });

  it('only holdings, earnings and retirement contribute a Dashboard widget', () => {
    expect(DASHBOARD_WIDGET_CONTRIBUTIONS.map((c) => c.domainId)).toEqual([
      'holdings',
      'earnings',
      'retirement',
    ]);
  });

  // 032-earnings-domain (T118): the earnings widget is gated by its own domain id, so the
  // dashboard's entitlement filter hides it from members without the Earnings domain.
  it('registers the earnings widget under its own domain and title', () => {
    expect(DASHBOARD_WIDGET_CONTRIBUTIONS.find((c) => c.domainId === 'earnings')?.titleKey).toBe(
      'dashboard.earnings',
    );
  });
});
