import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { textDocument, validateLayoutSubmission, wordKey } from '@vaultfolio/earnings';
import { asFile, imageOnlyPdf } from '../../testing/synthetic-pdfs';
import { type PdfJsModule, setPdfJsLoader } from '../pdf/pdf-text-extractor';
import { FakeTextRecogniser } from '../pdf/text-recogniser.testing';
import { TEXT_RECOGNISER } from '../pdf/text-recogniser.token';
import { ParserRequestStore } from './parser-request.store';
import { PLANTED, plantedLayout } from './parser-request.testing';

describe('ParserRequestStore', () => {
  let store: ParserRequestStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(ParserRequestStore);
    http = TestBed.inject(HttpTestingController);
    store.file.set(new File(['x'], 'a.pdf'));
    store.analysis.set(plantedLayout());
  });

  afterEach(() => http.verify());

  it('counts the words that need a decision and the removed personal data', () => {
    // Erika, Musterfrau, Hafenweg, (20457 Musterstadt, IBAN removed), IBAN: is a label
    expect(store.pendingDecisions()).toBe(3);
    expect(store.removedKinds()).toEqual(['BANK_ACCOUNT', 'POSTCODE_CITY']);
    expect(store.removedCount()).toBe(3);
    expect(store.decisionWords().map((w) => w.original)).toEqual([
      'Erika',
      'Musterfrau',
      'Hafenweg',
    ]);
  });

  it('keeps replacement values stable while decisions change', () => {
    const before = store.preview()?.pages[0].lines[4].words[1].text;
    store.decide(wordKey(0, 0, 0), 'KEEP');
    expect(store.preview()?.pages[0].lines[4].words[1].text).toBe(before);
    expect(store.pendingDecisions()).toBe(2);
  });

  it('cycles a word keep → mask → keep and ignores locked words', () => {
    store.cycle(0, 0, 0);
    expect(store.decisions().get(wordKey(0, 0, 0))).toBe('KEEP');
    store.cycle(0, 0, 0);
    expect(store.decisions().get(wordKey(0, 0, 0))).toBe('MASK');
    store.cycle(0, 0, 0);
    expect(store.decisions().get(wordKey(0, 0, 0))).toBe('KEEP');
    store.cycle(0, 3, 1); // removed IBAN
    expect(store.decisions().has(wordKey(0, 3, 1))).toBe(false);
  });

  it('only allows sending with consent, every word decided and a clean final scan', () => {
    expect(store.canSend()).toBe(false);
    store.consent.set(true);
    expect(store.canSend()).toBe(false); // undecided words
    for (const w of store.decisionWords()) store.decide(w.key, 'MASK');
    expect(store.remainingHits()).toBe(0);
    expect(store.canSend()).toBe(true);
    store.consent.set(false);
    expect(store.canSend()).toBe(false);
  });

  it('sends exactly one POST /requests whose body holds none of the planted original values', async () => {
    store.consent.set(true);
    for (const w of store.decisionWords()) store.decide(w.key, 'MASK');
    const sending = store.submit();
    const req = http.expectOne('/api/requests');
    expect(req.request.method).toBe('POST');
    const body = JSON.stringify(req.request.body);
    for (const planted of PLANTED) expect(body).not.toContain(planted);
    expect(req.request.body).toMatchObject({ feature: 'earnings', type: 'new-parser' });
    expect(validateLayoutSubmission(req.request.body.payload).ok).toBe(true);
    req.flush({ id: 'abc', submittedAt: '2026-10-01T10:00:00.000Z', possibleDuplicate: true });
    await sending;
    expect(store.step()).toBe('sent');
    expect(store.sent()?.possibleDuplicate).toBe(true);
  });

  it('does not send while blocked', async () => {
    await store.submit();
    http.expectNone('/api/requests');
    expect(store.sent()).toBeNull();
  });

  it('keeps the wizard on the preview and exposes the error code when sending fails', async () => {
    store.consent.set(true);
    for (const w of store.decisionWords()) store.decide(w.key, 'MASK');
    store.step.set('preview');
    const sending = store.submit();
    http
      .expectOne('/api/requests')
      .flush(
        { error: 'REQUEST_LIMIT_OPEN', message: 'x' },
        { status: 429, statusText: 'Too Many' },
      );
    await sending;
    expect(store.errorCode()).toBe('REQUEST_LIMIT_OPEN');
    expect(store.step()).toBe('preview');
    expect(store.sending()).toBe(false);
  });

  it('reset() clears every piece of state', () => {
    store.consent.set(true);
    store.decide(wordKey(0, 0, 0), 'KEEP');
    store.step.set('preview');
    store.reset();
    expect(store.file()).toBeNull();
    expect(store.analysis()).toBeNull();
    expect(store.decisions().size).toBe(0);
    expect(store.consent()).toBe(false);
    expect(store.step()).toBe('consent');
    expect(store.preview()).toBeNull();
    expect(store.sent()).toBeNull();
  });
});

