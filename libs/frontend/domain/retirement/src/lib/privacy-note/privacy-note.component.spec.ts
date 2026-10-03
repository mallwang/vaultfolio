import { TestBed } from '@angular/core/testing';
import { I18nService } from '@vaultfolio/frontend-shared-ui';
import { PrivacyNoteComponent } from './privacy-note.component';

describe('PrivacyNoteComponent (retirement)', () => {
  afterEach(() => TestBed.inject(I18nService).setLanguage('en'));

  it('covers what is stored, encryption, the operator-held key, on-device reading and the links', () => {
    const fixture = TestBed.createComponent(PrivacyNoteComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const text = el.textContent ?? '';

    expect(el.querySelectorAll('.card')).toHaveLength(5);
    expect(text).toContain('Only the figures and numbers you confirm');
    expect(text).toContain('stored encrypted');
    expect(text).toContain('holds the encryption key');
    expect(text).toContain('never leave your device');
    expect(text).toContain('sends nothing from Vaultfolio');
  });

  it('renders in German', () => {
    TestBed.inject(I18nService).setLanguage('de');
    const fixture = TestBed.createComponent(PrivacyNoteComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Der Betreiber hält den Schlüssel');
    expect(text).not.toContain('The operator holds the key');
  });
});
