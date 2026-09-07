import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmationService, MessageService } from 'primeng/api';
import { CURRENT_USER_SOURCE } from '@vaultfolio/frontend-domain-access';
import type { InvitationSummary } from '@vaultfolio/api-contract';
import { InvitationsComponent } from './invitations.component';

const makeInvitation = (overrides: Partial<InvitationSummary> = {}): InvitationSummary => ({
  id: 'inv-1',
  email: 'user@example.com',
  role: 'MEMBER',
  status: 'PENDING',
  invitedBy: 'admin@example.com',
  createdAt: '2024-01-01T00:00:00Z',
  expiresAt: '2024-02-01T00:00:00Z',
  ...overrides,
});

describe('InvitationsComponent', () => {
  let fixture: ComponentFixture<InvitationsComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InvitationsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ConfirmationService,
        MessageService,
        { provide: CURRENT_USER_SOURCE, useValue: { current: () => null } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InvitationsComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    httpMock.expectOne('/api/invitations').flush([makeInvitation()]);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('ngOnInit', () => {
    it('loads invitations and sets loading=false', () => {
      const comp = fixture.componentInstance;
      expect(comp['loading']()).toBe(false);
      expect(comp['invitations']()).toHaveLength(1);
    });

    it('sets loadError on fetch failure', () => {
      const f2 = TestBed.createComponent(InvitationsComponent);
      f2.detectChanges();
      httpMock.expectOne('/api/invitations').error(new ProgressEvent('error'), { status: 500 });
      expect(f2.componentInstance['loadError']()).toBeTruthy();
    });
  });

  describe('displayedInvitations()', () => {
    it('keeps only the most-recently-created invitation per email', () => {
      const comp = fixture.componentInstance;
      comp['invitations'].set([
        makeInvitation({ id: 'inv-1', email: 'a@x.com', createdAt: '2024-01-01T00:00:00Z' }),
        makeInvitation({ id: 'inv-2', email: 'a@x.com', createdAt: '2024-02-01T00:00:00Z' }),
      ]);
      const displayed = comp['displayedInvitations']();
      expect(displayed).toHaveLength(1);
      expect(displayed[0].id).toBe('inv-2');
    });
  });

  describe('statusSeverity()', () => {
    it('returns info for PENDING', () => {
      expect(fixture.componentInstance['statusSeverity']('PENDING')).toBe('info');
    });

    it('returns success for ACCEPTED', () => {
      expect(fixture.componentInstance['statusSeverity']('ACCEPTED')).toBe('success');
    });
  });

  describe('statusLabelKey()', () => {
    it('returns correct key for PENDING', () => {
      expect(fixture.componentInstance['statusLabelKey']('PENDING')).toBe(
        'invitations.statusPending',
      );
    });
  });

  describe('openInviteDialog()', () => {
    it('sets dialogVisible=true', () => {
      fixture.componentInstance['openInviteDialog']();
      expect(fixture.componentInstance['dialogVisible']()).toBe(true);
    });
  });

  describe('onInvited()', () => {
    it('refreshes the list and adds a success message', () => {
      const messageService = fixture.debugElement.injector.get(MessageService);
      const addSpy = vi.spyOn(messageService, 'add');
      fixture.componentInstance['onInvited']();
      httpMock.expectOne('/api/invitations').flush([]);
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
    });
  });

  describe('resend()', () => {
    it('refreshes and adds success message on success', () => {
      const messageService = fixture.debugElement.injector.get(MessageService);
      const addSpy = vi.spyOn(messageService, 'add');
      fixture.componentInstance['resend'](makeInvitation({ id: 'inv-1' }));
      httpMock.expectOne('/api/invitations/inv-1/resend').flush(makeInvitation());
      httpMock.expectOne('/api/invitations').flush([]);
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
    });

    it('refreshes and adds error message on failure', () => {
      const messageService = fixture.debugElement.injector.get(MessageService);
      const addSpy = vi.spyOn(messageService, 'add');
      fixture.componentInstance['resend'](makeInvitation({ id: 'inv-1' }));
      httpMock
        .expectOne('/api/invitations/inv-1/resend')
        .error(new ProgressEvent('error'), { status: 500 });
      httpMock.expectOne('/api/invitations').flush([]);
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    });
  });

  describe('cancel() [private]', () => {
    it('refreshes and adds success message on success', () => {
      const messageService = fixture.debugElement.injector.get(MessageService);
      const addSpy = vi.spyOn(messageService, 'add');
      fixture.componentInstance['cancel'](makeInvitation({ id: 'inv-1' }));
      httpMock.expectOne('/api/invitations/inv-1/cancel').flush(makeInvitation());
      httpMock.expectOne('/api/invitations').flush([]);
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
    });

    it('refreshes and adds error message on failure', () => {
      const messageService = fixture.debugElement.injector.get(MessageService);
      const addSpy = vi.spyOn(messageService, 'add');
      fixture.componentInstance['cancel'](makeInvitation({ id: 'inv-1' }));
      httpMock
        .expectOne('/api/invitations/inv-1/cancel')
        .error(new ProgressEvent('error'), { status: 500 });
      httpMock.expectOne('/api/invitations').flush([]);
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    });
  });

  describe('confirmCancel()', () => {
    it('calls confirmationService.confirm with the invitation', () => {
      const confirmationService = fixture.debugElement.injector.get(ConfirmationService);
      const confirmSpy = vi.spyOn(confirmationService, 'confirm');
      const inv = makeInvitation({ email: 'test@example.com' });
      fixture.componentInstance['confirmCancel'](inv, new Event('click'));
      expect(confirmSpy).toHaveBeenCalledOnce();
    });
  });
});
