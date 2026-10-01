import { inject } from '@angular/core';
import { I18nService } from '@vaultfolio/frontend-shared-ui';
import { fill } from '../../earnings-format';

/** `t('requests.wizard.x', { n: 1 })` — translated text with `{{name}}` placeholders; re-evaluates on language change. */
export function wizardText(): (key: string, params?: Record<string, string | number>) => string {
  const i18n = inject(I18nService);
  return (key, params) => {
    i18n.language();
    return fill(i18n.translate(key), params);
  };
}
