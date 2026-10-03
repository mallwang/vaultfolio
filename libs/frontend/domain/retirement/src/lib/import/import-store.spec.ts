import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { type PdfDocumentText, textDocument } from '@vaultfolio/document-text';
import {
  FakeTextRecogniser,
  type PdfExtractResult,
  TEXT_RECOGNISER,
} from '@vaultfolio/frontend-document-reader';
import type { RetirementRecord } from '@vaultfolio/api-contract';
import {
  syntheticCapitalAccountStatement,
  syntheticDrvRenteninformation,
  syntheticPrivateStatement,
  syntheticUnrelatedDocument,
} from '@vaultfolio/retirement/testing';
import { buildRecord } from '@vaultfolio/retirement/testing';
import { ImportStore, RETIREMENT_FILE_READER } from './import-store';

function pdf(name = 'statement.pdf'): File {
  return new File(['%PDF'], name, { type: 'application/pdf' });
}

describe('ImportStore', () => {
  let store: ImportStore;
  let http: HttpTestingController;
  let recogniser: FakeTextRecogniser;
  /** What the fake PDF reader answers for the next file. */
  let extract: () => Promise<PdfExtractResult>;

  beforeEach(() => {
    recogniser = new FakeTextRecogniser();
    extract = () => Promise.resolve({ text: syntheticPrivateStatement() });
    TestBed.configureTestingModule({
      providers: [
        ImportStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TEXT_RECOGNISER, useValue: recogniser },
        { provide: RETIREMENT_FILE_READER, useValue: { extractPdfText: () => extract() } },
      ],
    });
    store = TestBed.inject(ImportStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Answers the lookup of existing records of `pillar` that follows a successful parse. */
  async function answerRecords(pillar: string, records: RetirementRecord[] = []): Promise<void> {
    const request = await vi.waitFor(() =>
      http.expectOne(`/api/retirement/records?pillar=${pillar}`),
    );
    request.flush(records);
  }

  async function pickText(
    text: PdfDocumentText,
    pillar: string,
    existing: RetirementRecord[] = [],
  ) {
    extract = () => Promise.resolve({ text });
    const picked = store.pick(pdf());
    await answerRecords(pillar, existing);
    await picked;
  }

  it('reads a text PDF into a review with the parsed figures and the 3 % default scenario', async () => {
    await pickText(syntheticPrivateStatement(), 'PRIVATE');
    expect(store.step()).toBe('review');
    expect(store.parser()).toEqual({ id: 'private-statement', version: '1.0.0' });
    expect(store.record()?.contractType).toBe('RIESTER');
    expect(store.expectedScenario()).toBe('3');
    expect(store.hasScenarios()).toBe(true);
    expect(store.ocrRead()).toBe(false);
    expect(recogniser.calls).toHaveLength(0);
  });

  it('sends only whitelisted fields plus parser info on confirm, never the file or its text', async () => {
    await pickText(syntheticPrivateStatement(), 'PRIVATE');
    store.setInput('contributionMonthly', '60,50');
    store.setInput('subsidiesYearly', '175');
    store.expectedScenario.set('6');
    expect(store.canConfirm()).toBe(true);

    const confirmed = store.confirm();
    const request = http.expectOne('/api/retirement/records');
    expect(request.request.method).toBe('POST');
    const body = request.request.body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
      'contractType',
      'figures',
      'identifier',
      'import',
      'origin',
      'payoutStart',
      'providerLabel',
      'statementDate',
      'status',
      'supplement',
    ]);
    expect(body['import']).toEqual({
      parserId: 'private-statement',
      parserVersion: '1.0.0',
      ocrRead: false,
    });
    expect(body['supplement']).toEqual({
      contributionMonthly: '60.50',
      subsidiesYearly: '175.00',
      expectedScenario: '6',
    });
    expect(JSON.stringify(body)).not.toMatch(/Musterfrau|Musterweg|DE02|statement\.pdf/);
    request.flush(buildRecord({ contractType: 'RIESTER' }));
    expect(await confirmed).toBe(true);
    expect(store.step()).toBe('saved');
    expect(store.savedPillar()).toBe('PRIVATE');
  });

  it('offers recognition for a scan and does nothing before the user agrees', async () => {
    extract = () => Promise.resolve({ error: 'IMAGE_ONLY' as const });
    await store.pick(pdf('scan.pdf'));
    expect(store.step()).toBe('awaiting-recognition');
    expect(recogniser.calls).toHaveLength(0);
  });

  it('recognises an agreed scan on the device and marks the result as double-check', async () => {
    extract = () => Promise.resolve({ error: 'IMAGE_ONLY' as const });
    recogniser.script = { text: syntheticDrvRenteninformation('scanned') };
    await store.pick(pdf('scan.pdf'));
    const accepted = store.acceptRecognition();
    await answerRecords('STATUTORY');
    await accepted;
    expect(recogniser.calls).toHaveLength(1);
    expect(store.step()).toBe('review');
    expect(store.ocrRead()).toBe(true);
    expect(store.record()?.contractType).toBe('STATUTORY_PENSION');
    expect(store.buildBody()?.import?.ocrRead).toBe(true);
  });

  it('ends a declined scan in the no-readable-text rejection', async () => {
    extract = () => Promise.resolve({ error: 'IMAGE_ONLY' as const });
    await store.pick(pdf('scan.pdf'));
    store.declineRecognition();
    expect(store.step()).toBe('rejected');
    expect(store.rejection()).toBe('IMAGE_ONLY');
  });

  it('cancelling a running recognition ends in the same rejection', async () => {
    extract = () => Promise.resolve({ error: 'IMAGE_ONLY' as const });
    recogniser.script = { text: [[]], delayMs: 5_000 };
    await store.pick(pdf('scan.pdf'));
    const accepted = store.acceptRecognition();
    expect(store.step()).toBe('recognising');
    store.cancelRecognition();
    await accepted;
    expect(store.step()).toBe('rejected');
    expect(store.rejection()).toBe('IMAGE_ONLY');
  });

  it('reports the recognition limits as their own rejections', async () => {
    extract = () => Promise.resolve({ error: 'IMAGE_ONLY' as const });
    recogniser.script = { error: 'TOO_MANY_PAGES' };
    await store.pick(pdf('scan.pdf'));
    await store.acceptRecognition();
    expect(store.rejection()).toBe('TOO_MANY_PAGES');

    recogniser.script = { error: 'ENGINE_UNAVAILABLE' };
    await store.pick(pdf('scan.pdf'));
    await store.acceptRecognition();
    expect(store.rejection()).toBe('ENGINE_UNAVAILABLE');
  });

  it('rejects an unrecognised document as a whole and saves nothing', async () => {
    extract = () => Promise.resolve({ text: syntheticUnrelatedDocument() });
    await store.pick(pdf());
    expect(store.step()).toBe('rejected');
    expect(store.rejection()).toBe('UNRECOGNISED');
    expect(store.record()).toBeNull();
    expect(store.canConfirm()).toBe(false);
  });

  it('rejects inconsistent figures and names the failed checks', async () => {
    extract = () => Promise.resolve({ text: syntheticCapitalAccountStatement('misread') });
    await store.pick(pdf());
    expect(store.rejection()).toBe('INCONSISTENT');
    expect(store.failedChecks()).toEqual(['ACCOUNT_ROLL_FORWARD']);
  });

  it('rejects an incomplete document', async () => {
    extract = () => Promise.resolve({ text: syntheticPrivateStatement('missing-label') });
    await store.pick(pdf());
    expect(store.rejection()).toBe('INCOMPLETE');
  });

  it('rejects other file types and unreadable or protected PDFs without reading them', async () => {
    await store.pick(new File(['x'], 'notes.txt', { type: 'text/plain' }));
    expect(store.rejection()).toBe('UNSUPPORTED_FORMAT');
    extract = () => Promise.resolve({ error: 'PASSWORD_PROTECTED' as const });
    await store.pick(pdf());
    expect(store.rejection()).toBe('PASSWORD_PROTECTED');
    extract = () => Promise.reject(new Error('boom'));
    await store.pick(pdf());
    expect(store.rejection()).toBe('UNREADABLE');
  });

  it('blocks confirming on a malformed amount until it is fixed', async () => {
    await pickText(syntheticPrivateStatement(), 'PRIVATE');
    store.setInput('contributionMonthly', 'abc');
    expect(store.invalidInputs()).toEqual(['contributionMonthly']);
    expect(store.canConfirm()).toBe(false);
    store.setInput('contributionMonthly', '60');
    expect(store.canConfirm()).toBe(true);
  });

  it('asks for a provider label the statement does not print', async () => {
    const lines = syntheticPrivateStatement().pages[0].lines.map((l) => l.text);
    await pickText(textDocument([lines.filter((l) => !l.startsWith('Versicherer'))]), 'PRIVATE');
    expect(store.record()?.providerLabel).toBeUndefined();
    expect(store.canConfirm()).toBe(false);
    expect(store.issues().map((i) => i.field)).toContain('providerLabel');
    store.setInput('providerLabel', 'Muster AG');
    expect(store.canConfirm()).toBe(true);
    expect(store.buildBody()?.providerLabel).toBe('Muster AG');
  });

  it('replaces an existing statutory record after confirmation', async () => {
    extract = () => Promise.resolve({ text: syntheticDrvRenteninformation() });
    const manual = buildRecord({ id: 'manual-1', contractType: 'STATUTORY_PENSION' });
    await pickText(syntheticDrvRenteninformation(), 'STATUTORY', [manual]);
    expect(store.replaceTarget()).toEqual({ id: 'manual-1', origin: 'MANUAL' });
    expect(store.buildBody()?.replaces).toBe('manual-1');
  });

  it('replaces the record a card named, when it has the same type', async () => {
    store.requestReplace('old-riester');
    const old = buildRecord({ id: 'old-riester', contractType: 'RIESTER', origin: 'IMPORTED' });
    await pickText(syntheticPrivateStatement(), 'PRIVATE', [old]);
    expect(store.replaceTarget()).toEqual({ id: 'old-riester', origin: 'IMPORTED' });
    store.requestReplace('does-not-match');
    await pickText(syntheticPrivateStatement(), 'PRIVATE', [old]);
    expect(store.replaceTarget()).toBeNull();
  });

  it('keeps the review and reports the code when the server refuses', async () => {
    await pickText(syntheticPrivateStatement(), 'PRIVATE');
    const confirmed = store.confirm();
    http
      .expectOne('/api/retirement/records')
      .flush({ error: 'RETIREMENT_STATUTORY_EXISTS' }, { status: 409, statusText: 'Conflict' });
    expect(await confirmed).toBe(false);
    expect(store.step()).toBe('review');
    expect(store.errorCode()).toBe('RETIREMENT_STATUTORY_EXISTS');
  });

  it('forgets everything on reset', async () => {
    await pickText(syntheticPrivateStatement(), 'PRIVATE');
    store.setInput('contributionMonthly', '60');
    store.reset();
    expect(store.step()).toBe('idle');
    expect(store.record()).toBeNull();
    expect(store.inputs()).toEqual({});
    expect(store.fileName()).toBe('');
  });
});
