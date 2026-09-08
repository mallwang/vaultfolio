import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { InvitationSummary, SessionUser } from '@vaultfolio/api-contract';
import { InvitationsService } from './invitations.service';

describe('InvitationsService', () => {
  let service: InvitationsService;
  let httpMock: HttpTestingController;

  const invitation: InvitationSummary = {
    id: 'inv-1',
    email: 'invitee@example.com',
    role: 'MEMBER',
    status: 'PENDING',
    invitedBy: 'admin@example.com',
    createdAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-01-08T00:00:00.000Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(InvitationsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('list() issues a GET to /api/invitations', () => {
    let result: InvitationSummary[] | undefined;
    service.list().subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/invitations');
    expect(req.request.method).toBe('GET');
    req.flush([invitation]);

    expect(result).toEqual([invitation]);
  });

  it('list() propagates an error', () => {
    let error: unknown;
    service.list().subscribe({ error: (err) => (error = err) });

    httpMock.expectOne('/api/invitations').error(new ProgressEvent('error'), { status: 500 });

    expect(error).toBeDefined();
  });

  it('create() issues a POST to /api/invitations', () => {
    let result: InvitationSummary | undefined;
    service
      .create({ email: 'invitee@example.com', role: 'MEMBER' })
      .subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/invitations');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'invitee@example.com', role: 'MEMBER' });
    req.flush(invitation);

    expect(result).toEqual(invitation);
  });

  it('create() propagates an error', () => {
    let error: unknown;
    service.create({ email: 'invitee@example.com', role: 'MEMBER' }).subscribe({
      error: (err) => (error = err),
    });

    httpMock.expectOne('/api/invitations').error(new ProgressEvent('error'), { status: 409 });

    expect(error).toBeDefined();
  });

  it('cancel() issues a POST to /api/invitations/:id/cancel', () => {
    let result: InvitationSummary | undefined;
    service.cancel('inv-1').subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/invitations/inv-1/cancel');
    expect(req.request.method).toBe('POST');
    req.flush({ ...invitation, status: 'CANCELLED' });

    expect(result?.status).toBe('CANCELLED');
  });

  it('cancel() propagates an error', () => {
    let error: unknown;
    service.cancel('inv-1').subscribe({ error: (err) => (error = err) });

    httpMock.expectOne('/api/invitations/inv-1/cancel').error(new ProgressEvent('error'), {
      status: 409,
    });

    expect(error).toBeDefined();
  });

  it('resend() issues a POST to /api/invitations/:id/resend', () => {
    let result: InvitationSummary | undefined;
    service.resend('inv-1').subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/invitations/inv-1/resend');
    expect(req.request.method).toBe('POST');
    req.flush(invitation);

    expect(result).toEqual(invitation);
  });

  it('resend() propagates an error', () => {
    let error: unknown;
    service.resend('inv-1').subscribe({ error: (err) => (error = err) });

    httpMock.expectOne('/api/invitations/inv-1/resend').error(new ProgressEvent('error'), {
      status: 500,
    });

    expect(error).toBeDefined();
  });

  it('lookupToken() issues a GET to /api/invitations/token/:token', () => {
    let result: { email: string; role: 'ADMIN' | 'MEMBER' } | undefined;
    service.lookupToken('tok123').subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/invitations/token/tok123');
    expect(req.request.method).toBe('GET');
    req.flush({ email: 'invitee@example.com', role: 'MEMBER' });

    expect(result).toEqual({ email: 'invitee@example.com', role: 'MEMBER' });
  });

  it('lookupToken() propagates an error', () => {
    let error: unknown;
    service.lookupToken('bad-token').subscribe({ error: (err) => (error = err) });

    httpMock
      .expectOne('/api/invitations/token/bad-token')
      .error(new ProgressEvent('error'), { status: 410 });

    expect(error).toBeDefined();
  });

  it('accept() issues a POST to /api/invitations/token/:token/accept', () => {
    const user: SessionUser = {
      id: 'user-1',
      email: 'invitee@example.com',
      displayName: 'Invitee',
      role: 'MEMBER',
      domainScopes: [],
    };
    let result: SessionUser | undefined;
    service
      .accept('tok123', { password: 'secret123', displayName: 'Invitee' })
      .subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/invitations/token/tok123/accept');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ password: 'secret123', displayName: 'Invitee' });
    req.flush(user);

    expect(result).toEqual(user);
  });

  it('accept() propagates an error', () => {
    let error: unknown;
    service.accept('bad-token', { password: 'secret123', displayName: 'Invitee' }).subscribe({
      error: (err) => (error = err),
    });

    httpMock
      .expectOne('/api/invitations/token/bad-token/accept')
      .error(new ProgressEvent('error'), { status: 410 });

    expect(error).toBeDefined();
  });
});
