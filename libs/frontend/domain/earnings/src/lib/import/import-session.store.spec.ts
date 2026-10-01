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

  describe('correcting a misread figure (FR-012a)', () => {
    /** The net-off payslip: printed net is 12.40 above gross − taxes − social, wage tax is 800.00. */
    async function addNetOff(): Promise<void> {
      await store.addFiles([pdf(SAP_AUG_2026_NET_OFF.fileName)]);
      http.expectNone('/api/earnings/imports/preview'); // nothing to send yet
    }

    async function answerPreview(status: EarningsFilePreview['status'] = 'NEW'): Promise<void> {
      http
        .expectOne('/api/earnings/imports/preview')
        .flush({ files: [preview('file-1', { status })] });
      await settle();
    }

    it('turns a CHECK_FAILED payslip into a needs-correction row with its figures and no preview call', async () => {
      await addNetOff();
      const [row] = store.rows();
      expect(row.state).toBe('needs-correction');
      expect(row.preview).toBeNull();
      expect(row.localRejection).toEqual({
        code: 'CHECK_FAILED',
        params: { check: 'NET', period: '2026-08', difference: '12.40' },
      });
      expect(row.draft?.[0].amounts.wageTax).toBe('800.00');
      expect(row.failures).toHaveLength(1);
      expect(row.editable.map((e) => e.key)).toEqual(
        expect.arrayContaining(['gross', 'wageTax', 'net']),
      );
      expect(row.editable.map((e) => e.key)).not.toContain('taxGross');
      expect(store.rejected()).toBe(1);
      expect(store.ready()).toEqual([]);
    });

    it('keeps the row rejected on text that is no amount and records an input error', async () => {
      await addNetOff();
      store.editFigure('file-1', 0, 'wageTax', '78x');
      const [row] = store.rows();
      expect(row.state).toBe('needs-correction');
      expect(row.inputErrors).toEqual({ '0:wageTax': true });
      expect(row.inputs['0:wageTax']).toBe('78x');
      expect(row.draft?.[0].amounts.wageTax).toBe('800.00');
      expect(row.draft?.[0].corrected).toBeUndefined();
    });

    it('keeps the row rejected with the new difference after a wrong amount', async () => {
      await addNetOff();
      store.editFigure('file-1', 0, 'wageTax', '790,00');
      const [row] = store.rows();
      expect(row.state).toBe('needs-correction');
      expect(row.draft?.[0].amounts.wageTax).toBe('790.00');
      expect(row.draft?.[0].corrected).toEqual(['wageTax']);
      expect(row.localRejection?.params?.['difference']).toBe('2.40');
      expect(row.inputErrors).toEqual({});
      http.expectNone('/api/earnings/imports/preview');
    });

    it('turns the row into a candidate after a right amount, previews and commits the corrected body', async () => {
      await addNetOff();
      store.editFigure('file-1', 0, 'wageTax', '787,60');
      const [row] = store.rows();
      expect(row.state).toBe('candidate');
      expect(row.failures).toEqual([]);
      expect(row.body?.records[0].corrected).toEqual(['wageTax']);
      expect(row.body?.records[0].amounts.wageTax).toBe('787.60');

      const request = http.expectOne('/api/earnings/imports/preview');
      expect((request.request.body as EarningsImportBatch).files[0].records[0]).toMatchObject({
        corrected: ['wageTax'],
        amounts: { wageTax: '787.60', net: '3128.40' },
      });
      request.flush({ files: [preview('file-1')] });
      await settle();
      expect(store.ready()).toHaveLength(1);
      expect(store.correctedFigures()).toBe(1);

      const committing = store.commit();
      const commit = http.expectOne('/api/earnings/imports');
      expect((commit.request.body as EarningsImportBatch).files[0].records[0].corrected).toEqual([
        'wageTax',
      ]);
      commit.flush({
        files: [{ clientFileId: 'file-1', status: 'SAVED', importId: 'i1', recordCount: 1 }],
      });
      expect(await committing).toBe(true);
    });

    it('keeps the row rejected when a correction breaks another check', async () => {
      await addNetOff();
      store.editFigure('file-1', 0, 'net', '3116.00'); // NET passes, the printed payout no longer fits
      const [row] = store.rows();
      expect(row.state).toBe('needs-correction');
      expect(row.localRejection).toEqual({
        code: 'CHECK_FAILED',
        params: { check: 'PAYOUT', period: '2026-08', difference: '12.40' },
      });
      expect(row.draft?.[0].corrected).toEqual(['net']);
      http.expectNone('/api/earnings/imports/preview');
    });

    it('restores a figure: the failure comes back and the marker is removed', async () => {
      await addNetOff();
      store.editFigure('file-1', 0, 'wageTax', '787.60');
      await answerPreview();
      store.restoreFigure('file-1', 0, 'wageTax');
      const [row] = store.rows();
      expect(row.state).toBe('needs-correction');
      expect(row.preview).toBeNull();
      expect(row.draft?.[0].amounts.wageTax).toBe('800.00');
      expect(row.draft?.[0].corrected).toBeUndefined();
      expect(row.inputs).toEqual({});
      expect(row.localRejection?.params?.['difference']).toBe('12.40');
    });

    it('stays editable after the checks pass', async () => {
      await addNetOff();
      store.editFigure('file-1', 0, 'wageTax', '787.60');
      await answerPreview();
      store.editFigure('file-1', 0, 'wageTax', '787.61');
      expect(store.rows()[0].draft?.[0].amounts.wageTax).toBe('787.61');
      expect(store.rows()[0].state).toBe('candidate'); // within one cent
    });

    it('ignores edits of figures that do not take part in the failing check', async () => {
      await addNetOff();
      store.editFigure('file-1', 0, 'payout', '1,00'); // involved only in PAYOUT, which passes
      expect(store.rows()[0].draft?.[0].amounts.payout).not.toBe('1.00');
      store.editFigure('file-1', 0, 'taxGross' as never, '1,00');
      store.editFigure('file-1', 3, 'net', '1,00');
      store.editFigure('unknown', 0, 'net', '1,00');
      expect(store.rows()[0].draft?.[0].corrected).toBeUndefined();
      expect(store.rows()[0].inputErrors).toEqual({});
    });

    it('discards edits when the same file is added again', async () => {
      await addNetOff();
      store.editFigure('file-1', 0, 'wageTax', '790,00');
      await store.addFiles([pdf(SAP_AUG_2026_NET_OFF.fileName)]);
      const [first, second] = store.rows();
      expect(first.draft?.[0].corrected).toEqual(['wageTax']);
      expect(second.clientFileId).toBe('file-2');
      expect(second.draft?.[0].amounts.wageTax).toBe('800.00');
      expect(second.draft?.[0].corrected).toBeUndefined();
      expect(second.inputs).toEqual({});
    });

    it('never writes figures to the console', async () => {
      const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
        vi.spyOn(console, m).mockImplementation(() => undefined),
      );
      await addNetOff();
      store.editFigure('file-1', 0, 'wageTax', '787,60');
      store.restoreFigure('file-1', 0, 'wageTax');
      for (const spy of spies) {
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
      }
    });
  });
});
