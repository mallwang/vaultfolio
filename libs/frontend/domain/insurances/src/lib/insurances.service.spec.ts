import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { InsuranceContractInput, InsuranceSettings } from '@vaultfolio/api-contract';
import { InsurancesService, insurancesErrorOf } from './insurances.service';

describe('InsurancesService', () => {
  let service: InsurancesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(InsurancesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads everything in one call', () => {
    service.data().subscribe();
    http.expectOne('/api/insurances').flush({});
    expect(service.changes()).toBe(0);
  });

  it('writes and counts each successful write', () => {
    const input = { name: 'x' } as InsuranceContractInput;
    service.create(input).subscribe();
    const post = http.expectOne('/api/insurances/contracts');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toBe(input);
    post.flush({});
    service.update('a/b', input).subscribe();
    const put = http.expectOne('/api/insurances/contracts/a%2Fb');
    expect(put.request.method).toBe('PUT');
    put.flush({});
    service.delete('c1').subscribe();
    const del = http.expectOne('/api/insurances/contracts/c1');
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
    service.saveSettings({} as InsuranceSettings).subscribe();
    const settings = http.expectOne('/api/insurances/settings');
    expect(settings.request.method).toBe('PUT');
    settings.flush({});
    service.deleteAll().subscribe();
    const all = http.expectOne('/api/insurances');
    expect(all.request.method).toBe('DELETE');
    all.flush(null);
    expect(service.changes()).toBe(5);
  });

  it('flips unavailable on 503 INSURANCES_UNAVAILABLE and clears it on the next success', () => {
    service.data().subscribe({ error: () => undefined });
    http
      .expectOne('/api/insurances')
      .flush({ error: 'INSURANCES_UNAVAILABLE' }, { status: 503, statusText: 'x' });
    expect(service.unavailable()).toBe(true);
    service.data().subscribe();
    http.expectOne('/api/insurances').flush({});
    expect(service.unavailable()).toBe(false);
  });

  it('does not flip unavailable for other errors', () => {
    service.data().subscribe({ error: () => undefined });
    http.expectOne('/api/insurances').flush({ error: 'X' }, { status: 500, statusText: 'x' });
    expect(service.unavailable()).toBe(false);
  });

  it('normalizes errors', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: {
        error: 'INSURANCES_VALIDATION',
        details: [{ field: 'premium', message: 'INVALID' }],
      },
    });
    expect(insurancesErrorOf(error)).toEqual({
      status: 400,
      code: 'INSURANCES_VALIDATION',
      details: [{ field: 'premium', message: 'INVALID' }],
    });
    expect(insurancesErrorOf(new Error('x'))).toEqual({ status: 0, code: 'generic', details: [] });
  });
});
