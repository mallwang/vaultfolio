import { inject } from '@angular/core';
import type { RequestStatusDto } from '@vaultfolio/api-contract';
import { I18nService } from '@vaultfolio/frontend-shared-ui';
import { findRequestType, requestTypeLabel } from '@vaultfolio/requests';

export type Severity = 'success' | 'info' | 'secondary' | 'danger' | 'warn';

export const STATUS_SEVERITY: Record<RequestStatusDto, Severity> = {
  OPEN: 'warn',
  IN_PROGRESS: 'info',
  DONE: 'success',
  REJECTED: 'secondary',
};

export const STATUSES: readonly RequestStatusDto[] = ['OPEN', 'IN_PROGRESS', 'DONE', 'REJECTED'];

/**
 * `t('requests.admin.x', { n: 1 })` — translated text with `{{name}}` placeholders that
 * re-evaluates on language change, plus the registry labels of a request type (a new registry
 * row needs no change here — SC-010).
 */
export function requestText(): {
  t: (key: string, params?: Record<string, string | number>) => string;
  typeLabel: (feature: string, type: string) => { feature: string; type: string };
  date: (iso: string) => string;
} {
  const i18n = inject(I18nService);
  return {
    t: (key, params) => {
      i18n.language();
      let text = i18n.translate(key);
      for (const [name, value] of Object.entries(params ?? {})) {
        text = text.replaceAll(`{{${name}}}`, String(value));
      }
      return text;
    },
    date: (iso) =>
      new Intl.DateTimeFormat(i18n.language(), { dateStyle: 'medium' }).format(new Date(iso)),
    typeLabel: (feature, type) => {
      const definition = findRequestType(feature, type);
      if (!definition) return { feature, type };
      return requestTypeLabel(definition, i18n.language() === 'de' ? 'de' : 'en');
    },
  };
}
