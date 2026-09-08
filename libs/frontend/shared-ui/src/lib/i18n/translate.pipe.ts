import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from './i18n.service';

/**
 * `{{ 'header.signOut' | translate }}` — looks up a dotted key path in the
 * active language's dictionary (`I18nService.language()`), falling back to
 * the default (`en`) dictionary on a missing key, and to the key path
 * itself only if the key is missing from both (FR-011: never a raw key or
 * empty string is the intent, but an unmistakably-a-bug string beats a
 * blank UI when a key genuinely doesn't exist anywhere).
 *
 * `pure: false` — the active language is read from a signal outside the
 * pipe's own arguments, so Angular's default purity (memoized on argument
 * identity alone) would miss language changes; impure pipes re-evaluate on
 * every change-detection run, which is what makes FR-003's "re-renders
 * immediately, no reload" work through this pipe.
 */
@Pipe({ name: 'translate', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: string | null | undefined): string {
    if (!key) {
      return '';
    }
    return this.i18n.translate(key);
  }
}
