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

  it('states that text recognition of scans runs on the device, after consent, without upload or caching (034 FR-004)', () => {
    const fixture = TestBed.createComponent(PrivacyNoteComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('text recognition on your device only if you agree');
    expect(text).toContain('never uploaded, stored or cached');
  });

  it('states it in German as well', () => {
    TestBed.inject(I18nService).setLanguage('de');
    const fixture = TestBed.createComponent(PrivacyNoteComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Texterkennung auf Ihrem Gerät');
    TestBed.inject(I18nService).setLanguage('en');
  });

  it('renders in German', () => {
    TestBed.inject(I18nService).setLanguage('de');
    const fixture = TestBed.createComponent(PrivacyNoteComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Documents stay on your device');
    TestBed.inject(I18nService).setLanguage('en');
  });
});
