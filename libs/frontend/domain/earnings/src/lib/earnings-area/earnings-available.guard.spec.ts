import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, UrlTree } from '@angular/router';
import { provideRouter } from '@angular/router';
import { earningsAvailableGuard } from './earnings-available.guard';

describe('earningsAvailableGuard', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  function run(): Promise<boolean | UrlTree> {
    return TestBed.runInInjectionContext(() => earningsAvailableGuard());
  }

  it('allows the import screen when earnings are available', async () => {
    const result = run();
    http.expectOne('/api/earnings/employers').flush([]);
    expect(await result).toBe(true);
  });

  it('redirects to the area (unavailable state) on 503 EARNINGS_UNAVAILABLE', async () => {
    const result = run();
    http
      .expectOne('/api/earnings/employers')
      .flush({ error: 'EARNINGS_UNAVAILABLE' }, { status: 503, statusText: 'Service Unavailable' });
    const tree = await result;
    expect(tree).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(tree as UrlTree)).toBe('/app/earnings');
  });

  it('lets other errors through', async () => {
    const result = run();
    http.expectOne('/api/earnings/employers').flush({}, { status: 500, statusText: 'Error' });
    expect(await result).toBe(true);
  });
});
