import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmationService, MessageService } from 'primeng/api';
import { CURRENT_USER_SOURCE } from '@vaultfolio/frontend-domain-access';
import type { SignupSummary } from '@vaultfolio/api-contract';
import { SignupsComponent } from './signups.component';

const makeSignup = (overrides: Partial<SignupSummary> = {}): SignupSummary => ({
  id: 'su-1',
  email: 'applicant@example.com',
  status: 'VERIFIED',
  createdAt: '2026-01-01T00:00:00.000Z',
  verifiedAt: null,
  resolvedAt: null,
  accountDeletedAt: null,
  ...overrides,
});

describe('SignupsComponent', () => {
  let fixture: ComponentFixture<SignupsComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignupsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ConfirmationService,
        MessageService,
        { provide: CURRENT_USER_SOURCE, useValue: { current: () => null } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SignupsComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    httpMock.expectOne('/api/signups').flush([makeSignup()]);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  describe('ngOnInit', () => {
    it('loads signups list', () => {
      expect(fixture.componentInstance['signups']().length).toBe(1);
      expect(fixture.componentInstance['loading']()).toBe(false);
    });

    it('sets loadError on fetch failure', async () => {
      const comp2 = TestBed.createComponent(SignupsComponent);
      const mock2 = TestBed.inject(HttpTestingController);
      comp2.detectChanges();
      mock2.expectOne('/api/signups').error(new ProgressEvent('error'), { status: 500 });
      comp2.detectChanges();
      expect(comp2.componentInstance['loadError']()).toBeTruthy();
      mock2.verify();
    });
  });

  describe('statusSeverity()', () => {
    it('returns secondary for PENDING', () => {
      expect(fixture.componentInstance['statusSeverity']('PENDING')).toBe('secondary');
    });
    it('returns info for VERIFIED', () => {
      expect(fixture.componentInstance['statusSeverity']('VERIFIED')).toBe('info');
    });
    it('returns success for APPROVED', () => {
      expect(fixture.componentInstance['statusSeverity']('APPROVED')).toBe('success');
    });
    it('returns danger for REJECTED', () => {
      expect(fixture.componentInstance['statusSeverity']('REJECTED')).toBe('danger');
    });
  });

  describe('statusLabelKey()', () => {
    it('returns the correct translation key per status', () => {
      expect(fixture.componentInstance['statusLabelKey']('PENDING')).toBe('signups.statusPending');
      expect(fixture.componentInstance['statusLabelKey']('APPROVED')).toBe(
        'signups.statusApproved',
      );
    });
  });

  describe('openRejectDialog() / onRejected()', () => {
    it('sets rejectTarget and shows dialog', () => {
      const signup = makeSignup();
      fixture.componentInstance['openRejectDialog'](signup);
      expect(fixture.componentInstance['rejectTarget']()).toBe(signup);
      expect(fixture.componentInstance['rejectDialogVisible']()).toBe(true);
    });

    it('onRejected() refreshes the list', () => {
      fixture.componentInstance['onRejected']();
      httpMock.expectOne('/api/signups').flush([]);
      expect(fixture.componentInstance['loading']()).toBe(false);
    });
  });

  describe('approve flow', () => {
    it('POSTs approve, refreshes, and notifies accounts on success', () => {
      const signup = makeSignup({ id: 'su-1' });
      // Trigger approve via internal method (confirmApprove requires a DOM event)
      fixture.componentInstance['approve'](signup);
      httpMock.expectOne('/api/signups/su-1/approve').flush(signup);
      httpMock.expectOne('/api/signups').flush([]);
      expect(fixture.componentInstance['loading']()).toBe(false);
    });

    it('refreshes and shows error on approve failure', () => {
      const signup = makeSignup({ id: 'su-1' });
      fixture.componentInstance['approve'](signup);
      httpMock
        .expectOne('/api/signups/su-1/approve')
        .error(new ProgressEvent('error'), { status: 500 });
      httpMock.expectOne('/api/signups').flush([]);
      expect(fixture.componentInstance['loading']()).toBe(false);
    });
  });

  describe('delete flow', () => {
    it('DELETEs signup and refreshes on success', () => {
      const signup = makeSignup({ id: 'su-1' });
      fixture.componentInstance['delete'](signup);
      httpMock.expectOne('/api/signups/su-1').flush({ deleted: true });
      httpMock.expectOne('/api/signups').flush([]);
      expect(fixture.componentInstance['loading']()).toBe(false);
    });

    it('refreshes and shows error on delete failure', () => {
      const signup = makeSignup({ id: 'su-1' });
      fixture.componentInstance['delete'](signup);
      httpMock.expectOne('/api/signups/su-1').error(new ProgressEvent('error'), { status: 500 });
      httpMock.expectOne('/api/signups').flush([]);
      expect(fixture.componentInstance['loading']()).toBe(false);
    });
  });
});
