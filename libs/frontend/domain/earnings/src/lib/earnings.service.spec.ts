import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { EarningsService } from './earnings.service';

describe('EarningsService', () => {
  let service: EarningsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EarningsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('calls every route with the employer filter', () => {
    service.overview('e1').subscribe();
    http.expectOne('/api/earnings/overview?employer=e1').flush({});
    service.overview(null).subscribe();
    http.expectOne('/api/earnings/overview').flush({});
    service.tables('e1').subscribe();
    http.expectOne('/api/earnings/tables?employer=e1').flush({});
    service.dataCheck().subscribe();
    http.expectOne('/api/earnings/data-check').flush([]);
    service.records('2026-09').subscribe();
    http.expectOne('/api/earnings/records?period=2026-09').flush([]);
    service.records().subscribe();
    const all = http.expectOne('/api/earnings/records');
    expect(all.request.params.keys()).toEqual([]);
    all.flush([]);
  });

  it('posts import batches and manages data', () => {
    const batch = { files: [] };
    service.preview(batch).subscribe();
    const preview = http.expectOne('/api/earnings/imports/preview');
    expect(preview.request.method).toBe('POST');
    expect(preview.request.body).toBe(batch);
    preview.flush({ files: [] });
    service.commit(batch).subscribe();
    expect(http.expectOne('/api/earnings/imports').request.method).toBe('POST');
    service.imports().subscribe();
    http.expectOne((r) => r.method === 'GET' && r.url === '/api/earnings/imports').flush([]);
    service.deleteImport('i/1').subscribe();
    expect(http.expectOne('/api/earnings/imports/i%2F1').request.method).toBe('DELETE');
    service.deleteAll().subscribe();
    expect(http.expectOne('/api/earnings').request.method).toBe('DELETE');
    service.employers().subscribe();
    http.expectOne('/api/earnings/employers').flush([]);
    service.renameEmployer('e1', 'X').subscribe();
    const put = http.expectOne('/api/earnings/employers/e1');
    expect(put.request.body).toEqual({ displayName: 'X' });
  });

  it('flags the domain unavailable on 503 EARNINGS_UNAVAILABLE and recovers on success', () => {
    service.overview().subscribe({ error: () => undefined });
    http
      .expectOne('/api/earnings/overview')
      .flush({ error: 'EARNINGS_UNAVAILABLE', message: 'x' }, { status: 503, statusText: 'x' });
    expect(service.unavailable()).toBe(true);
    service.overview().subscribe();
    http.expectOne('/api/earnings/overview').flush({});
    expect(service.unavailable()).toBe(false);
  });

  it('does not flag other errors', () => {
    service.overview().subscribe({ error: () => undefined });
    http
      .expectOne('/api/earnings/overview')
      .flush({ error: 'x' }, { status: 500, statusText: 'x' });
    expect(service.unavailable()).toBe(false);
  });
});
