import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import type { EarningsFilePreview } from '@vaultfolio/api-contract';
import { textDocument } from '@vaultfolio/earnings';
import {
  LSTB_2025_BRIGHTLINE,
  SAP_AUG_2026,
  SAP_AUG_2026_NET_OFF,
  SAP_SEP_2026_WITH_CORRECTION,
} from '@vaultfolio/earnings/testing';
import { EarningsImportComponent } from './earnings-import.component';
import { EARNINGS_FILE_READER } from './import-session.store';

const PAGES: Record<string, string[][]> = {
  [SAP_SEP_2026_WITH_CORRECTION.fileName]: SAP_SEP_2026_WITH_CORRECTION.pages,
  [SAP_AUG_2026.fileName]: SAP_AUG_2026.pages,
  [SAP_AUG_2026_NET_OFF.fileName]: SAP_AUG_2026_NET_OFF.pages,
  [LSTB_2025_BRIGHTLINE.fileName]: LSTB_2025_BRIGHTLINE.pages,
};

function pdf(name: string): File {
  return new File(['%PDF'], name, { type: 'application/pdf' });
}

function preview(
  clientFileId: string,
  partial: Partial<EarningsFilePreview> = {},
): EarningsFilePreview {
  return {
    clientFileId,
    status: 'NEW',
    employers: ['Brightline Software GmbH'],
    periods: ['2026-08'],
    years: [],
    recordCount: 1,
    certificateCount: 0,
    includesCorrection: false,
    replaces: [],
    duplicateOf: null,
    conflictsWith: null,
    rejection: null,
    ...partial,
  };
}

