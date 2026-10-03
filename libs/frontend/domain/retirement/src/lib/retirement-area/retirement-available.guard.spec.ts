import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { retirementAvailableGuard } from './retirement-available.guard';

describe('retirementAvailableGuard', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  const run = () => TestBed.runInInjectionContext(() => retirementAvailableGuard());

  it('lets the screen open when the records can be read', async () => {
    const result = run();
    http.expectOne('/api/retirement/records').flush([]);
    expect(await result).toBe(true);
  });

  it('sends the visitor back to the area on a 503', async () => {
    const result = run();
    http
      .expectOne('/api/retirement/records')
      .flush({ error: 'RETIREMENT_UNAVAILABLE' }, { status: 503, statusText: 'Unavailable' });
    const outcome = await result;
    expect(outcome).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(outcome as UrlTree)).toBe('/app/retirement');
  });

  it('lets the screen open on any other error', async () => {
    const result = run();
    http.expectOne('/api/retirement/records').flush({}, { status: 500, statusText: 'Error' });
    expect(await result).toBe(true);
  });
});
