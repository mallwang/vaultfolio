import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HoldingsService } from './holdings.service';

describe('HoldingsService', () => {
  let service: HoldingsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(HoldingsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list GETs /api/holdings', () => {
    let result: unknown;
    service.list().subscribe((r) => (result = r));
    const req = httpMock.expectOne('/api/holdings');
    expect(req.request.method).toBe('GET');
    req.flush([]);
    expect(result).toEqual([]);
  });

  it('create POSTs the body to /api/holdings', () => {
    const body = {
      assetType: 'DEPOSIT_MONEY',
      management: 'Bank',
      name: 'Savings',
      currentValue: '10',
    } as const;
    service.create(body).subscribe();
    const req = httpMock.expectOne('/api/holdings');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('update PUTs the body to /api/holdings/:id', () => {
    const body = { management: 'Bank', name: 'Savings', currentValue: '20' };
    service.update('h-1', body).subscribe();
    const req = httpMock.expectOne('/api/holdings/h-1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('delete DELETEs /api/holdings/:id', () => {
    service.delete('h-1').subscribe();
    const req = httpMock.expectOne('/api/holdings/h-1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('surfaces a 400 with errors[] to the subscriber', () => {
    let error: { status: number; error: { errors: { field: string; code: string }[] } } | undefined;
    service
      .create({ assetType: 'DEPOSIT_MONEY', management: '', name: 'x', currentValue: '1' })
      .subscribe({
        error: (e) => (error = e),
      });
    httpMock.expectOne('/api/holdings').flush(
      {
        message: 'One or more fields are invalid.',
        errors: [{ field: 'management', code: 'REQUIRED' }],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(error?.status).toBe(400);
    expect(error?.error.errors).toEqual([{ field: 'management', code: 'REQUIRED' }]);
  });
});