describe('ParserRequestStore — text recognition (034)', () => {
  let store: ParserRequestStore;
  let recogniser: FakeTextRecogniser;
  const scan = () => asFile(new Uint8Array([1]), 'scan.pdf');

  beforeAll(() => {
    setPdfJsLoader(async () => {
      // @ts-expect-error -- the worker entry ships without type declarations.
      const worker: unknown = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
      (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;
      return (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfJsModule;
    });
  });

  beforeEach(async () => {
    recogniser = new FakeTextRecogniser();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TEXT_RECOGNISER, useValue: recogniser },
      ],
    });
    store = TestBed.inject(ParserRequestStore);
  });

  async function openScan(): Promise<File> {
    const file = asFile(await imageOnlyPdf(), 'scan.pdf');
    await store.open(file);
    return file;
  }

  const RECOGNISED = [['Brutto 4.521,88', 'Lohnsteuer 612,03'], ['IBAN: DE0O37601008500040094']];

  it('offers recognition for a scan without starting it', async () => {
    await openScan();
    expect(store.recognitionState()).toBe('offer');
    expect(store.refusal()).toBeNull();
    expect(store.loading()).toBe(false);
    expect(recogniser.calls).toHaveLength(0);
  });

  it('after consent analyses the recognised text, marks it, and scans it leniently so a misread IBAN is removed', async () => {
    recogniser.script = { text: RECOGNISED };
    await openScan();
    await store.acceptRecognition();
    expect(store.recognitionState()).toBe('none');
    expect(store.recognised()).toBe(true);
    expect(store.analysis()).not.toBeNull();
    expect(store.removedKinds()).toContain('BANK_ACCOUNT');
    expect(JSON.stringify(store.preview())).not.toContain('DE0O37601008500040094');
    expect(store.remainingHits()).toBe(0);
  });

  it('does not use the lenient scan for text from the PDF text layer', () => {
    store.file.set(new File(['x'], 'a.pdf'));
    store.analysis.set({
      pages: [
        {
          width: 595,
          height: 842,
          lines: [
            {
              y: 50,
              words: [
                { text: 'DE0O37601008500040094', x: 10, width: 100, height: 9, covered: false },
              ],
            },
          ],
        },
      ],
    });
    expect(store.recognised()).toBe(false);
    expect(store.removedKinds()).toEqual([]);
  });

  it('blocks sending until consent, decisions and a clean rescan, as for text PDFs', async () => {
    recogniser.script = { text: RECOGNISED };
    await openScan();
    await store.acceptRecognition();
    expect(store.canSend()).toBe(false);
    store.consent.set(true);
    for (const w of store.decisionWords()) store.decide(w.key, 'MASK');
    expect(store.remainingHits()).toBe(0);
    expect(store.canSend()).toBe(true);
  });

  it('ends a declined offer in the image-only refusal and offers again on request', async () => {
    await openScan();
    store.declineRecognition();
    expect(store.refusal()).toBe('IMAGE_ONLY');
    expect(store.recognitionState()).toBe('none');
    expect(recogniser.calls).toHaveLength(0);
    store.reofferRecognition();
    expect(store.refusal()).toBeNull();
    expect(store.recognitionState()).toBe('offer');
  });

  it.each([
    ['NO_TEXT', null],
    ['TOO_MANY_PAGES', 'TOO_MANY_PAGES'],
    ['ENGINE_UNAVAILABLE', 'ENGINE_UNAVAILABLE'],
  ] as const)('maps %s to the image-only refusal with the right hint', async (error, hint) => {
    recogniser.script = { error };
    await openScan();
    await store.acceptRecognition();
    expect(store.refusal()).toBe('IMAGE_ONLY');
    expect(store.recognitionHint()).toBe(hint);
    expect(store.analysis()).toBeNull();
  });

  it('cancelling stops recognition and ends in the refusal, keeping nothing', async () => {
    recogniser.script = { text: RECOGNISED, delayMs: 1000 };
    await openScan();
    const running = store.acceptRecognition();
    expect(store.recognitionState()).toBe('running');
    store.cancelRecognition();
    await running;
    expect(store.refusal()).toBe('IMAGE_ONLY');
    expect(store.analysis()).toBeNull();
    expect(store.recognised()).toBe(false);
  });

  it('stops a running recognition when the request is reset', async () => {
    recogniser.script = { text: RECOGNISED, delayMs: 1000 };
    await openScan();
    const running = store.acceptRecognition();
    store.reset();
    await running;
    expect(recogniser.lastSignal?.aborted).toBe(true);
    expect(store.analysis()).toBeNull();
    expect(store.refusal()).toBeNull();
  });

  it('takes text already recognised in the import without a second consent or recognition', async () => {
    const text = { ...textDocument(RECOGNISED), origin: 'RECOGNISED' as const };
    await store.open(scan(), text);
    expect(store.recognitionState()).toBe('none');
    expect(store.recognised()).toBe(true);
    expect(store.analysis()).not.toBeNull();
    expect(recogniser.calls).toHaveLength(0);
  });
});
