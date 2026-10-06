import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AccountOverviewDangerZoneComponent } from './account-overview-danger-zone.component';

describe('AccountOverviewDangerZoneComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  function setup() {
    const fixture = TestBed.createComponent(AccountOverviewDangerZoneComponent);
    const deleted = vi.fn();
    fixture.componentInstance.deleted.subscribe(deleted);
    fixture.detectChanges();
    return {
      fixture,
      deleted,
      component: fixture.componentInstance as unknown as Record<string, () => void>,
    };
  }

  it('deletes all accounts after confirming and emits deleted', () => {
    const { fixture, deleted, component } = setup();
    (component['confirm'] as () => void)();
    http.expectOne('/api/account-overview/accounts').flush(null, { status: 204, statusText: 'x' });
    expect(deleted).toHaveBeenCalledTimes(1);
    expect(
      fixture.nativeElement.querySelector('[data-testid="account-overview-delete-all"]'),
    ).not.toBeNull();
  });

  it('keeps the dialog open and does not emit when deleting fails', () => {
    const { deleted, component } = setup();
    (component['confirm'] as () => void)();
    http.expectOne('/api/account-overview/accounts').flush({}, { status: 500, statusText: 'x' });
    expect(deleted).not.toHaveBeenCalled();
    expect((component as unknown as { failed: () => boolean })['failed']()).toBe(true);
  });
});
