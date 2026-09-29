import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { EarningsFilePreview, EarningsImportBatch } from '@vaultfolio/api-contract';
import { textDocument } from '@vaultfolio/earnings';
import {
  SAP_AUG_2026,
  SAP_AUG_2026_NET_OFF,
  SAP_SEP_2026_WITH_CORRECTION,
  validExport,
} from '@vaultfolio/earnings/testing';
import { EARNINGS_FILE_READER, ImportSessionStore } from './import-session.store';

const PAGES: Record<string, string[][]> = {
  [SAP_SEP_2026_WITH_CORRECTION.fileName]: SAP_SEP_2026_WITH_CORRECTION.pages,
  [SAP_AUG_2026.fileName]: SAP_AUG_2026.pages,
  [SAP_AUG_2026_NET_OFF.fileName]: SAP_AUG_2026_NET_OFF.pages,
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

describe('ImportSessionStore', () => {
  let store: ImportSessionStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ImportSessionStore,
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
    store = TestBed.inject(ImportSessionStore);
    http = TestBed.inject(HttpTestingController);
  });

  async function settle(): Promise<void> {
    for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
  }

  it('reads files on the device, sends only whitelisted figures of readable files, and marks local rejections', async () => {
    const adding = store.addFiles([
      pdf(SAP_AUG_2026.fileName),
      pdf(SAP_AUG_2026_NET_OFF.fileName),
      pdf('scan.pdf'),
      new File(['x'], 'notes.txt', { type: 'text/plain' }),
    ]);
    await settle();

    const request = http.expectOne('/api/earnings/imports/preview');
    const batch = request.request.body as EarningsImportBatch;
    expect(batch.files).toHaveLength(1);
    expect(batch.files[0]).toMatchObject({
      clientFileId: 'file-1',
      fileName: SAP_AUG_2026.fileName,
      sourceType: 'PAYSLIP_PDF',
      parserId: 'sap-entgeltnachweis',
      records: (SAP_AUG_2026.expected as { records: unknown[] }).records,
    });
    // Nothing but figures: no document text anywhere in the request.
    expect(JSON.stringify(batch)).not.toContain('Musterfrau');
    expect(JSON.stringify(batch)).not.toContain('IBAN');

    request.flush({ files: [preview('file-1')] });
    await adding;

    expect(store.phase()).toBe('ready');
    expect(store.read()).toBe(4);
    expect(store.rows().map((r) => r.localRejection?.code ?? null)).toEqual([
      null,
      'CHECK_FAILED',
      'IMAGE_ONLY',
      'UNSUPPORTED_FORMAT',
    ]);
    expect(store.rows()[1].localRejection?.params).toEqual({
      check: 'NET',
      period: '2026-08',
      difference: '12.40',
    });
    expect(store.ready()).toHaveLength(1);
    expect(store.readyRecords()).toBe(1);
    expect(store.rejected()).toBe(3);
  });

  it('reads an earnings-export JSON and rejects unparsable JSON as UNREADABLE', async () => {
    const adding = store.addFiles([
      new File([JSON.stringify(validExport())], 'export.json', { type: 'application/json' }),
      new File(['{not json'], 'broken.json', { type: 'application/json' }),
    ]);
    await settle();
    const request = http.expectOne('/api/earnings/imports/preview');
    expect((request.request.body as EarningsImportBatch).files[0]).toMatchObject({
      sourceType: 'EXPORT_JSON',
      parserId: 'earnings-export',
    });
    request.flush({ files: [preview('file-1')] });
    await adding;

    expect(store.rows()[1].localRejection).toEqual({ code: 'UNREADABLE' });
  });

  it('commits only files the preview marked New or Replaces', async () => {
    const adding = store.addFiles([
      pdf(SAP_SEP_2026_WITH_CORRECTION.fileName),
      pdf(SAP_AUG_2026.fileName),
    ]);
    await settle();
    http.expectOne('/api/earnings/imports/preview').flush({
      files: [
        preview('file-1', { status: 'REPLACES', recordCount: 2, includesCorrection: true }),
        preview('file-2', { status: 'DUPLICATE' }),
      ],
    });
    await adding;
    expect(store.skipped()).toBe(1);
    expect(store.readyRecords()).toBe(2);

    const committing = store.commit();
    const request = http.expectOne('/api/earnings/imports');
    expect((request.request.body as EarningsImportBatch).files.map((f) => f.clientFileId)).toEqual([
      'file-1',
    ]);
    request.flush({
      files: [{ clientFileId: 'file-1', status: 'SAVED', importId: 'i1', recordCount: 2 }],
    });

    expect(await committing).toBe(true);
    expect(store.phase()).toBe('done');
    expect(store.savedCount()).toBe(1);
  });

  it('reports a server error code and keeps the rows', async () => {
    const adding = store.addFiles([pdf(SAP_AUG_2026.fileName)]);
    await settle();
    http
      .expectOne('/api/earnings/imports/preview')
      .flush({ error: 'LIMIT_EXCEEDED' }, { status: 400, statusText: 'Bad Request' });
    await adding;

    expect(store.phase()).toBe('error');
    expect(store.errorCode()).toBe('LIMIT_EXCEEDED');
    expect(store.rows()).toHaveLength(1);
  });

  it('re-previews after a file is removed and resets when the list is empty', async () => {
    const adding = store.addFiles([pdf(SAP_AUG_2026.fileName), pdf('scan.pdf')]);
    await settle();
    http.expectOne('/api/earnings/imports/preview').flush({ files: [preview('file-1')] });
    await adding;

    store.remove('file-2');
    await settle();
    http.expectOne('/api/earnings/imports/preview').flush({ files: [preview('file-1')] });
    await settle();
    expect(store.rows()).toHaveLength(1);

    store.remove('file-1');
    expect(store.phase()).toBe('idle');
    http.verify();
  });
});
