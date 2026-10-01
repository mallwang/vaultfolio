import { TestBed } from '@angular/core/testing';
import { I18nService } from '@vaultfolio/frontend-shared-ui';
import { PrivacyNoteComponent } from './privacy-note.component';

describe('PrivacyNoteComponent', () => {
  it('renders the four privacy cards, naming administrators, the operator-held key and the optional parser request', () => {
    const fixture = TestBed.createComponent(PrivacyNoteComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;

    expect(fixture.nativeElement.querySelectorAll('.card')).toHaveLength(4);
    expect(text).toContain('Documents stay on your device');
    expect(text).toContain('Only figures, no identifiers');
    expect(text).toContain('administrators included');
    expect(text).toContain('holds the encryption key');
    expect(text).toContain('encrypted');
    expect(text).toContain('request a parser');
    expect(text).toContain('anonymized, rebuilt copy');
    expect(text).toContain('30 days after the request is closed');
    expect(text).toContain('never leave your device');
  });

  it('renders in German', () => {
    TestBed.inject(I18nService).setLanguage('de');
    const fixture = TestBed.createComponent(PrivacyNoteComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Documents stay on your device');
    TestBed.inject(I18nService).setLanguage('en');
  });
});
