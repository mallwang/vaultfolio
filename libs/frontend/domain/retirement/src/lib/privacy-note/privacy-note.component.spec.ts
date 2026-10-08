import { TestBed } from '@angular/core/testing';
import { I18nService } from '@vaultfolio/frontend-shared-ui';
import { PrivacyNoteComponent } from './privacy-note.component';

describe('PrivacyNoteComponent (retirement)', () => {
  afterEach(() => TestBed.inject(I18nService).setLanguage('en'));

  it('covers on-device reading, encrypted figures, the operator-held key, the parser request and the links', () => {
    const fixture = TestBed.createComponent(PrivacyNoteComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const text = el.textContent ?? '';

    expect(el.querySelectorAll('.card')).toHaveLength(5);
    expect(text).toContain('only the figures you confirm are sent');
    expect(text).toContain('stored encrypted');
    expect(text).toContain('holds the encryption key');
    expect(text).toContain('request a parser');
    expect(text).toContain('sends nothing from Vaultfolio');
  });

  it('renders in German', () => {
    TestBed.inject(I18nService).setLanguage('de');
    const fixture = TestBed.createComponent(PrivacyNoteComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Nur du siehst sie');
    expect(text).not.toContain('Only you can see it');
  });
});
