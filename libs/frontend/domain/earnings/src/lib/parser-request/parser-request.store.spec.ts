import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { validateLayoutSubmission, wordKey } from '@vaultfolio/earnings';
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
