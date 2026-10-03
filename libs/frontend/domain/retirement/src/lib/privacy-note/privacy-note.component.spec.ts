import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { I18nService } from '@vaultfolio/frontend-shared-ui';
import { PrivacyNoteComponent } from './privacy-note.component';

describe('PrivacyNoteComponent (retirement)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => TestBed.inject(I18nService).setLanguage('en'));

  it('covers what is stored, encryption, the operator-held key, on-device reading and the links', () => {
    const fixture = TestBed.createComponent(PrivacyNoteComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const text = el.textContent ?? '';

    expect(el.querySelectorAll('.card')).toHaveLength(5);
    expect(el.querySelector('#retirement-privacy')).not.toBeNull();
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

  describe('delete all my retirement data (FR-015)', () => {
    const byTestId = (root: ParentNode, id: string): HTMLElement | null =>
      root.querySelector(`[data-testid="${id}"]`);

    async function askAndConfirm() {
      const fixture = TestBed.createComponent(PrivacyNoteComponent);
      fixture.detectChanges();
      byTestId(fixture.nativeElement, 'retirement-delete-all')?.click();
      fixture.detectChanges();
      await fixture.whenStable();
      // nothing is sent before the user confirms
      http.expectNone('/api/retirement');
      const accept = byTestId(document, 'retirement-delete-all-accept');
      expect(accept).not.toBeNull();
      accept?.click();
      fixture.detectChanges();
      return fixture;
    }

    it('deletes via DELETE /retirement only after confirmation', async () => {
      const fixture = await askAndConfirm();
      const req = http.expectOne('/api/retirement');
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });
      fixture.detectChanges();
      expect(byTestId(fixture.nativeElement, 'retirement-delete-all-done')).not.toBeNull();
    });

    it('shows an error when deleting fails', async () => {
      const fixture = await askAndConfirm();
      http.expectOne('/api/retirement').flush({}, { status: 500, statusText: 'err' });
      fixture.detectChanges();
      expect(byTestId(fixture.nativeElement, 'retirement-delete-all-failed')).not.toBeNull();
    });
  });
});
