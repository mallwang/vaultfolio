import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { RequestListItem } from '@vaultfolio/api-contract';
import { RequestsTableComponent } from './requests-table.component';

const item = (overrides: Partial<RequestListItem> = {}): RequestListItem => ({
  id: 'r1',
  feature: 'earnings',
  type: 'new-parser',
  requesterEmail: 'member@example.com',
  status: 'OPEN',
  createdAt: '2026-10-01T10:00:00.000Z',
  possibleDuplicate: false,
  closedAt: null,
  sampleDeletesAt: null,
  hasSample: true,
  ...overrides,
});

describe('RequestsTableComponent', () => {
  let fixture: ComponentFixture<RequestsTableComponent>;
  let http: HttpTestingController;

  const flush = (items: RequestListItem[]) => {
    http.expectOne((r) => r.url === '/api/requests').flush({ openCount: 1, items });
    fixture.detectChanges();
  };
  const text = (): string => fixture.nativeElement.textContent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RequestsTableComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(RequestsTableComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('renders registry labels, requester, status and an open link per row', () => {
    flush([item()]);
    const row = fixture.nativeElement.querySelector('[data-testid="requests-row-r1"]');
    expect(row.textContent).toContain('Earnings');
    expect(row.textContent).toContain('New parser');
    expect(row.textContent).toContain('member@example.com');
    expect(row.textContent).toContain('Open');
    expect(row.querySelector('[data-testid="requests-open-r1"]')).not.toBeNull();
    expect(row.classList).toContain('row--open');
  });

  it('keeps the server order (newest first)', () => {
    flush([item({ id: 'new' }), item({ id: 'old', createdAt: '2026-09-01T10:00:00.000Z' })]);
    const ids = [...fixture.nativeElement.querySelectorAll('[data-testid^="requests-row-"]')].map(
      (el: Element) => el.getAttribute('data-testid'),
    );
    expect(ids).toEqual(['requests-row-new', 'requests-row-old']);
  });

  it('tags a possible duplicate and shows when a closed sample will be deleted', () => {
    flush([
      item({ possibleDuplicate: true }),
      item({
        id: 'r2',
        status: 'DONE',
        closedAt: '2026-10-01T10:00:00.000Z',
        sampleDeletesAt: '2026-10-31T10:00:00.000Z',
      }),
      item({ id: 'r3', status: 'DONE', closedAt: '2026-08-01T10:00:00.000Z', hasSample: false }),
    ]);
    expect(text()).toContain('Possible duplicate');
    expect(
      fixture.nativeElement.querySelector('[data-testid="requests-sample-deletes"]'),
    ).not.toBeNull();
    expect(text()).toContain('Sample deleted');
  });

  it('shows the empty state and falls back to raw keys for an unknown type', () => {
    flush([]);
    expect(text()).toContain('No requests yet.');
  });

  it('labels an unregistered type with its raw keys', () => {
    flush([item({ feature: 'holdings', type: 'new-thing' })]);
    expect(text()).toContain('holdings');
    expect(text()).toContain('new-thing');
  });

  it('reloads with the chosen status filter', () => {
    flush([item()]);
    fixture.componentInstance['onFilter']('DONE');
    const req = http.expectOne((r) => r.url === '/api/requests');
    expect(req.request.params.getAll('status')).toEqual(['DONE']);
    req.flush({ openCount: 1, items: [] });
  });

  it('shows an error when loading fails', () => {
    http.expectOne((r) => r.url === '/api/requests').error(new ProgressEvent('error'));
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[data-testid="requests-load-error"]'),
    ).not.toBeNull();
  });

  it('scrolls horizontally inside its own container', () => {
    flush([item()]);
    expect(fixture.nativeElement.querySelector('.scroll')).not.toBeNull();
  });
});
