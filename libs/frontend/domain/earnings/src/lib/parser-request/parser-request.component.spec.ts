import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ParserRequestComponent } from './parser-request.component';
import { ParserRequestStore } from './parser-request.store';
import { PLANTED, plantedLayout } from './parser-request.testing';

describe('ParserRequestComponent', () => {
  let store: ParserRequestStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
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

  it('disables Continue on the review step until every word is decided', () => {
    const fixture = open();
    store.consent.set(true);
    store.step.set('review');
    fixture.detectChanges();
    expect(el(fixture, 'request-removed-callout')?.textContent).toContain('bank account');
    expect(el(fixture, 'request-progress')?.textContent).toContain('0 of 3 decided');
    expect(button(fixture, 'request-continue').disabled).toBe(true);

    button(fixture, 'request-decision-0-0-0-keep').click();
    button(fixture, 'request-decision-0-0-1-mask').click();
    fixture.detectChanges();
    expect(el(fixture, 'request-progress')?.textContent).toContain('2 of 3 decided');
    expect(button(fixture, 'request-continue').disabled).toBe(true);

    button(fixture, 'request-decision-0-1-0-mask').click();
    fixture.detectChanges();
    expect(button(fixture, 'request-continue').disabled).toBe(false);
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

  it('keeps Send disabled until all words are decided, then sends once and shows the confirmation', async () => {
    const fixture = open();
    store.consent.set(true);
    store.step.set('preview');
    fixture.detectChanges();
    expect(button(fixture, 'request-send').disabled).toBe(true);
    expect(el(fixture, 'request-blocked')).not.toBeNull();

    for (const w of store.decisionWords()) store.decide(w.key, 'MASK');
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
    ['IMAGE_ONLY', 'no text layer'],
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
});
