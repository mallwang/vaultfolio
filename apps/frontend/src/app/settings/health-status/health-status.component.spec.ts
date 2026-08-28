import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { HealthStatus } from '@vaultfolio/api-contract';
import { HealthStatusComponent } from './health-status.component';

/**
 * Uses HttpClientTestingModule's mocked backend (via provideHttpClientTesting)
 * so this test requires no live backend server or network call — proving the
 * frontend is independently testable (User Story 3, contracts/health-api.md).
 */
describe('HealthStatusComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HealthStatusComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('renders the health status returned by GET /health', () => {
    const fixture = TestBed.createComponent(HealthStatusComponent);
    fixture.detectChanges();

    const response: HealthStatus = {
      status: 'ok',
      database: 'connected',
      timestamp: '2026-08-13T12:00:00.000Z',
    };
    httpMock.expectOne('http://localhost:3000/health').flush(response);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('ok');
    expect(text).toContain('connected');
  });

  it('renders an error message when the backend is unreachable', () => {
    const fixture = TestBed.createComponent(HealthStatusComponent);
    fixture.detectChanges();

    httpMock
      .expectOne('http://localhost:3000/health')
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Unable to reach the backend health check.');
  });
});
