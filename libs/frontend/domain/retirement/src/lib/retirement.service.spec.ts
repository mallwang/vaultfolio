import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { RetirementRecordInput } from '@vaultfolio/api-contract';
import { RetirementService } from './retirement.service';

describe('RetirementService', () => {
  let service: RetirementService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RetirementService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the summary and the records with an optional pillar filter', () => {
    service.summary().subscribe();
    http.expectOne('/api/retirement/summary').flush({});
    service.records('PRIVATE').subscribe();
    http.expectOne('/api/retirement/records?pillar=PRIVATE').flush([]);
    service.records().subscribe();
    const all = http.expectOne('/api/retirement/records');
    expect(all.request.params.keys()).toEqual([]);
    all.flush([]);
    service.record('r/1').subscribe();
    http.expectOne('/api/retirement/records/r%2F1').flush({});
  });

  it('writes records and counts each successful write', () => {
    const input = { contractType: 'RIESTER', origin: 'MANUAL' } as RetirementRecordInput;
    expect(service.changes()).toBe(0);
    service.create(input).subscribe();
    const post = http.expectOne('/api/retirement/records');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toBe(input);
    post.flush({});
    service.update('r1', input).subscribe();
    expect(http.expectOne('/api/retirement/records/r1').request.method).toBe('PUT');
    service.updateSupplement('r1', { contributionMonthly: '50.00' }).subscribe();
    const patch = http.expectOne('/api/retirement/records/r1/supplement');
    expect(patch.request.method).toBe('PATCH');
    patch.flush({});
    service.delete('r1').subscribe();
    expect(http.expectOne('/api/retirement/records/r1').request.method).toBe('DELETE');
    service.deleteAll().subscribe();
    expect(http.expectOne('/api/retirement').request.method).toBe('DELETE');
    // only the calls that were answered (POST, PATCH) count; the rest stay pending
    expect(service.changes()).toBe(2);
    http.match(() => true).forEach((r) => r.flush(null));
  });

  it('flips unavailable on a 503 RETIREMENT_UNAVAILABLE and clears it on success', () => {
    service.summary().subscribe({ error: () => undefined });
    http
      .expectOne('/api/retirement/summary')
      .flush({ error: 'RETIREMENT_UNAVAILABLE' }, { status: 503, statusText: 'Unavailable' });
    expect(service.unavailable()).toBe(true);
    service.records().subscribe();
    http.expectOne('/api/retirement/records').flush([]);
    expect(service.unavailable()).toBe(false);
  });

  it('does not flip unavailable for other errors', () => {
    service.summary().subscribe({ error: () => undefined });
    http
      .expectOne('/api/retirement/summary')
      .flush({ error: 'X' }, { status: 500, statusText: 'Error' });
    expect(service.unavailable()).toBe(false);
  });
});
