import { TestBed } from '@angular/core/testing';
import { PrivacyInfoComponent } from './privacy-info.component';

describe('PrivacyInfoComponent', () => {
  afterEach(() => {
    document.querySelectorAll('.p-dialog-mask').forEach((el) => el.remove());
  });

  it('shows a compact teaser and opens the full privacy note as a modal', async () => {
    const fixture = TestBed.createComponent(PrivacyInfoComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="earnings-privacy-info"]')).not.toBeNull();
    expect(document.body.textContent).not.toContain('Documents stay on your device');

    (root.querySelector('[data-testid="earnings-privacy-open"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(document.body.textContent).toContain('Your earnings data');
    expect(document.body.textContent).toContain('Documents stay on your device');
    expect(document.body.textContent).toContain('administrators included');
  });
});
