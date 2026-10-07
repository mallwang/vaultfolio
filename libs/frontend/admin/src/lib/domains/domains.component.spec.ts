import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmationService, MessageService } from 'primeng/api';
import type { DomainMaintenanceStatus } from '@vaultfolio/api-contract';
import { DomainsComponent } from './domains.component';

const status = (
  domainId: DomainMaintenanceStatus['domainId'],
  over: Partial<DomainMaintenanceStatus> = {},
): DomainMaintenanceStatus => ({
  domainId,
  inMaintenance: false,
  updatedAt: null,
  updatedBy: null,
  ...over,
});

const DOMAINS: DomainMaintenanceStatus[] = [
  status('holdings'),
  status('insurances', {
    inMaintenance: true,
    updatedAt: '2026-10-06T18:42:10.000Z',
    updatedBy: 'Ada Admin',
  }),
];

describe('DomainsComponent', () => {
  let fixture: ComponentFixture<DomainsComponent>;
  let http: HttpTestingController;
  let confirmation: ConfirmationService;

  const el = (testId: string): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${testId}"]`);

  const toggle = (domainId: string, labelKey: string, enable: boolean) =>
    (
      fixture.componentInstance as unknown as {
        onToggle(row: { domainId: string; labelKey: string }, enable: boolean): void;
      }
    ).onToggle({ domainId, labelKey }, enable);

  async function load(domains: DomainMaintenanceStatus[] = DOMAINS) {
    fixture = TestBed.createComponent(DomainsComponent);
    confirmation = fixture.debugElement.injector.get(ConfirmationService);
    fixture.detectChanges();
    http.expectOne('/api/admin/domains').flush({ domains });
    fixture.detectChanges();
  }

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [DomainsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ConfirmationService,
        MessageService,
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    fixture?.destroy();
    http.verify();
  });

  it('lists each domain with its state and who changed it last', async () => {
    await load();
    expect(el('domains-state-holdings')?.textContent).toContain('Active');
    expect(el('domains-state-insurances')?.textContent).toContain('In maintenance');
    expect(el('domains-changed-insurances')?.textContent).toContain('Ada Admin');
    expect(el('domains-changed-holdings')?.textContent).toContain('–');
  });

  it('asks for confirmation before putting a domain into maintenance, and only then calls the API', async () => {
    await load();
    const confirmSpy = vi.spyOn(confirmation, 'confirm');
    toggle('holdings', 'nav.holdings', true);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    http.expectNone('/api/admin/domains/holdings');

    confirmSpy.mock.calls[0][0].accept?.();
    const req = http.expectOne('/api/admin/domains/holdings');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ inMaintenance: true });
    req.flush(status('holdings', { inMaintenance: true, updatedAt: '2026-10-07T08:00:00.000Z' }));
    fixture.detectChanges();
    expect(el('domains-state-holdings')?.textContent).toContain('In maintenance');
  });

  it('does not call the API when the confirmation is declined', async () => {
    await load();
    const confirmSpy = vi.spyOn(confirmation, 'confirm');
    toggle('holdings', 'nav.holdings', true);
    confirmSpy.mock.calls[0][0].reject?.();
    http.expectNone('/api/admin/domains/holdings');
    expect(el('domains-state-holdings')?.textContent).toContain('Active');
  });

  it('switches a domain back without a confirmation', async () => {
    await load();
    const confirmSpy = vi.spyOn(confirmation, 'confirm');
    toggle('insurances', 'nav.insurances', false);
    expect(confirmSpy).not.toHaveBeenCalled();
    http.expectOne('/api/admin/domains/insurances').flush(status('insurances'));
    fixture.detectChanges();
    expect(el('domains-state-insurances')?.textContent).toContain('Active');
  });

  it('keeps the stored state and shows an error when saving fails', async () => {
    await load();
    toggle('insurances', 'nav.insurances', false);
    http
      .expectOne('/api/admin/domains/insurances')
      .flush({ error: 'x' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(el('domains-state-insurances')?.textContent).toContain('In maintenance');
  });

  it('shows a load error when the list cannot be fetched', async () => {
    fixture = TestBed.createComponent(DomainsComponent);
    fixture.detectChanges();
    http.expectOne('/api/admin/domains').flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(el('domains-load-error')?.textContent).toContain('Unable to load the domains');
  });
});
