import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';

import { AcceptComponent } from './accept.component';

const TOKEN = 'test-token-abc';
const LOOKUP = { email: 'invited@example.com', role: 'MEMBER' as const };

function withToken(token: string) {
  return {
    provide: ActivatedRoute,
    useValue: { snapshot: { paramMap: { get: () => token } } },
  };
}

describe('AcceptComponent', () => {
  let fixture: ComponentFixture<AcceptComponent>;
  let httpMock: HttpTestingController;

  async function setup(token = TOKEN) {
    await TestBed.configureTestingModule({
      imports: [AcceptComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        withToken(token),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AcceptComponent);
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => httpMock.verify());

  describe('ngOnInit — token lookup', () => {
    it('loads invite details and clears loading on success', async () => {
      await setup();
      fixture.detectChanges();
      httpMock.expectOne(`/api/invitations/token/${TOKEN}`).flush(LOOKUP);
      fixture.detectChanges();
      expect(fixture.componentInstance['email']()).toBe('invited@example.com');
      expect(fixture.componentInstance['loading']()).toBe(false);
    });

    it('navigates to /invite/expired when token is missing', async () => {
      await setup('');
      const spy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      fixture.detectChanges();
      expect(spy).toHaveBeenCalledWith('/invite/expired');
    });

    it('navigates to /invite/expired on lookup error', async () => {
      await setup();
      const spy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      fixture.detectChanges();
      httpMock
        .expectOne(`/api/invitations/token/${TOKEN}`)
        .error(new ProgressEvent('error'), { status: 404 });
      expect(spy).toHaveBeenCalledWith('/invite/expired');
    });
  });

  describe('submit()', () => {
    beforeEach(async () => {
      await setup();
      fixture.detectChanges();
      httpMock.expectOne(`/api/invitations/token/${TOKEN}`).flush(LOOKUP);
      fixture.detectChanges();
    });

    it('does nothing when already submitting', () => {
      fixture.componentInstance['submitting'].set(true);
      fixture.componentInstance['submit']();
      httpMock.expectNone(`/api/invitations/token/${TOKEN}/accept`);
      expect(fixture.componentInstance['submitting']()).toBe(true);
    });

    it('sets errorMessage when displayName is blank', () => {
      fixture.componentInstance['displayName'].set('   ');
      fixture.componentInstance['submit']();
      expect(fixture.componentInstance['errorMessage']()).toBeTruthy();
    });

    it('sets errorMessage when passwords do not match', () => {
      fixture.componentInstance['displayName'].set('Alice');
      fixture.componentInstance['password'].set('password1');
      fixture.componentInstance['confirmPassword'].set('different');
      fixture.componentInstance['submit']();
      expect(fixture.componentInstance['errorMessage']()).toBeTruthy();
    });

    it('sets errorMessage when password is too short', () => {
      fixture.componentInstance['displayName'].set('Alice');
      fixture.componentInstance['password'].set('short');
      fixture.componentInstance['confirmPassword'].set('short');
      fixture.componentInstance['submit']();
      expect(fixture.componentInstance['errorMessage']()).toBeTruthy();
    });

    it('navigates to /app/dashboard on success', () => {
      const spy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      fixture.componentInstance['displayName'].set('Alice');
      fixture.componentInstance['password'].set('validpassword');
      fixture.componentInstance['confirmPassword'].set('validpassword');
      fixture.componentInstance['submit']();
      httpMock.expectOne(`/api/invitations/token/${TOKEN}/accept`).flush({
        id: 'u-1',
        email: 'invited@example.com',
        displayName: 'Alice',
        role: 'MEMBER',
        domainScopes: [],
      });
      expect(spy).toHaveBeenCalledWith('/app/dashboard');
    });

    it('navigates to /invite/expired on 410', () => {
      const spy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      fixture.componentInstance['displayName'].set('Alice');
      fixture.componentInstance['password'].set('validpassword');
      fixture.componentInstance['confirmPassword'].set('validpassword');
      fixture.componentInstance['submit']();
      httpMock
        .expectOne(`/api/invitations/token/${TOKEN}/accept`)
        .flush({ error: 'invalid_token', message: 'Expired' }, { status: 410, statusText: 'Gone' });
      expect(spy).toHaveBeenCalledWith('/invite/expired');
    });

    it('sets errorMessage from server body on non-410 error', () => {
      fixture.componentInstance['displayName'].set('Alice');
      fixture.componentInstance['password'].set('validpassword');
      fixture.componentInstance['confirmPassword'].set('validpassword');
      fixture.componentInstance['submit']();
      httpMock
        .expectOne(`/api/invitations/token/${TOKEN}/accept`)
        .flush(
          { error: 'invalid_password', message: 'Password too weak' },
          { status: 400, statusText: 'Bad Request' },
        );
      expect(fixture.componentInstance['submitting']()).toBe(false);
      expect(fixture.componentInstance['errorMessage']()).toBeTruthy();
    });
  });
});