describe('EarningsImportComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: EARNINGS_FILE_READER,
          useValue: {
            extractPdfText: async (file: File) =>
              file.name === 'scan.pdf'
                ? { error: 'IMAGE_ONLY' }
                : { text: textDocument(PAGES[file.name]) },
            sha256Hex: async (file: File) => file.name.length.toString(16).padStart(64, '0'),
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  async function settle(fixture: {
    detectChanges(): void;
    whenStable(): Promise<unknown>;
  }): Promise<void> {
    for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function byTestId(root: HTMLElement, id: string): HTMLElement | null {
    return root.querySelector(`[data-testid="${id}"]`);
  }

  it('shows the dropzone, the supported formats and the device banner', () => {
    const fixture = TestBed.createComponent(EarningsImportComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(byTestId(root, 'earnings-import-dropzone')?.textContent).toContain(
      'SAP payslip (Entgeltnachweis)',
    );
    expect(byTestId(root, 'earnings-import-device-banner')?.textContent).toContain(
      'Documents stay on your device',
    );
    expect(byTestId(root, 'earnings-import-confirm')).toBeNull();
  });

  it('lists each file with its outcome and reason, and imports the ready ones', async () => {
    const fixture = TestBed.createComponent(EarningsImportComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const input = byTestId(root, 'earnings-import-input') as HTMLInputElement;
    const files = [
      pdf(SAP_SEP_2026_WITH_CORRECTION.fileName),
      pdf(SAP_AUG_2026.fileName),
      pdf(SAP_AUG_2026_NET_OFF.fileName),
      pdf('scan.pdf'),
      pdf(LSTB_2025_BRIGHTLINE.fileName),
    ];
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    input.dispatchEvent(new Event('change'));
    await settle(fixture);

    http.expectOne('/api/earnings/imports/preview').flush({
      files: [
        preview('file-1', {
          status: 'REPLACES',
          periods: ['2026-07', '2026-09'],
          recordCount: 2,
          includesCorrection: true,
          replaces: [
            {
              employer: 'Brightline Software GmbH',
              period: '2026-07',
              kind: 'REGULAR',
              seq: 1,
              year: null,
              importedAt: '2026-08-02T10:00:00.000Z',
              fileName: 'old.pdf',
            },
          ],
        }),
        preview('file-2', {
          status: 'DUPLICATE',
          duplicateOf: {
            importId: 'i0',
            importedAt: '2026-09-02T10:00:00.000Z',
            fileName: 'x.pdf',
          },
        }),
        preview('file-5', { periods: [], years: [2025], recordCount: 0, certificateCount: 1 }),
      ],
    });
    await settle(fixture);

    expect(byTestId(root, 'earnings-import-progress')?.textContent).toContain('Read 5 of 5 files');
    expect(byTestId(root, 'earnings-import-status-file-1')?.textContent).toContain('Replaces');
    expect(byTestId(root, 'earnings-import-row-file-1')?.textContent).toContain(
      'includes correction',
    );
    expect(byTestId(root, 'earnings-import-row-file-1')?.textContent).toContain(
      'Replaces the Jul 2026 figures',
    );
    expect(byTestId(root, 'earnings-import-status-file-2')?.textContent).toContain('Duplicate');
    expect(byTestId(root, 'earnings-import-row-file-2')?.textContent).toContain(
      'Already imported on',
    );
    expect(byTestId(root, 'earnings-import-status-file-3')?.textContent).toContain('Rejected');
    expect(byTestId(root, 'earnings-import-row-file-3')?.textContent).toContain(
      'Check failed for Aug 2026: Gross − taxes − social insurance = net is off by +€12.40.',
    );
    expect(byTestId(root, 'earnings-import-row-file-4')?.textContent).toContain('scanned document');
    expect(byTestId(root, 'earnings-import-row-file-5')?.textContent).toContain(
      'Wage-tax certificate (Lohnsteuerbescheinigung)',
    );
    expect(byTestId(root, 'earnings-import-row-file-5')?.textContent).toContain('Year 2025');
    expect(byTestId(root, 'earnings-import-summary-ready')?.textContent).toContain(
      '2 files ready (3 records)',
    );

    (byTestId(root, 'earnings-import-figures-toggle-file-1') as HTMLButtonElement).click();
    fixture.detectChanges();
    const figures = byTestId(root, 'earnings-import-figures-file-1')?.textContent ?? '';
    expect(figures).toContain('Statutory net');
    expect(figures).toContain('€3,221.20');
    expect(figures).toContain('Correction');

    const confirm = byTestId(root, 'earnings-import-confirm') as HTMLButtonElement;
    expect(confirm.textContent).toContain('Import 2 files');
    confirm.click();
    const commit = http.expectOne('/api/earnings/imports');
    expect(commit.request.body.files.map((f: { clientFileId: string }) => f.clientFileId)).toEqual([
      'file-1',
      'file-5',
    ]);
    commit.flush({
      files: [
        { clientFileId: 'file-1', status: 'SAVED', importId: 'i1', recordCount: 2 },
        { clientFileId: 'file-5', status: 'SAVED', importId: 'i2', certificateCount: 1 },
      ],
    });
    await settle(fixture);

    expect(byTestId(root, 'earnings-import-done')?.textContent).toContain('2 files imported');
    expect(byTestId(root, 'earnings-import-row-file-1')).toBeNull();
  });

  describe('correcting a misread figure (FR-012a)', () => {
    async function openNetOff() {
      const fixture = TestBed.createComponent(EarningsImportComponent);
      fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement;
      const input = byTestId(root, 'earnings-import-input') as HTMLInputElement;
      Object.defineProperty(input, 'files', {
        value: [pdf(SAP_AUG_2026_NET_OFF.fileName)],
        configurable: true,
      });
      input.dispatchEvent(new Event('change'));
      await settle(fixture);
      return { fixture, root };
    }

    const wageTax = 'earnings-import-figure-wageTax-file-1-0';

    function type(root: HTMLElement, id: string, text: string) {
      const field = byTestId(root, id) as HTMLInputElement;
      field.value = text;
      field.dispatchEvent(new Event('input'));
    }

    it('shows the grid of a rejected file with the involved figures flagged and confirm disabled', async () => {
      const { root } = await openNetOff();
      expect(byTestId(root, 'earnings-import-status-file-1')?.textContent).toContain('Rejected');
      const message = byTestId(root, 'earnings-import-check-message-file-1');
      expect(message?.textContent).toContain('Gross (total gross)');
      expect(message?.textContent).toContain('Statutory net');

      const field = byTestId(root, wageTax) as HTMLInputElement;
      expect(field.value).toBe('800.00');
      expect(field.disabled).toBe(false);
      expect(field.getAttribute('aria-invalid')).toBe('true');
      expect(field.getAttribute('aria-describedby')).toBe(message?.id);
      expect(field.closest('.field')?.textContent).toContain('In failing check');

      const taxGross = byTestId(
        root,
        'earnings-import-figure-taxGross-file-1-0',
      ) as HTMLInputElement;
      expect(taxGross.disabled).toBe(true);
      expect((byTestId(root, 'earnings-import-confirm') as HTMLButtonElement).disabled).toBe(true);
      expect(root.querySelector('label[for="' + wageTax + '"]')?.textContent).toContain('Wage tax');
    });

    it('shows an inline error linked by aria-describedby for text that is no amount', async () => {
      const { fixture, root } = await openNetOff();
      type(root, wageTax, '78x');
      fixture.detectChanges();
      const field = byTestId(root, wageTax) as HTMLInputElement;
      expect(field.getAttribute('aria-invalid')).toBe('true');
      expect(field.getAttribute('aria-describedby')).toContain(wageTax + '-error');
      expect(root.querySelector('#' + wageTax + '-error')?.textContent).toContain(
        'Enter an amount, for example 1,234.56',
      );
    });

    it('flips to "Corrected by you" and enables confirm once the checks pass, and restores', async () => {
      const { fixture, root } = await openNetOff();
      type(root, wageTax, '787,60');
      http.expectOne('/api/earnings/imports/preview').flush({ files: [preview('file-1')] });
      await settle(fixture);

      expect(byTestId(root, 'earnings-import-status-file-1')?.textContent).toContain(
        'Corrected by you',
      );
      expect(byTestId(root, 'earnings-import-check-message-file-1')?.textContent).toContain(
        'All checks pass again',
      );
      expect(byTestId(root, 'earnings-import-corrected-count-file-1')?.textContent).toContain(
        '1 figure corrected by you',
      );
      expect(byTestId(root, 'earnings-import-corrected-count')?.textContent).toContain(
        '1 figure corrected by you',
      );
      const field = byTestId(root, wageTax) as HTMLInputElement;
      expect(field.closest('.field')?.textContent).toContain('corrected by you');
      expect(field.closest('.field')?.textContent).toContain('Read from document: €800.00');
      expect((byTestId(root, 'earnings-import-confirm') as HTMLButtonElement).disabled).toBe(false);

      (
        byTestId(root, 'earnings-import-figure-restore-wageTax-file-1-0') as HTMLButtonElement
      ).click();
      await settle(fixture);
      expect(byTestId(root, 'earnings-import-status-file-1')?.textContent).toContain('Rejected');
      expect((byTestId(root, wageTax) as HTMLInputElement).value).toBe('800.00');
      expect((byTestId(root, 'earnings-import-confirm') as HTMLButtonElement).disabled).toBe(true);
    });
  });
});
