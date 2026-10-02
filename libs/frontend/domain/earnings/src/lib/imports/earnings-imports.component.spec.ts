import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import type { EarningsImportSummary } from '@vaultfolio/api-contract';
import { ConfirmationService } from 'primeng/api';
import { EarningsImportsComponent } from './earnings-imports.component';

const IMPORTS: EarningsImportSummary[] = [
  {
    id: 'i2',
    fileName: '2025_Lohnsteuerbescheinigung.pdf',
    sourceType: 'CERTIFICATE_PDF',
    parserId: 'lohnsteuerbescheinigung',
    parserVersion: '1.0.0',
    importedAt: '2026-09-20T10:00:00.000Z',
    recordCount: 0,
    certificateCount: 1,
    employers: ['Brightline Software GmbH'],
    firstPeriod: null,
    lastPeriod: null,
    years: [2025],
    correctedCount: 0,
    recognisedText: false,
  },
  {
    id: 'i1',
    fileName: '2026_09_Entgeltnachweis.pdf',
    sourceType: 'PAYSLIP_PDF',
    parserId: 'sap-entgeltnachweis',
    parserVersion: '1.0.0',
    importedAt: '2026-09-19T10:00:00.000Z',
    recordCount: 2,
    certificateCount: 0,
    employers: ['Brightline Software GmbH'],
    firstPeriod: '2026-07',
    lastPeriod: '2026-09',
    years: [],
    correctedCount: 1,
    recognisedText: true,
  },
  {
    id: 'i3',
    fileName: 'earnings-export.json',
    sourceType: 'EXPORT_JSON',
    parserId: 'earnings-export',
    parserVersion: '1',
    importedAt: '2026-09-18T10:00:00.000Z',
    recordCount: 3,
    certificateCount: 1,
    employers: ['Deutsche Musterbank'],
    firstPeriod: '2013-10',
    lastPeriod: '2013-12',
    years: [2013],
    correctedCount: 0,
    recognisedText: false,
  },
];

