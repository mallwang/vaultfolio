import { DASHBOARD_WIDGET_CONTRIBUTIONS } from './dashboard-widgets.registry';

// 022-add-domain-placeholders, US2 (FR-005): the placeholder domains
// contribute nothing to the Dashboard — locks in that a future domain
// addition doesn't accidentally start contributing a widget without a
// deliberate registry entry. (`retirement` left this list in 037, US3; `historic-wealth-development`
// in 038, US4; `insurances` in 039; `account-overview` later.)
const NEW_DOMAIN_IDS = ['haushaltsplaner'];

describe('DASHBOARD_WIDGET_CONTRIBUTIONS', () => {
  it('contains no entry for any of any placeholder domain (FR-005)', () => {
    const domainIds = DASHBOARD_WIDGET_CONTRIBUTIONS.map((c) => c.domainId);
    for (const id of NEW_DOMAIN_IDS) {
      expect(domainIds).not.toContain(id);
    }
  });

  it('only holdings, earnings, retirement, insurances, wealth and account-overview contribute a Dashboard widget', () => {
    expect(DASHBOARD_WIDGET_CONTRIBUTIONS.map((c) => c.domainId)).toEqual([
      'holdings',
      'holdings',
      'earnings',
      'retirement',
      'insurances',
      'historic-wealth-development',
      'account-overview',
    ]);
  });

  it('uses unique tile ids', () => {
    const ids = DASHBOARD_WIDGET_CONTRIBUTIONS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('lazy-loads a component for every entry', async () => {
    for (const contribution of DASHBOARD_WIDGET_CONTRIBUTIONS) {
      expect(await contribution.loadComponent()).toBeDefined();
    }
  });

  // 032-earnings-domain (T118): the earnings widget is gated by its own domain id, so the
  // dashboard's entitlement filter hides it from members without the Earnings domain.
  it('registers the earnings widget under its own domain and title', () => {
    expect(DASHBOARD_WIDGET_CONTRIBUTIONS.find((c) => c.domainId === 'earnings')?.titleKey).toBe(
      'dashboard.earnings',
    );
  });
});
