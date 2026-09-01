import { DEFAULT_LANGUAGE_CODE, isSupportedLanguageCode } from '@vaultfolio/api-contract';
import type { LanguageCode } from './types.js';

/**
 * Resolves a raw stored preference (e.g. `user.emailLanguage`) to a
 * guaranteed-supported `LanguageCode` (data-model.md "Resolved Language",
 * FR-002): `null`/unsupported values fall back to `DEFAULT_LANGUAGE_CODE`
 * ('en'), reusing `@vaultfolio/api-contract`'s single source of truth for
 * supported languages.
 */
export function resolveLanguage(preferredLanguage: string | null): LanguageCode {
  return isSupportedLanguageCode(preferredLanguage) ? preferredLanguage : DEFAULT_LANGUAGE_CODE;
}
