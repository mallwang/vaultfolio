import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ParserRequestComponent } from './parser-request.component';
import { FakeTextRecogniser } from '../pdf/text-recogniser.testing';
import { TEXT_RECOGNISER } from '../pdf/text-recogniser.token';
import { ParserRequestStore } from './parser-request.store';
import { PLANTED, plantedLayout } from './parser-request.testing';

describe('ParserRequestComponent', () => {
  let store: ParserRequestStore;
  let http: HttpTestingController;
  let recogniser: FakeTextRecogniser;

  beforeEach(() => {
    recogniser = new FakeTextRecogniser();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TEXT_RECOGNISER, useValue: recogniser },
      ],
    });
    store = TestBed.inject(ParserRequestStore);
    http = TestBed.inject(HttpTestingController);
  });

  function open(withLayout = true) {
    store.file.set(new File(['x'], 'unknown.pdf'));
    if (withLayout) store.analysis.set(plantedLayout());
    const fixture = TestBed.createComponent(ParserRequestComponent);
    fixture.detectChanges();
    return fixture;
  }
  const el = (f: { nativeElement: HTMLElement }, id: string) =>
    f.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
  const button = (f: { nativeElement: HTMLElement }, id: string) => el(f, id) as HTMLButtonElement;

  it('shows the stepper with four steps and starts at the consent', () => {
    const fixture = open();
    const labels = [1, 2, 3, 4].map((n) => el(fixture, `request-step-${n}`)?.textContent ?? '');
    ['Consent', 'Review words', 'Mark rules', 'Preview & send'].forEach((text, i) =>
      expect(labels[i]).toContain(text),
    );
    expect(el(fixture, 'request-consent')).not.toBeNull();
  });

  it('lists the document checks including the removed personal data kinds', () => {
    const fixture = open();
    expect(el(fixture, 'request-check-personal')?.textContent).toContain('bank account');
    expect(el(fixture, 'request-check-personal')?.textContent).toContain('postcode and city');
  });

  it('disables Continue until the consent is given', () => {
    const fixture = open();
    expect(button(fixture, 'request-continue').disabled).toBe(true);
    store.consent.set(true);
    fixture.detectChanges();
    expect(button(fixture, 'request-continue').disabled).toBe(false);
  });

  it('masks unknown words by default and groups repeated ones; Continue stays enabled', () => {
    const fixture = open();
    store.consent.set(true);
    store.step.set('review');
    fixture.detectChanges();
    expect(el(fixture, 'request-removed-callout')?.textContent).toContain('bank account');
    expect(el(fixture, 'request-progress')?.textContent).toContain('0 of 3 words kept');
    expect(button(fixture, 'request-continue').disabled).toBe(false);

    button(fixture, 'request-decision-0-0-0-keep').click();
    fixture.detectChanges();
    expect(el(fixture, 'request-progress')?.textContent).toContain('1 of 3 words kept');

    button(fixture, 'request-keep-all').click();
    fixture.detectChanges();
    expect(el(fixture, 'request-progress')?.textContent).toContain('3 of 3 words kept');
    button(fixture, 'request-mask-all').click();
    fixture.detectChanges();
    expect(el(fixture, 'request-progress')?.textContent).toContain('0 of 3 words kept');
    expect(el(fixture, 'request-removed-row')?.textContent).toContain('3');
  });

  it('cycles a decision when a word on the sheet is clicked', () => {
    const fixture = open();
    store.step.set('review');
    fixture.detectChanges();
    el(fixture, 'request-word-0-0-0')?.click();
    fixture.detectChanges();
    expect(button(fixture, 'request-decision-0-0-0-keep').getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('lets step 3 be skipped', () => {
    const fixture = open();
    store.step.set('rules');
    fixture.detectChanges();
    button(fixture, 'request-skip-rules').click();
    fixture.detectChanges();
    expect(store.step()).toBe('preview');
  });

  it('keeps Send disabled until consent is given, then sends once and shows the confirmation', async () => {
    const fixture = open();
    store.step.set('preview');
    fixture.detectChanges();
    expect(button(fixture, 'request-send').disabled).toBe(true);
    expect(el(fixture, 'request-blocked')).not.toBeNull();

    store.consent.set(true);
    fixture.detectChanges();
    expect(button(fixture, 'request-send').disabled).toBe(false);

    button(fixture, 'request-send').click();
    const req = http.expectOne('/api/requests');
    for (const planted of PLANTED) expect(JSON.stringify(req.request.body)).not.toContain(planted);
    req.flush({ id: 'abc', submittedAt: '2026-10-01T10:00:00.000Z', possibleDuplicate: false });
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
    expect(el(fixture, 'request-sent')?.textContent).toContain('Request sent');
    expect(el(fixture, 'request-stepper')).toBeNull();
    http.verify();
  });

  it('shows the translated error of a failed send and stays on the preview', async () => {
    const fixture = open();
    store.consent.set(true);
    store.step.set('preview');
    for (const w of store.decisionWords()) store.decide(w.key, 'MASK');
    fixture.detectChanges();
    button(fixture, 'request-send').click();
    http
      .expectOne('/api/requests')
      .flush({ error: 'REQUEST_LIMIT_DAILY', message: 'x' }, { status: 429, statusText: 'x' });
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
    expect(el(fixture, 'request-error')?.textContent).toContain('maximum number of requests');
    expect(button(fixture, 'request-send')).not.toBeNull();
  });

  it.each([
    ['IMAGE_ONLY', 'no text that can be read automatically'],
    ['PASSWORD_PROTECTED', 'password-protected'],
    ['UNREADABLE', 'could not be read'],
    ['TOO_MANY_PAGES', 'more than 3 pages'],
  ] as const)('shows the specific refusal for %s', (code, text) => {
    store.file.set(new File(['x'], 'bad.pdf'));
    store.refusal.set(code);
    const fixture = TestBed.createComponent(ParserRequestComponent);
    fixture.detectChanges();
    expect(el(fixture, 'request-refused')?.textContent).toContain(text);
    expect(el(fixture, 'request-choose-another')).not.toBeNull();
    expect(el(fixture, 'request-consent')).toBeNull();
  });

  it('shows a loading state while the file is read', () => {
    const fixture = open(false);
    expect(el(fixture, 'request-loading')).not.toBeNull();
  });

  it('clears the in-memory state when the wizard is destroyed', () => {
    const fixture = open();
    store.consent.set(true);
    fixture.destroy();
    expect(store.file()).toBeNull();
    expect(store.analysis()).toBeNull();
    expect(store.consent()).toBe(false);
  });

  describe('text recognition (034)', () => {
    function openScan(state: 'offer' | 'running' = 'offer') {
      store.file.set(new File(['x'], 'scan.pdf'));
      store.recognitionState.set(state);
      const fixture = TestBed.createComponent(ParserRequestComponent);
      fixture.detectChanges();
      return fixture;
    }

    it('shows the consent offer for a scan instead of the stepper, and starts nothing', () => {
      const fixture = openScan();
      expect(el(fixture, 'ocr-offer')?.textContent).toContain('stay in your browser');
      expect(el(fixture, 'request-stepper')).toBeNull();
      expect(recogniser.calls).toHaveLength(0);
    });

    it('shows progress with a cancel button while recognising', () => {
      store.recognitionProgress.set({ phase: 'RECOGNISING', page: 1, pageCount: 2, fraction: 0.5 });
      const fixture = openScan('running');
      expect(el(fixture, 'ocr-progress')?.getAttribute('role')).toBe('status');
      expect(el(fixture, 'ocr-progress')?.textContent).toContain('Reading page 1 of 2');
      expect(el(fixture, 'ocr-cancel')).not.toBeNull();
    });

    it('declining ends in the refusal with a link to read the text instead', () => {
      const fixture = openScan();
      button(fixture, 'ocr-decline').click();
      fixture.detectChanges();
      expect(el(fixture, 'request-refused')?.textContent).toContain('contains no text');
      expect(el(fixture, 'ocr-instead')).not.toBeNull();
      button(fixture, 'ocr-instead').click();
      fixture.detectChanges();
      expect(el(fixture, 'ocr-offer')).not.toBeNull();
    });

    it('names the page limit and drops the retry link when the document is too long', () => {
      store.file.set(new File(['x'], 'scan.pdf'));
      store.recognitionHint.set('TOO_MANY_PAGES');
      store.refusal.set('IMAGE_ONLY');
      const fixture = TestBed.createComponent(ParserRequestComponent);
      fixture.detectChanges();
      expect(el(fixture, 'ocr-hint')?.textContent).toContain('limited to 5 pages');
      expect(el(fixture, 'ocr-instead')).toBeNull();
    });

    it('shows the recognised-automatically notice and the look-alike statement in step 4, and not for text PDFs', () => {
      store.recognised.set(true);
      const fixture = open();
      store.step.set('preview');
      fixture.detectChanges();
      expect(el(fixture, 'request-ocr-notice')?.textContent).toContain(
        'recognised automatically and may contain errors',
      );
      expect(el(fixture, 'request-ocr-removed')?.textContent).toContain(
        'even if a digit was misread',
      );
      expect(el(fixture, 'request-ocr-legend')).not.toBeNull();
    });

    it('does not show the notice for a text PDF', () => {
      const fixture = open();
      store.step.set('preview');
      fixture.detectChanges();
      expect(el(fixture, 'request-ocr-notice')).toBeNull();
    });
  });
});
