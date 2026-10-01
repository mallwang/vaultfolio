import { TestBed } from '@angular/core/testing';
import { I18nService } from '@vaultfolio/frontend-shared-ui';
import { PrivacyNoteComponent } from './privacy-note.component';

describe('PrivacyNoteComponent', () => {
  it('renders the three privacy cards, naming administrators and the operator-held key', () => {
    const fixture = TestBed.createComponent(PrivacyNoteComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;

    expect(fixture.nativeElement.querySelectorAll('.card')).toHaveLength(3);
    expect(text).toContain('Documents stay on your device');
    expect(text).toContain('Only figures, no identifiers');
    expect(text).toContain('administrators included');
    expect(text).toContain('holds the encryption key');
    expect(text).toContain('encrypted');
  });

  it('renders in German', () => {
    TestBed.inject(I18nService).setLanguage('de');
    const fixture = TestBed.createComponent(PrivacyNoteComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Documents stay on your device');
    TestBed.inject(I18nService).setLanguage('en');
  });
});
