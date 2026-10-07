import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DomainsService } from './domains.service';

describe('DomainsService', () => {
  let service: DomainsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DomainsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list() issues a GET to /api/admin/domains', () => {
    let result: unknown;
    service.list().subscribe((r) => (result = r));
    const req = httpMock.expectOne('/api/admin/domains');
    expect(req.request.method).toBe('GET');
    req.flush({ domains: [] });
    expect(result).toEqual({ domains: [] });
  });

  it('setMaintenance() PUTs the flag to the domain route', () => {
    service.setMaintenance('insurances', true).subscribe();
    const req = httpMock.expectOne('/api/admin/domains/insurances');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ inMaintenance: true });
    req.flush({});
  });
});
