import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EncryptionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('status() issues a GET to /api/admin/encryption/status', () => {
    let result: unknown;
    service.status().subscribe((r) => (result = r));
    const req = httpMock.expectOne('/api/admin/encryption/status');
    expect(req.request.method).toBe('GET');
    req.flush({ domains: [] });
    expect(result).toEqual({ domains: [] });
  });

  it('history() sends the limit and optional domain as query parameters', () => {
    service.history().subscribe();
    const all = httpMock.expectOne((r) => r.url === '/api/admin/encryption/history');
    expect(all.request.params.get('limit')).toBe('50');
    expect(all.request.params.has('domain')).toBe(false);
    all.flush({ runs: [] });

    service.history('wealth', 5).subscribe();
    const one = httpMock.expectOne((r) => r.url === '/api/admin/encryption/history');
    expect(one.request.params.get('domain')).toBe('wealth');
    expect(one.request.params.get('limit')).toBe('5');
    one.flush({ runs: [] });
  });

  it('rotateMasterKey() posts to the domain route', () => {
    service.rotateMasterKey('wealth').subscribe();
    const req = httpMock.expectOne('/api/admin/encryption/domains/wealth/master-key-rotation');
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('startReencryption() posts the confirmation', () => {
    service.startReencryption('account-overview', 'account-overview').subscribe();
    const req = httpMock.expectOne('/api/admin/encryption/domains/account-overview/reencryption');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ confirm: 'account-overview' });
    req.flush({});
  });

  it('destroyDataKey() posts to the version route', () => {
    service.destroyDataKey('earnings', 2).subscribe();
    const req = httpMock.expectOne('/api/admin/encryption/domains/earnings/data-keys/2/destroy');
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('propagates an error', () => {
    let error: unknown;
    service.status().subscribe({ error: (e) => (error = e) });
    httpMock
      .expectOne('/api/admin/encryption/status')
      .error(new ProgressEvent('error'), { status: 403 });
    expect(error).toBeDefined();
  });
});
