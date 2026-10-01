import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { RequestDetail } from '@vaultfolio/api-contract';
import { RequestDetailComponent } from './request-detail.component';

const detail = (overrides: Partial<RequestDetail> = {}): RequestDetail => ({
  id: '12345678-aaaa',
  feature: 'earnings',
  type: 'new-parser',
  requesterEmail: 'member@example.com',
  status: 'OPEN',
  note: null,
  createdAt: '2026-10-01T10:00:00.000Z',
  handledByEmail: null,
  handledAt: null,
  closedAt: null,
  sampleDeletesAt: null,
  possibleDuplicate: false,
  payload: { schemaVersion: 1, pages: 1, lines: [], period: null },
  attachment: {
    contentType: 'application/pdf',
    sizeBytes: 2048,
    pageCount: 1,
    sha256: 'a'.repeat(64),
    downloadCount: 2,
    lastDownloadedAt: '2026-10-02T10:00:00.000Z',
  },
  sampleDeleted: false,
  ...overrides,
});

describe('RequestDetailComponent', () => {
  let fixture: ComponentFixture<RequestDetailComponent>;
  let http: HttpTestingController;
  const el = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);

  const open = (d: RequestDetail) => {
    fixture = TestBed.createComponent(RequestDetailComponent);
    fixture.componentRef.setInput('id', d.id);
    fixture.detectChanges();
    http.expectOne(`/api/requests/${d.id}`).flush(d);
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RequestDetailComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('shows the sample meta, the download audit and a download action', () => {
    open(detail());
    expect(el('request-detail-sample')?.textContent).toContain('2.0 kB');
    expect(el('request-detail-sample')?.textContent).toContain('a'.repeat(64));
    expect(el('request-detail-audit')?.textContent).toContain('2');
    expect(el('request-detail-download')).not.toBeNull();
  });

  it('downloads the sample as a file and refreshes the audit', () => {
    open(detail());
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    (el('request-detail-download') as HTMLButtonElement).click();
    http.expectOne('/api/requests/12345678-aaaa/attachment').flush(new Blob(['%PDF']));
    expect(click).toHaveBeenCalled();
    http.expectOne('/api/requests/12345678-aaaa').flush(detail());
    click.mockRestore();
  });

  it('shows a notice instead of an error page once the sample was deleted', () => {
    open(detail({ attachment: null, payload: null, sampleDeleted: true, status: 'DONE' }));
    expect(el('request-detail-sample-gone')).not.toBeNull();
    expect(el('request-detail-download')).toBeNull();
    expect(el('request-detail-error')).toBeNull();
    expect(el('request-detail-handling')).not.toBeNull();
  });

  it('flags a possible duplicate', () => {
    open(detail({ possibleDuplicate: true }));
    expect(el('request-detail-duplicate')).not.toBeNull();
  });

  it('saves only the changed fields and refreshes the open count', () => {
    open(detail());
    const comp = fixture.componentInstance as unknown as {
      status: { set(v: string): void };
      note: { set(v: string): void };
    };
    expect((el('request-detail-save') as HTMLButtonElement).disabled).toBe(true);
    comp.status.set('DONE');
    comp.note.set('shipped');
    fixture.detectChanges();
    (el('request-detail-save') as HTMLButtonElement).click();
    const patch = http.expectOne('/api/requests/12345678-aaaa');
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ status: 'DONE', note: 'shipped' });
    patch.flush(detail({ status: 'DONE', note: 'shipped', closedAt: '2026-10-03T10:00:00.000Z' }));
    http.expectOne((r) => r.url === '/api/requests').flush({ openCount: 0, items: [] });
    fixture.detectChanges();
    expect(el('request-detail-message')?.textContent).toContain('Request updated.');
  });

  it('shows an error message when saving fails', () => {
    open(detail());
    (fixture.componentInstance as unknown as { note: { set(v: string): void } }).note.set('x');
    fixture.detectChanges();
    (el('request-detail-save') as HTMLButtonElement).click();
    http.expectOne('/api/requests/12345678-aaaa').error(new ProgressEvent('error'));
    fixture.detectChanges();
    expect(el('request-detail-message')?.textContent).toContain('could not be saved');
  });

  it('renders no payload card for a type without a registered view (generic fallback)', () => {
    open(detail({ feature: 'holdings', type: 'other' }));
    expect(el('request-detail-payload')).toBeNull();
    expect(el('request-detail-handling')).not.toBeNull();
  });

  it('shows a load error', () => {
    fixture = TestBed.createComponent(RequestDetailComponent);
    fixture.componentRef.setInput('id', 'missing');
    fixture.detectChanges();
    http.expectOne('/api/requests/missing').flush({}, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(el('request-detail-error')).not.toBeNull();
  });
});
