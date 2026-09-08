import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { VerifyComponent } from './verify.component';

function buildFixture(token: string | null): {
  fixture: ComponentFixture<VerifyComponent>;
  httpMock: HttpTestingController;
} {
  TestBed.configureTestingModule({
    imports: [VerifyComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => token } } } },
    ],
  }).compileComponents();

  return {
    fixture: TestBed.createComponent(VerifyComponent),
    httpMock: TestBed.inject(HttpTestingController),
  };
}

describe('VerifyComponent', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('shows the invalid state without calling the API when the token param is missing', () => {
    const { fixture, httpMock } = buildFixture(null);

    fixture.detectChanges();

    expect(fixture.componentInstance['state']()).toBe('invalid');
    httpMock.expectNone('/api/signups/token//verify');
    httpMock.verify();
  });

  it('shows the verified state when the verify call succeeds', () => {
    const { fixture, httpMock } = buildFixture('tok123');

    fixture.detectChanges();
    expect(fixture.componentInstance['state']()).toBe('loading');

    httpMock
      .expectOne('/api/signups/token/tok123/verify')
      .flush({ email: 'user@example.com', status: 'VERIFIED' });

    expect(fixture.componentInstance['state']()).toBe('verified');
    httpMock.verify();
  });

  it('shows the invalid state when the verify call errors', () => {
    const { fixture, httpMock } = buildFixture('bad-token');

    fixture.detectChanges();
    httpMock
      .expectOne('/api/signups/token/bad-token/verify')
      .error(new ProgressEvent('error'), { status: 410 });

    expect(fixture.componentInstance['state']()).toBe('invalid');
    httpMock.verify();
  });
});
