import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { WealthSnapshotInput } from '@vaultfolio/api-contract';
import { WealthService, wealthErrorOf } from './wealth.service';

describe('WealthService', () => {
  let service: WealthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(WealthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads snapshots and settings', () => {
    service.snapshots().subscribe();
    http.expectOne('/api/wealth/snapshots').flush([]);
    service.snapshot('a/b').subscribe();
    http.expectOne('/api/wealth/snapshots/a%2Fb').flush({});
    service.settings().subscribe();
    http.expectOne('/api/wealth/settings').flush({ classGroups: [] });
    expect(service.changes()).toBe(0);
  });

  it('writes and counts each successful write', () => {
    const input = { snapshotDate: '2026-01-01', entries: [] } as WealthSnapshotInput;
    expect(service.changes()).toBe(0);
    service.create(input).subscribe();
    const post = http.expectOne('/api/wealth/snapshots');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toBe(input);
    post.flush({});
    service.update('s1', input).subscribe();
    const put = http.expectOne('/api/wealth/snapshots/s1');
    expect(put.request.method).toBe('PUT');
    put.flush({});
    service.delete('s1').subscribe();
    const del = http.expectOne('/api/wealth/snapshots/s1');
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
    service
      .upsertClassGroup({ side: 'ASSET', class: { custom: 'x' }, group: 'LIQUID' })
      .subscribe();
    const group = http.expectOne('/api/wealth/settings/class-groups');
    expect(group.request.method).toBe('PUT');
    group.flush({ classGroups: [] });
    service.deleteAll().subscribe();
    const all = http.expectOne('/api/wealth');
    expect(all.request.method).toBe('DELETE');
    all.flush(null);
    expect(service.changes()).toBe(5);
  });

  it('flips unavailable on 503 WEALTH_UNAVAILABLE and clears it on the next success', () => {
    service.snapshots().subscribe({ error: () => undefined });
    http
      .expectOne('/api/wealth/snapshots')
      .flush({ error: 'WEALTH_UNAVAILABLE' }, { status: 503, statusText: 'Unavailable' });
    expect(service.unavailable()).toBe(true);
    service.snapshots().subscribe();
    http.expectOne('/api/wealth/snapshots').flush([]);
    expect(service.unavailable()).toBe(false);
  });

  it('does not count failed writes', () => {
    service.delete('x').subscribe({ error: () => undefined });
    http.expectOne('/api/wealth/snapshots/x').flush({}, { status: 404, statusText: 'No' });
    expect(service.changes()).toBe(0);
  });
});

describe('wealthErrorOf', () => {
  it('extracts code, existingId and details from an HTTP error', () => {
    const error = new HttpErrorResponse({
      status: 409,
      error: {
        error: 'WEALTH_SNAPSHOT_DATE_EXISTS',
        existingId: 'abc',
        details: [{ field: 'f', message: 'M' }],
      },
    });
    expect(wealthErrorOf(error)).toEqual({
      status: 409,
      code: 'WEALTH_SNAPSHOT_DATE_EXISTS',
      existingId: 'abc',
      details: [{ field: 'f', message: 'M' }],
    });
  });

  it('falls back to generic for non-HTTP errors and bodies without a code', () => {
    expect(wealthErrorOf(new Error('x'))).toEqual({ status: 0, code: 'generic', details: [] });
    expect(wealthErrorOf(new HttpErrorResponse({ status: 500 })).code).toBe('generic');
  });
});
