import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RequestsService } from './requests.service';

describe('RequestsService', () => {
  let service: RequestsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RequestsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists with a repeated status filter and keeps the open count', () => {
    service.list(['OPEN', 'DONE']).subscribe();
    const req = http.expectOne((r) => r.url === '/api/requests');
    expect(req.request.params.getAll('status')).toEqual(['OPEN', 'DONE']);
    req.flush({ openCount: 4, items: [] });
    expect(service.openCount()).toBe(4);
  });

  it('lists without a filter', () => {
    service.list().subscribe();
    const req = http.expectOne((r) => r.url === '/api/requests');
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ openCount: 0, items: [] });
  });

  it('gets and patches one request', () => {
    service.get('r1').subscribe();
    http.expectOne('/api/requests/r1').flush({});
    service.update('r1', { status: 'DONE', note: 'ok' }).subscribe();
    const patch = http.expectOne('/api/requests/r1');
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ status: 'DONE', note: 'ok' });
    patch.flush({});
  });

  it('downloads the attachment as a blob', () => {
    service.downloadAttachment('r1').subscribe();
    const req = http.expectOne('/api/requests/r1/attachment');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['%PDF']));
  });

  it('refreshOpenCount asks for open requests and swallows errors', () => {
    service.refreshOpenCount();
    http.expectOne((r) => r.url === '/api/requests').error(new ProgressEvent('error'));
    expect(service.openCount()).toBe(0);
  });
});
