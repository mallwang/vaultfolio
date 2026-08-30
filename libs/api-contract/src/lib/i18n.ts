/**
 * Shared supported-language catalog — see
 * specs/013-multilanguage-support/contracts/profile-api-i18n.md and
 * research.md #2. Single source of truth used identically by the frontend
 * display-language switcher, the frontend email-language settings picker
 * (FR-012 — same list, same names, same order), and backend request
 * validation for `PATCH /api/profile/email-language`.
 */

export interface SupportedLanguage {
  code: string;
  label: string;
  isDefault: boolean;
}

export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = [
  { code: 'en', label: 'English', isDefault: true },
  { code: 'de', label: 'Deutsch', isDefault: false },
];

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

const defaultLanguage = SUPPORTED_LANGUAGES.find((language) => language.isDefault);
if (!defaultLanguage) {
  throw new Error('SUPPORTED_LANGUAGES must include exactly one isDefault entry.');
}
export const DEFAULT_LANGUAGE_CODE: LanguageCode = defaultLanguage.code;

export function isSupportedLanguageCode(value: unknown): value is LanguageCode {
  return (
    typeof value === 'string' && SUPPORTED_LANGUAGES.some((language) => language.code === value)
  );
}