describe('EarningsImportsComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  async function create() {
    const fixture = TestBed.createComponent(EarningsImportsComponent);
    fixture.detectChanges();
    http.expectOne('/api/earnings/imports').flush(IMPORTS);
    http
      .expectOne('/api/earnings/employers')
      .flush([{ id: 'e1', detectedName: 'Brightline Software GmbH', displayName: null }]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  function byTestId(root: HTMLElement, id: string): HTMLElement | null {
    return root.querySelector(`[data-testid="${id}"]`);
  }

  it('groups the history by year, newest first, all collapsed initially', async () => {
    const fixture = await create();
    const root = fixture.nativeElement as HTMLElement;

    const headers = [...root.querySelectorAll('[data-testid^="earnings-imports-year-"]')];
    expect(headers.map((h) => h.getAttribute('data-testid'))).toEqual([
      'earnings-imports-year-2026',
      'earnings-imports-year-2025',
      'earnings-imports-year-2013',
    ]);
    expect(headers[0].textContent).toContain('1 import');
    expect(byTestId(root, 'earnings-imports-row-i1')).toBeNull();
    expect(byTestId(root, 'earnings-imports-row-i2')).toBeNull();

    byTestId(root, 'earnings-imports-year-2026')?.click();
    fixture.detectChanges();
    expect(byTestId(root, 'earnings-imports-row-i1')).not.toBeNull();

    byTestId(root, 'earnings-imports-year-2025')?.click();
    fixture.detectChanges();
    expect(byTestId(root, 'earnings-imports-row-i2')).not.toBeNull();
    expect(byTestId(root, 'earnings-imports-row-i3')).toBeNull();

    byTestId(root, 'earnings-imports-year-2026')?.click();
    fixture.detectChanges();
    expect(byTestId(root, 'earnings-imports-row-i1')).toBeNull();
  });

  it('shows the privacy note, the history with parser versions and the danger zone', async () => {
    const fixture = await create();
    const root = fixture.nativeElement as HTMLElement;
    byTestId(root, 'earnings-imports-toggle-all')?.click();
    fixture.detectChanges();

    expect(root.querySelector('#privacy')).not.toBeNull();
    const payslip = byTestId(root, 'earnings-imports-row-i1')?.textContent ?? '';
    expect(payslip).toContain('Payslip PDF');
    expect(payslip).toContain('Jul 2026 – Sep 2026');
    expect(payslip).toContain('SAP payslip (Entgeltnachweis) 1.0.0');
    expect(byTestId(root, 'earnings-history-corrected')?.textContent).toContain(
      '1 figure corrected by you',
    );
    expect(root.querySelectorAll('[data-testid="earnings-history-corrected"]')).toHaveLength(1);
    const certificate = byTestId(root, 'earnings-imports-row-i2')?.textContent ?? '';
    expect(certificate).toContain('2025');
    expect(certificate).toContain('1 certificate');
    expect(byTestId(root, 'earnings-imports-row-i3')?.textContent).toContain('3 · 1 certificate');
    expect(byTestId(root, 'earnings-danger-zone')).not.toBeNull();
    expect(byTestId(root, 'earnings-employer-row-e1')?.textContent).toContain('Detected as');
  });

  it('marks only imports read via text recognition with the badge in the source column', async () => {
    const fixture = await create();
    const root = fixture.nativeElement as HTMLElement;
    byTestId(root, 'earnings-imports-toggle-all')?.click();
    fixture.detectChanges();

    expect(
      byTestId(root, 'earnings-imports-row-i1')?.querySelector('[data-testid="ocr-badge"]'),
    ).not.toBeNull();
    expect(
      byTestId(root, 'earnings-imports-row-i2')?.querySelector('[data-testid="ocr-badge"]'),
    ).toBeNull();
    expect(
      byTestId(root, 'earnings-imports-row-i3')?.querySelector('[data-testid="ocr-badge"]'),
    ).toBeNull();
    expect(root.querySelectorAll('[data-testid="ocr-badge"]')).toHaveLength(1);
    expect(byTestId(root, 'ocr-badge')?.textContent).toContain('Text recognition');
  });

  it('deletes an import after confirmation and reloads the history', async () => {
    const fixture = await create();
    const confirmation = fixture.debugElement.injector.get(ConfirmationService);
    const confirm = vi.spyOn(confirmation, 'confirm');

    byTestId(fixture.nativeElement, 'earnings-imports-year-2026')?.click();
    fixture.detectChanges();
    (byTestId(fixture.nativeElement, 'earnings-import-delete-i1') as HTMLButtonElement).click();
    const options = confirm.mock.calls[0][0];
    expect(options.message).toContain('2026_09_Entgeltnachweis.pdf');
    options.accept?.();

    http.expectOne({ method: 'DELETE', url: '/api/earnings/imports/i1' }).flush(null);
    http.expectOne('/api/earnings/imports').flush([IMPORTS[0]]);
    http.expectOne('/api/earnings/employers').flush([]);
    fixture.detectChanges();
    expect(byTestId(fixture.nativeElement, 'earnings-imports-row-i1')).toBeNull();
  });

  it('deletes all earnings data after confirmation', async () => {
    const fixture = await create();
    const confirm = vi.spyOn(fixture.debugElement.injector.get(ConfirmationService), 'confirm');

    (byTestId(fixture.nativeElement, 'earnings-delete-all') as HTMLButtonElement).click();
    confirm.mock.calls[0][0].accept?.();

    expect(confirm.mock.calls[0][0].header).toBe('Delete all earnings data?');
    http.expectOne({ method: 'DELETE', url: '/api/earnings' }).flush(null);
    http.expectOne('/api/earnings/imports').flush([]);
    http.expectOne('/api/earnings/employers').flush([]);
  });

  it('saves an employer display name — never a figure', async () => {
    const fixture = await create();
    const input = byTestId(fixture.nativeElement, 'earnings-employer-name-e1') as HTMLInputElement;
    input.value = 'Brightline';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (byTestId(fixture.nativeElement, 'earnings-employer-save-e1') as HTMLButtonElement).click();
    const request = http.expectOne({ method: 'PUT', url: '/api/earnings/employers/e1' });
    expect(request.request.body).toEqual({ displayName: 'Brightline' });
    request.flush({
      id: 'e1',
      detectedName: 'Brightline Software GmbH',
      displayName: 'Brightline',
    });
    http.expectOne('/api/earnings/imports').flush(IMPORTS);
    http.expectOne('/api/earnings/employers').flush([]);
  });
});
