import { TestBed } from '@angular/core/testing';
import { OcrConsentComponent } from './ocr-consent.component';

describe('OcrConsentComponent', () => {
  function create(inputs: Partial<OcrConsentComponent>) {
    const fixture = TestBed.createComponent(OcrConsentComponent);
    Object.assign(fixture.componentInstance, inputs);
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }
  const byTestId = (root: HTMLElement, id: string) =>
    root.querySelector<HTMLElement>(`[data-testid="${id}"]`);

  it('offers consent and reports allow and cancel', () => {
    const { fixture, root } = create({ fileName: 'scan.pdf', pageCount: 3 });
    const events: string[] = [];
    fixture.componentInstance.allow.subscribe(() => events.push('allow'));
    fixture.componentInstance.cancel.subscribe(() => events.push('cancel'));

    expect(byTestId(root, 'ocr-offer')?.getAttribute('aria-label')).toBe('scan.pdf');
    expect(byTestId(root, 'ocr-page-count')?.textContent).toContain('3');
    byTestId(root, 'ocr-accept')?.click();
    byTestId(root, 'ocr-decline')?.click();

    expect(events).toEqual(['allow', 'cancel']);
  });

  it('shows no page line when the page count is unknown', () => {
    const { root } = create({});
    expect(byTestId(root, 'ocr-page-count')).toBeNull();
  });

  it('shows progress with a live region and a cancel button', () => {
    const { fixture, root } = create({
      state: 'progress',
      progressText: 'Reading page 2 of 3',
      progressPercent: 50,
    });
    let cancelled = 0;
    fixture.componentInstance.cancel.subscribe(() => cancelled++);

    const progress = byTestId(root, 'ocr-progress');
    expect(progress?.getAttribute('role')).toBe('status');
    expect(progress?.textContent).toContain('Reading page 2 of 3');
    expect(byTestId(root, 'ocr-offer')).toBeNull();
    byTestId(root, 'ocr-cancel')?.click();
    expect(cancelled).toBe(1);
  });
});
