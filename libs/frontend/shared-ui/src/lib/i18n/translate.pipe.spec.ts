import { TestBed } from '@angular/core/testing';
import { I18nService } from './i18n.service';
import { TranslatePipe } from './translate.pipe';
import { de } from './translations/de';
import type { TranslationDictionary } from './translations/en';

describe('TranslatePipe', () => {
  let pipe: TranslatePipe;
  let i18n: I18nService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [I18nService] });
    i18n = TestBed.inject(I18nService);
    pipe = TestBed.runInInjectionContext(() => new TranslatePipe());
  });

  it('looks up a dotted key path in the active (default, "en") dictionary', () => {
    expect(pipe.transform('header.signOut')).toBe('Sign out');
  });

  it('looks up the German translation once the active language is switched', () => {
    i18n.setLanguage('de');
    expect(pipe.transform('header.signOut')).toBe('Abmelden');
  });

  it('falls back to the "en" dictionary when the key is missing from the active language', () => {
    // Temporarily remove a key that both dictionaries otherwise carry
    // (FR-010's parity is the production intent — this proves the
    // fallback mechanism (FR-011) for the case where it's ever violated).
    const common = de['common'] as TranslationDictionary;
    const original = common['save'];
    delete common['save'];
    try {
      i18n.setLanguage('de');
      expect(pipe.transform('common.save')).toBe('Save');
    } finally {
      common['save'] = original;
    }
  });

  it('returns the key path itself when missing from both dictionaries', () => {
    expect(pipe.transform('nonexistent.key.path')).toBe('nonexistent.key.path');
  });

  it('returns an empty string for a null/undefined key rather than throwing', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });
});
