import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { AccountOverviewEntry } from '@vaultfolio/api-contract';
import { AccountOverviewDashboardWidgetComponent } from './account-overview-dashboard-widget.component';

const account = (over: Partial<AccountOverviewEntry>): AccountOverviewEntry =>
  ({
    id: 'a1',
    name: 'Konto',
    category: 'GENERAL',
    status: 'ACTIVE',
    ...over,
  }) as AccountOverviewEntry;

describe('AccountOverviewDashboardWidgetComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  async function render(body: AccountOverviewEntry[] | 500) {
    const fixture = TestBed.createComponent(AccountOverviewDashboardWidgetComponent);
    fixture.detectChanges();
    const req = http.expectOne('/api/account-overview/accounts');
    if (body === 500) req.flush({}, { status: 500, statusText: 'x' });
    else req.flush(body);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`);
  const txt = (el: HTMLElement, id: string) => q(el, id)?.textContent?.replace(/\s+/g, ' ').trim();

  it('shows the total and the count per category with a link to the overview', async () => {
    const el = await render([
      account({ id: 'a1', category: 'GENERAL' }),
      account({ id: 'a2', category: 'CREDIT_CARD' }),
      account({ id: 'a3', category: 'CREDIT_CARD', status: 'DECOMMISSIONED' }),
    ]);
    expect(txt(el, 'account-overview-widget-total')).toBe('3');
    expect(txt(el, 'account-overview-widget-category-CREDIT_CARD')).toContain('2');
    expect(q(el, 'account-overview-widget-category-SAVINGS')).toBeNull();
    expect(txt(el, 'account-overview-widget-decommissioned')).toContain('1');
    expect(q(el, 'account-overview-widget-link')?.getAttribute('href')).toBe(
      '/app/account-overview',
    );
  });

  it('invites to add the first account when there are none', async () => {
    const el = await render([]);
    const empty = q(el, 'account-overview-widget-empty');
    expect(empty?.getAttribute('href')).toBe('/app/account-overview');
  });

  it('shows a note when loading fails', async () => {
    const el = await render(500);
    expect(q(el, 'account-overview-widget-error')).not.toBeNull();
  });
});
