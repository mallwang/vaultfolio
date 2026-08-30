import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { ProfileSummary } from '@vaultfolio/api-contract';
import { PreferencesComponent } from './preferences.component';
import { I18nService } from '../../core/i18n/i18n.service';

const baseProfile: ProfileSummary = {
  id: 'user-1',
  email: 'alex@example.com',
  displayName: 'Alex Example',
  role: 'MEMBER',
  pendingEmail: null,
  emailLanguage: null,
};

describe('PreferencesComponent (integration)', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [PreferencesComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('pre-fills the picker with the current display language when no email language is set yet', async () => {
    TestBed.inject(I18nService).setLanguage('de');
    const fixture = TestBed.createComponent(PreferencesComponent);
    fixture.detectChanges();
    httpMock.expectOne('/api/profile').flush(baseProfile);
    await fixture.whenStable();

    expect(fixture.componentInstance['selectedCode']()).toBe('de');
    // The pre-fill is a client-side suggestion only — it must not itself
    // trigger a save (research.md #3).
    httpMock.expectNone('/api/profile/email-language');
  });

  it('shows the fallback note only while unset', async () => {
    const fixture = TestBed.createComponent(PreferencesComponent);
    fixture.detectChanges();
    httpMock.expectOne('/api/profile').flush(baseProfile);
    await fixture.whenStable();

    expect(fixture.componentInstance['isUnset']).toBe(true);
  });

  it('does not show the fallback note once an explicit value is set', async () => {
    const fixture = TestBed.createComponent(PreferencesComponent);
    fixture.detectChanges();
    httpMock.expectOne('/api/profile').flush({ ...baseProfile, emailLanguage: 'de' });
    await fixture.whenStable();

    expect(fixture.componentInstance['isUnset']).toBe(false);
  });

  it('save() calls PATCH /api/profile/email-language with the selected code', async () => {
    const fixture = TestBed.createComponent(PreferencesComponent);
    fixture.detectChanges();
    httpMock.expectOne('/api/profile').flush(baseProfile);
    await fixture.whenStable();

    fixture.componentInstance['selectedCode'].set('de');
    fixture.componentInstance['save']();

    const req = httpMock.expectOne('/api/profile/email-language');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ emailLanguage: 'de' });
    req.flush({ ...baseProfile, emailLanguage: 'de' });
    await fixture.whenStable();

    expect(fixture.componentInstance['isUnset']).toBe(false);
  });

  it('save() sends null when reverted to "Use default"', async () => {
    const fixture = TestBed.createComponent(PreferencesComponent);
    fixture.detectChanges();
    httpMock.expectOne('/api/profile').flush({ ...baseProfile, emailLanguage: 'de' });
    await fixture.whenStable();

    fixture.componentInstance['selectedCode'].set('__use_default__');
    fixture.componentInstance['save']();

    const req = httpMock.expectOne('/api/profile/email-language');
    expect(req.request.body).toEqual({ emailLanguage: null });
    req.flush({ ...baseProfile, emailLanguage: null });
  });

  it('changing the display language afterward leaves the saved email language untouched (FR-009)', async () => {
    const fixture = TestBed.createComponent(PreferencesComponent);
    fixture.detectChanges();
    httpMock.expectOne('/api/profile').flush({ ...baseProfile, emailLanguage: 'en' });
    await fixture.whenStable();

    TestBed.inject(I18nService).setLanguage('de');
    fixture.detectChanges();

    expect(fixture.componentInstance['emailLanguage']()).toBe('en');
    httpMock.expectNone('/api/profile/email-language');
  });
});
