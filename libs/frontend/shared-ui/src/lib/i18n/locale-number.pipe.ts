import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from './i18n.service';

/** Formats a number using the active locale's grouping and decimal conventions. Pure: false — re-evaluates when language signal changes. */
@Pipe({ name: 'localeNumber', pure: false })
export class LocaleNumberPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(value: number | string | null | undefined, options?: Intl.NumberFormatOptions): string {
    if (value == null || value === '') return '—';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '—';
    return new Intl.NumberFormat(this.i18n.language(), {
      maximumFractionDigits: 8,
      ...options,
    }).format(num);
  }
}
