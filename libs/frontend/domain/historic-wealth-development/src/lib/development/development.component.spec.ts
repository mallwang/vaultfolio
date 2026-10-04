import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { WealthSnapshot } from '@vaultfolio/api-contract';
import { WealthStore } from '../wealth-store';
import { DevelopmentComponent } from './development.component';

vi.mock('echarts', () => ({
  init: () => ({
    on: vi.fn(),
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
    showLoading: vi.fn(),
    hideLoading: vi.fn(),
  }),
}));

const snap = (
  id: string,
  snapshotDate: string,
  assets: string,
  liabilities = '0.00',
): WealthSnapshot => ({
  id,
  snapshotDate,
  entries: [
    { side: 'ASSET', class: { standard: 'cash' }, name: 'Bar', amount: assets },
    ...(liabilities === '0.00'
      ? []
      : [
          {
            side: 'LIABILITY' as const,
            class: { standard: 'loan' as const },
            name: 'Kredit',
            amount: liabilities,
          },
        ]),
  ],
  createdAt: '',
  updatedAt: '',
});

describe('DevelopmentComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  async function render(snapshots: WealthSnapshot[]) {
    const store = TestBed.inject(WealthStore);
    store.refresh();
    http.expectOne('/api/wealth/snapshots').flush(snapshots);
    http.expectOne('/api/wealth/settings').flush({ classGroups: [] });
    const fixture = TestBed.createComponent(DevelopmentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, store, el: fixture.nativeElement as HTMLElement };
  }

  const text = (el: HTMLElement, id: string) =>
    el.querySelector(`[data-testid="${id}"]`)?.textContent?.replace(/\s+/g, ' ').trim();

  it('shows the empty state with a call to action', async () => {
    const { el } = await render([]);
    expect(el.querySelector('[data-testid="wealth-empty"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="wealth-table"]')).toBeNull();
  });

  it('shows KPIs, chart and the table newest first with the oldest change as a dash', async () => {
    const { el } = await render([
      snap('b', '2025-06-30', '1500.00', '500.00'),
      snap('a', '2024-06-30', '800.00'),
    ]);
    expect(text(el, 'wealth-kpi-net-value')).toContain('1,000.00');
    expect(text(el, 'wealth-kpi-change-value')).toContain('+');
    expect(text(el, 'wealth-kpi-assets-value')).toContain('1,500.00');
    expect(text(el, 'wealth-kpi-liabilities-value')).toContain('500.00');
    expect(el.querySelector('[data-testid="wealth-chart"]')).not.toBeNull();
    const rows = Array.from(el.querySelectorAll('[data-testid^="wealth-row-"]'));
    expect(rows.map((r) => r.getAttribute('data-testid'))).toEqual([
      'wealth-row-b',
      'wealth-row-a',
    ]);
    expect(rows[0].classList.contains('latest')).toBe(true);
    expect(rows[1].textContent).toContain('–');
    expect(rows[0].querySelector('.liability')?.textContent).toContain('−');
  });

  it('shows n/a for the percent when the previous net worth is not positive', async () => {
    const { el } = await render([
      snap('a', '2024-06-30', '100.00', '300.00'),
      snap('b', '2025-06-30', '500.00'),
    ]);
    expect(text(el, 'wealth-kpi-change-pct')).toContain('n/a');
  });

  it('narrows chart, table and changes with the period filter', async () => {
    const { fixture, store, el } = await render([
      snap('a', '2020-01-31', '100.00'),
      snap('b', '2025-06-30', '200.00'),
      snap('c', '2026-01-31', '300.00'),
    ]);
    expect(el.querySelectorAll('[data-testid^="wealth-row-"]')).toHaveLength(3);
    store.period.set('1y');
    fixture.detectChanges();
    expect(el.querySelectorAll('[data-testid^="wealth-row-"]')).toHaveLength(2);
    expect(text(el, 'wealth-row-b')).toContain('–');
  });

  it('shows the single-snapshot state with a hint and a composition', async () => {
    const { el } = await render([snap('a', '2025-06-30', '100.00')]);
    expect(el.querySelector('[data-testid="wealth-single-note"]')).not.toBeNull();
    expect(text(el, 'wealth-composition-0')).toContain('100.0%');
    expect(el.querySelector('[data-testid="wealth-chart"]')).toBeNull();
    expect(text(el, 'wealth-kpi-change-value')).toContain('–');
  });

  it('renders 120 snapshots', async () => {
    const many = Array.from({ length: 120 }, (_, i) =>
      snap(
        `s${i}`,
        `${2000 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}-15`,
        `${1000 + i}.00`,
      ),
    );
    const { el } = await render(many);
    expect(el.querySelectorAll('[data-testid^="wealth-row-"]')).toHaveLength(120);
  }, 30_000);

  it('deletes after confirmation', async () => {
    const { fixture, el } = await render([snap('a', '2025-06-30', '100.00')]);
    (el.querySelector('[data-testid="wealth-delete-a"]') as HTMLElement).click();
    fixture.detectChanges();
    const confirm = document.querySelector('[data-testid="wealth-delete-confirm"]') as HTMLElement;
    expect(confirm).not.toBeNull();
    confirm.click();
    const req = http.expectOne('/api/wealth/snapshots/a');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    http.expectOne('/api/wealth/snapshots').flush([]);
    http.expectOne('/api/wealth/settings').flush({ classGroups: [] });
  });
});
